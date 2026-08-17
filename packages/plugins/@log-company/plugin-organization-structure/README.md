# Organization structure

`@log-company/plugin-organization-structure` adds a full-page visual organization structure at
`/admin/organization-structure`. It is an alternative interface over the standard NocoBase Departments plugin; it does
not introduce a second organization model.

## Standard NocoBase model

The implementation was verified against `@nocobase/plugin-departments` 2.0.60:

- `departments`: adjacency-list tree with `id`, `title`, `parentId`, `parent`, `children`, `isLeaf`, `sort`, `members`,
  `owners`, and `roles`;
- `departmentsUsers`: standard many-to-many through collection with `departmentId`, `userId`, `isOwner`, and deprecated
  `isMain`;
- `users.departments`: many-to-many membership; one user may belong to several departments;
- `users.mainDepartment` / `users.mainDepartmentId`: the primary department;
- managers are department members whose `departmentsUsers.isOwner` value is true.

The current 2.0.60 user model has no standard job-title, avatar, or active-status field. The UI supports those optional
properties when an installation extends the returned user DTO, and otherwise omits them rather than creating duplicate
fields.

## Standard APIs

The client uses only NocoBase resources and association actions:

- `departments:list`, `departments:create`, `departments:update`, `departments:destroy`;
- `users:list` with server filters and pagination;
- `users.departments:add|set|remove` for assignment, movement, and exclusion;
- `departments.members:add` for batch member addition;
- `departments:update` with `owners` for manager assignment.

These requests pass through the standard ACL middleware, collection hooks, `isLeaf` maintenance, main-department
synchronization, deletion checks, and the same tables used by the built-in Departments interface. There is no data copy
or synchronization job.

## Permissions

The page honors both standard NocoBase permission mechanisms:

- system settings access granted by the `pm.departments` and `pm.users` ACL snippets;
- data-source action permissions for `departments` and `users`, including configured field whitelists.

Membership actions use the same rule as NocoBase's ACL middleware: changing `users.departments` requires `users:update`
for the `departments` field, while changing `departments.members` requires `departments:update` for the `members` field.
The plugin does not introduce a separate root/admin-only permission.

Creating an employee uses the standard `users:create` action and is shown only when the current role can create the
`nickname`, `email`, `username`, and `password` fields. NocoBase therefore retains its standard unique constraints,
password hashing, default-role assignment, hooks, audit behavior, and ACL checks.

Employee details load the standard `users.roles` association and display role titles above department membership. The
employee action menu exposes **Terminate employee** only when the current role has `pm.users` or `users:destroy` access
to that record. Termination delegates to the stock `users:destroy` action, including NocoBase's ACL scope, cascading
association cleanup, audit hooks, and built-in protection that prevents deletion of the root user with ID `1`.

## Employee onboarding email

The employee sidebar contains an **Add employee** action. Its form accepts the full name, email, and login. A
cryptographically secure ten-character initial password is generated in the browser with at least one uppercase Latin
letter, lowercase Latin letter, digit, and special character. The password is sent only to the standard `users:create`
action and is never returned by the plugin or included in the notification body.

After creation, the client calls the standard `auth:lostPassword` action for the built-in `basic` authenticator. The
employee receives the NocoBase password-setup link and chooses their own password. This avoids storing an initial
plaintext password in `notificationSendLogs` while reusing NocoBase's reset-token expiration and one-time-token rules.

Before using onboarding, configure NocoBase **Password authentication → Forgot password**:

- enable password reset;
- select an Email notification channel;
- configure the subject and HTML/text body using `$user.username`, `$resetLink`, and `$resetLinkExpiration`;
- set an appropriate link expiration time.

If the user is created but the reset email cannot be queued, the form closes, the shared employee list refreshes, and a
warning explains the partial success. Repeating the create request is prevented while the first request is pending.

The plugin marks NocoBase's sign-in, sign-up, forgot-password, and reset-password routes as public authentication routes.
This prevents background protected requests from showing misleading authentication errors or redirecting an
unauthenticated user back to sign-in while they are recovering access.

## Password policy

NocoBase 2.0.60 displays a password-strength indicator but does not enforce a password policy on the server. This plugin
therefore applies one policy to the standard `auth:signUp`, `auth:changePassword`, `auth:resetPassword`, `users:create`,
and `users:update` actions. A password must contain 10–128 characters, at least one uppercase and one lowercase Latin
letter, one digit, and one special character, and no whitespace. The rule is enforced by a pre-action middleware after
the standard ACL check, so direct API requests cannot bypass it.

The same rule replaces Formily's standard `password` validator used by the built-in sign-up, profile password-change,
and user-management forms. The reset-password route uses a plugin page with the same NocoBase token validation and API,
plus inline policy validation and a localized requirements hint. Existing password hashes are not inspected or changed;
the policy is applied only when a new password is submitted.

## Client architecture

The legacy v1 client registers a dedicated route and keeps one page-level state source in `useOrganizationStructure`.
The employee panel, diagram, and department tree receive the same normalized department records. Mutations refresh both
the shared structure query and the active paginated employee query.

The central diagram uses a recursive flex-tree layout with CSS connectors. Branch expansion, panel state, zoom, and focus
are in-memory only. The canvas supports two-axis scrolling, mouse panning, 40–150% zoom, focus centering, and independent
panel collapse. No drag-and-drop handlers or browser storage are used.

## Minimal server adapter

NocoBase 2.0.60 does not validate cycles when `departments:update` changes `parent`. The server side therefore registers a
pre-action middleware for that standard action. It reads the target parent chain through the NocoBase repository, rejects
self/descendant/corrupted cycles, and then delegates to the original action. It creates no endpoint, table, relationship,
or direct SQL and retains the standard update ACL scope.

The database migrations register the top-level `desktopRoutes` menu link and normalize its localized title for the
`lm-desktop-routes` namespace used by NocoBase 2.0.60. They do not create or alter organization data tables. The route
migration's down method removes only the plugin link.

## Installation

From the repository root:

```bash
corepack yarn build @log-company/plugin-organization-structure
corepack yarn tar @log-company/plugin-organization-structure
corepack yarn nocobase pm add @log-company/plugin-organization-structure
corepack yarn nocobase pm enable @log-company/plugin-organization-structure
corepack yarn nocobase upgrade
```

Use the normal plugin-manager workflow for the target environment. Do not copy source files into `storage/plugins`.

## Checks

```bash
corepack yarn eslint --fix packages/plugins/@log-company/plugin-organization-structure/src
corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/client/features/organization/utils/__tests__/departmentTree.test.ts --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/client/features/organization/api/__tests__/organizationStructureService.test.ts --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/client/features/organization/utils/__tests__/departmentMembers.test.ts --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/server/domain/department/__tests__/DepartmentHierarchyPolicy.test.ts --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/server/application/__tests__/ValidateDepartmentMove.test.ts --run --reporter=verbose
corepack yarn test packages/plugins/@log-company/__tests__/OnionBoundaries.test.ts --run --reporter=verbose
ORGANIZATION_POSTGRES_INTEGRATION=1 DB_DIALECT=postgres DB_TEST_PREFIX=organization_test \
  corepack yarn test packages/plugins/@log-company/plugin-organization-structure/src/server/__tests__/departmentMove.integration.test.ts --run --reporter=verbose
corepack yarn build @log-company/plugin-organization-structure
```

The integration command also requires `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, and `DB_PASSWORD` for an isolated
PostgreSQL database whose name begins with `organization_test`.

The Playwright scenarios are in `src/client/__e2e__/organizationStructure.test.ts`. They cover the three synchronized
areas, menu localization, panel collapse, search/focus, zoom and mouse panning, department and employee mutations,
cycle prevention, two-way visibility in the built-in Departments interface, the absence of drag-and-drop and a
view-only ACL role. They require an installed, enabled plugin in an E2E application.

## Known model limitation

Position, avatar, and active-state display depends on optional fields exposed by the installation's `users` collection.
The stock 2.0.60 model in this project does not define those fields, so they are absent in the current runtime. No custom
employee field or table is added by this plugin.
