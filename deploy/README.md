# Развёртывание Log Company на VM

Production-конфигурация запускает NocoBase 2.0.60, PostgreSQL 16, MinIO и Caddy. Наружу опубликованы только SSH на
уровне VM и порты `80/443` Caddy. PostgreSQL, MinIO и внутренний HTTP-порт NocoBase доступны только в Docker-сети.
Caddy автоматически получает и продлевает TLS-сертификат, если домен указывает на VM.

Все изменяемые данные находятся в корневом каталоге `storage/`: база PostgreSQL, объекты MinIO, установленные плагины,
логи и сертификаты Caddy. Этот каталог и файл `.env.production` исключены из Git.

## Требования к VM

- Linux VM с публичным IPv4-адресом;
- для тестового контура: от 4 vCPU, 8 GB RAM и 50 GB SSD;
- Docker Engine с Compose v2;
- Git, Node.js 22 и Corepack;
- открытые входящие TCP-порты `22`, `80`, `443` и UDP-порт `443`;
- домен с `A`-записью на публичный IP VM для нормального HTTPS.

Node.js нужен на VM только для воспроизводимой сборки локальных плагинов после `git pull`. Само приложение работает в
Docker. Homebrew на Linux-сервере не требуется.

## Первый запуск

Настройте Git remote и отправьте ветку с релизом в закрытый репозиторий. Затем подключитесь к VM и выполните:

```bash
sudo mkdir -p /opt/log-company
sudo chown "$USER":"$USER" /opt/log-company
git clone <SSH_URL_РЕПОЗИТОРИЯ> /opt/log-company
cd /opt/log-company
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Создайте независимые секреты. Для `APP_KEY` подходит результат:

```bash
openssl rand -hex 32
```

Для `DB_PASSWORD` и `MINIO_ROOT_PASSWORD` используйте разные случайные значения длиной не менее 16 символов.
`INIT_ROOT_PASSWORD` должен содержать не менее 10 символов, латинские буквы обоих регистров, цифру и специальный
символ. Если база уже существует, переменные `INIT_ROOT_*` не меняют созданного администратора.

В `APP_PUBLIC_URL` укажите полный публичный origin:

```dotenv
APP_PUBLIC_URL=https://crm.company.ru
```

До появления домена допустим временный вариант `http://<PUBLIC_IP>`. Он не шифрует трафик и годится только для
краткого технического теста.

После заполнения файла выполните:

```bash
./deploy/deploy.sh --check
./deploy/deploy.sh
```

Режим `--check` проверяет обязательные переменные и итоговую Compose-конфигурацию, не меняя состояние Docker. Обычный
запуск устанавливает зависимости строго по `yarn.lock`, собирает семь локальных плагинов, создаёт штатные NocoBase
tarball-архивы, запускает инфраструктуру, устанавливает или обновляет плагины через Plugin Manager и только после
успешного healthcheck включает публичный reverse proxy.

При использовании новой пустой базы сначала убедитесь, что стандартный плагин **Departments** включён в интерфейсе
NocoBase: экран организационной структуры работает поверх его коллекций и API.

## Обновление по SSH

Да, изменения можно заливать обычным Git-процессом. На рабочей машине создайте коммит и отправьте его в remote, затем
на VM выполните:

```bash
ssh deploy@crm.company.ru
cd /opt/log-company
git status --short
git pull --ff-only
./deploy/deploy.sh
```

`storage/` не участвует в `git pull`, поэтому база, файлы MinIO, установленные плагины и сертификаты сохраняются. Скрипт
переупаковывает плагины из актуального Git-коммита и применяет обновление штатной командой `pm update`.

## Диагностика

Все команды Compose запускаются из корня репозитория:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.vm.yml ps
docker compose --env-file .env.production -f deploy/docker-compose.vm.yml logs -f --tail=200 app
docker compose --env-file .env.production -f deploy/docker-compose.vm.yml logs -f --tail=200 caddy
```

Проверка снаружи VM:

```bash
curl --fail --show-error --head https://crm.company.ru
```

Если Caddy не получает сертификат, сначала проверьте DNS, доступность портов `80/443` и отсутствие другого web-сервера
на этих портах.

## Резервное копирование

Перед обновлением создайте snapshot диска VM у провайдера. Дополнительно сохраните логический дамп PostgreSQL:

```bash
mkdir -p backups
docker compose --env-file .env.production -f deploy/docker-compose.vm.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/nocobase-$(date +%Y%m%d-%H%M%S).dump"
```

Snapshot должен включать весь `/opt/log-company/storage`, особенно `storage/minio`. Не копируйте работающий каталог
`storage/db/postgres` как замену `pg_dump`: файловая копия активной базы может оказаться несогласованной.
