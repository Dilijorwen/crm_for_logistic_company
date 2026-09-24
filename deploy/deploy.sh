#!/usr/bin/env bash

set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${project_root}/deploy/docker-compose.vm.yml"
env_file="${ENV_FILE:-${project_root}/.env.production}"
check_only=false

plugins=(
  '@log-company/plugin-chats'
  '@log-company/plugin-collection-search'
  '@log-company/plugin-organization-structure'
  '@log-company/plugin-permit-documents'
  '@log-company/plugin-process-governance'
  '@log-company/plugin-process-discussion'
  '@log-company/plugin-process-documents'
)

fail() {
  echo "Error: $*" >&2
  exit 1
}

case "${1:-}" in
  '') ;;
  --check) check_only=true ;;
  *) fail "unknown argument '$1'; supported argument: --check" ;;
esac

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command '$1' is not installed"
}

read_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^[[:space:]]*${key}=" "${env_file}" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"

  if [[ "${line}" == \"*\" && "${line}" == *\" ]]; then
    line="${line:1:${#line}-2}"
  elif [[ "${line}" == \'*\' && "${line}" == *\' ]]; then
    line="${line:1:${#line}-2}"
  fi

  printf '%s' "${line}"
}

validate_environment() {
  local required_variables=(
    APP_PUBLIC_URL
    APP_KEY
    DB_DATABASE
    DB_USER
    DB_PASSWORD
    MINIO_ROOT_USER
    MINIO_ROOT_PASSWORD
    INIT_ROOT_EMAIL
    INIT_ROOT_USERNAME
    INIT_ROOT_PASSWORD
    FSA_USERNAME
    FSA_PASSWORD
  )
  local key
  local value

  [[ -f "${env_file}" ]] || fail "${env_file} does not exist; copy .env.production.example and fill it first"

  for key in "${required_variables[@]}"; do
    value="$(read_env_value "${key}")"
    [[ -n "${value}" ]] || fail "${key} must be set in ${env_file}"
    if printf '%s' "${value}" | grep -Eqi 'replace-with|change-me|example\.com'; then
      fail "${key} still contains an example value in ${env_file}"
    fi
  done

  value="$(read_env_value APP_PUBLIC_URL)"
  [[ "${value}" =~ ^https?://[^/]+/?$ ]] || fail 'APP_PUBLIC_URL must be a full origin such as https://app.company.ru'
  if [[ "${value}" == http://* ]]; then
    echo 'Warning: APP_PUBLIC_URL uses HTTP. Use it only for a temporary IP-based test.' >&2
  fi

  value="$(read_env_value APP_KEY)"
  [[ ${#value} -ge 32 ]] || fail 'APP_KEY must contain at least 32 characters'

  value="$(read_env_value DB_PASSWORD)"
  [[ ${#value} -ge 16 ]] || fail 'DB_PASSWORD must contain at least 16 characters'

  value="$(read_env_value MINIO_ROOT_PASSWORD)"
  [[ ${#value} -ge 16 ]] || fail 'MINIO_ROOT_PASSWORD must contain at least 16 characters'

  value="$(read_env_value INIT_ROOT_PASSWORD)"
  [[ ${#value} -ge 10 ]] || fail 'INIT_ROOT_PASSWORD must contain at least 10 characters'
  [[ "${value}" =~ [A-Z] ]] || fail 'INIT_ROOT_PASSWORD must contain an uppercase Latin letter'
  [[ "${value}" =~ [a-z] ]] || fail 'INIT_ROOT_PASSWORD must contain a lowercase Latin letter'
  [[ "${value}" =~ [0-9] ]] || fail 'INIT_ROOT_PASSWORD must contain a digit'
  [[ "${value}" =~ [^a-zA-Z0-9] ]] || fail 'INIT_ROOT_PASSWORD must contain a special character'
}

wait_for_app() {
  local container_id
  local health
  local attempt=1

  while [[ ${attempt} -le 90 ]]; do
    container_id="$("${compose[@]}" ps -q app)"
    if [[ -n "${container_id}" ]]; then
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
      if [[ "${health}" == 'healthy' ]]; then
        return
      fi
      if [[ "${health}" == 'unhealthy' || "${health}" == 'exited' || "${health}" == 'dead' ]]; then
        "${compose[@]}" logs --tail=120 app >&2
        fail "NocoBase container entered '${health}' state"
      fi
    fi
    sleep 2
    attempt=$((attempt + 1))
  done

  "${compose[@]}" logs --tail=120 app >&2
  fail 'NocoBase did not become healthy within 180 seconds'
}

require_command docker
require_command node
require_command corepack
require_command git

node_major="$(node -p "process.versions.node.split('.')[0]")"
[[ "${node_major}" -ge 22 ]] || fail "Node.js 22 or newer is required; found $(node --version)"

validate_environment

compose=(docker compose --env-file "${env_file}" -f "${compose_file}")
"${compose[@]}" config --quiet

if [[ "${check_only}" == true ]]; then
  echo 'Deployment configuration is valid.'
  exit 0
fi

cd "${project_root}"

echo 'Installing locked workspace dependencies...'
corepack yarn install --frozen-lockfile --non-interactive

echo 'Building Log Company plugins...'
corepack yarn build "${plugins[@]}"
corepack yarn tar "${plugins[@]}"

echo 'Starting database, object storage, and NocoBase...'
"${compose[@]}" pull
"${compose[@]}" up -d postgres minio app
wait_for_app

new_plugins=()
new_archives=()
updated_archives=()
plugins_changed=false

for plugin in "${plugins[@]}"; do
  version="$(node -p "require('./packages/plugins/${plugin}/package.json').version")"
  archive_on_host="${project_root}/storage/tar/${plugin}-${version}.tgz"
  archive_in_app="/app/nocobase/storage/tar/${plugin}-${version}.tgz"

  [[ -f "${archive_on_host}" ]] || fail "plugin archive was not created: ${archive_on_host}"

  if [[ -f "${project_root}/storage/plugins/${plugin}/package.json" ]]; then
    updated_archives+=("${archive_in_app}")
  else
    new_plugins+=("${plugin}")
    new_archives+=("${archive_in_app}")
  fi
done

if [[ ${#updated_archives[@]} -gt 0 ]]; then
  echo 'Updating installed Log Company plugins...'
  "${compose[@]}" exec -T app yarn nocobase pm update "${updated_archives[@]}"
  wait_for_app
  plugins_changed=true
fi

if [[ ${#new_archives[@]} -gt 0 ]]; then
  echo 'Installing and enabling new Log Company plugins...'
  "${compose[@]}" exec -T app yarn nocobase pm add "${new_archives[@]}"
  "${compose[@]}" exec -T app yarn nocobase pm enable "${new_plugins[@]}"
  wait_for_app
  plugins_changed=true
fi

if [[ "${plugins_changed}" == true ]]; then
  echo 'Restarting NocoBase to refresh plugin asset hashes...'
  "${compose[@]}" restart app
  wait_for_app
fi

echo 'Starting the public HTTPS reverse proxy...'
"${compose[@]}" up -d caddy
"${compose[@]}" ps

echo "Deployment completed: $(read_env_value APP_PUBLIC_URL)"
