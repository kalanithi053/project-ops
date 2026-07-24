# Project Ops API

Multi-tenant project-management backend built with **NestJS 11 + Prisma + PostgreSQL**.
Authentication is passwordless (**username + OTP**). Every workspace is an isolated
tenant; a single user can belong to many workspaces and switch between them without
re-authenticating.

---

## Table of contents

- [Architecture](#architecture)
- [Multi-tenancy model](#multi-tenancy-model)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database: migrate & seed](#database-migrate--seed)
- [Running](#running)
- [Auth flow (end to end)](#auth-flow-end-to-end)
- [Authorization model](#authorization-model)
- [Plan limits](#plan-limits)
- [Project creation side effects](#project-creation-side-effects)
- [API surface](#api-surface)
- [Design decisions / assumptions](#design-decisions--assumptions)

---

## Architecture

```
src/
  prisma/            PrismaModule + PrismaService (global)
  auth/              OTP request/verify, JWT strategy, token minting, workspace select/switch/refresh
  users/             current-user profile
  workspaces/        create workspace (+ provisioning), list mine, get one
  workspace-members/ invite / update / remove workspace members
  roles/             UserRole CRUD + permission assignment
  permissions/       permission catalog (read)
  plans/             active plan get/update (+ limit-enforcement helper)
  projects/          project CRUD + transactional auto-module/auto-task creation
  project-members/   invite (auto-invite to workspace) / update / remove
  modules-catalog/   Module catalog CRUD + per-project ModuleInstance management
  tasks/             task CRUD + per-module task-limit enforcement
  ticket-status/     configurable status pipeline per workspace
  common/
    constants/       permission catalog, default roles, workspace defaults
    decorators/      @Public, @RequirePermission, @CurrentUser, @CurrentWorkspace
    guards/          JwtAuthGuard (global), WorkspaceScopeGuard, PermissionsGuard
    exceptions/      PlanLimitException (HTTP 402)
    types/           JWT payload shapes
prisma/
  schema.prisma      all models
  migrations/        SQL migrations
  seed.ts            demo workspace seed
```

The data layer is **Prisma** (the original scaffold's TypeORM wiring was replaced).

## Multi-tenancy model

Shared database, shared schema, **discriminator column** (`workspaceId` on every
tenant-scoped table). Isolation is enforced in two layers:

1. **`WorkspaceScopeGuard`** — every workspace-scoped route resolves the active
   workspace from the **`x-workspace-slug`** request header, then re-validates
   against the DB that the caller is still an **active** member of that workspace.
   It publishes `request.workspace` (workspace id, live role id, membership id,
   user id). Switching workspaces is just changing the header — no token re-issue.
2. **Tenant-scoped services** — every query is filtered by `workspaceId` taken from
   that context, so a row from another tenant can never be read or mutated.

## Setup

```bash
npm install
cp .env.example .env      # then edit values (DATABASE_URL, JWT_SECRET, ...)
npx prisma generate
```

Requires **Node 18+** and a reachable **PostgreSQL** instance.

## Environment variables

| Variable                  | Purpose                                              | Example                                                        |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `PORT`                    | HTTP port                                            | `3000`                                                         |
| `CORS`                    | Semicolon-separated allowed origins                  | `http://localhost:4000;http://localhost:3000`                  |
| `DATABASE_URL`            | Prisma Postgres connection string                    | `postgresql://postgres:postgres@localhost:5432/project_ops`    |
| `JWT_SECRET`              | Signing secret for all tokens                        | `change_me_in_production`                                      |
| `JWT_IDENTITY_EXPIRATION` | Identity token TTL                                   | `15m`                                                          |
| `JWT_ACCESS_EXPIRATION`   | Session access token TTL                             | `15m`                                                          |
| `JWT_REFRESH_EXPIRATION`  | Session refresh token TTL                            | `7d`                                                           |
| `OTP_TTL_SECONDS`         | OTP validity window                                  | `300`                                                          |
| `OTP_MAX_ATTEMPTS`        | Max verify attempts per OTP                          | `5`                                                            |

`DATABASE_URL` is what Prisma reads; the legacy `DB_*` values are kept only so you
can compose the URL by hand.

## Database: migrate & seed

```bash
# create/apply migrations in dev (also runs the seed)
npm run prisma:migrate

# apply committed migrations in prod
npm run prisma:migrate:deploy

# (re)seed the demo workspace
npm run db:seed

# browse data
npm run prisma:studio
```

The **seed** creates a demo user `demo.owner`, a `Demo Workspace`, the four default
roles (Owner/Admin/Member/Viewer) with permissions, the plan catalog
(Professional/Ultimate/Enterprise, with **Professional** active), the module
catalog **per plan** (Pipeline → limit 10, Custom Properties → limit 20 under each
tier), and the ticket pipeline (Backlog/In Progress/Ready for QA/Review/Done).
It is idempotent.

## Running

```bash
npm run start:dev      # watch mode
npm run build && npm run start:prod
```

- API base path: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/doc`
- Health probe (public): `GET /api/v1/health`

All responses are wrapped by a global interceptor:

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

## Auth flow (end to end)

A **single access token** identifies the user. The active workspace is chosen
per-request with the **`x-workspace-slug`** header — no per-workspace token.

```bash
BASE=http://localhost:3000/api/v1

# 1. request an OTP. Unknown usernames are NOT created — the response returns
#    { "slug": "Create-User" }; register first (step 1a). Existing users get an OTP.
curl -X POST $BASE/auth/otp/request -H 'Content-Type: application/json' \
  -d '{"username":"demo.owner"}'

# 1a. (only if step 1 returned Create-User) create the user, which also sends an OTP
curl -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"demo.owner","firstName":"Demo","lastName":"Owner","email":"demo@acme.com"}'

# 2. verify -> access + refresh token pair (token carries userId only)
curl -X POST $BASE/auth/otp/verify -H 'Content-Type: application/json' \
  -d '{"username":"demo.owner","otp":"123456"}'
# -> data.accessToken, data.refreshToken

# 3. list workspaces you belong to (token only)
curl $BASE/workspaces/me -H "Authorization: Bearer <accessToken>"

# 4. call any workspace-scoped route by passing the chosen workspace slug
curl $BASE/projects \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-workspace-slug: demo-workspace"

# switching workspaces = change the header (no new OTP, no token re-issue)
curl $BASE/projects \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-workspace-slug: another-workspace"

# 5. refresh the token pair without a new OTP
curl -X POST $BASE/auth/token/refresh -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Token taxonomy:

- **access** — issued at OTP verify, carries `sub` (userId) only. Used for every
  route; the workspace comes from the `x-workspace-slug` header.
- **refresh** — long-lived companion, exchanged for a fresh access token (rejected
  for authenticating requests).

Workspace-scoped routes return **400** if the `x-workspace-slug` header is missing,
**404** if the slug is unknown, and **403** if the caller isn't an active member.

## Authorization model

Each workspace-scoped route may declare `@RequirePermission('code')`. `PermissionsGuard`
resolves the caller's role → permission-code set (cached per request) and returns
**403** if any required code is missing. Permission codes live in
`src/common/constants/permissions.ts`; default role → permission mappings are in the
same file and are seeded per workspace.

## Plan limits

Enforced at the service layer before create actions:

- `POST /projects` → **402** when `Plan.maxProjects` reached.
- workspace/project member invite creating a *new* workspace member → **402** when
  `Plan.maxMembers` reached.
- `POST /projects/:id/tasks` → **409** when the target `ModuleInstance.taskLimit`
  is reached.

## Project creation side effects

`POST /projects` requires a **`mode`** (`HubSpot` | `Dev`) and runs in a single
transaction:

1. checks the plan `maxProjects` quota,
2. creates the project,
3. adds the creator as an active **Owner** `ProjectMember`,
4. **only when `mode === HubSpot`:** attaches the **active plan's** default
   (`isDefault`) modules as `ModuleInstance`s (carrying over `defaultTaskLimit`)
   and seeds one task per instance named **`{Module Name} - 1`** (e.g.
   `Pipeline - 1`) with the project's start/end dates and default ticket status.
   Modules belong to a plan (`Module.planId`), so which modules get attached
   depends on the workspace's active plan tier.

`Dev` projects start empty (no auto modules/tasks).

## API surface

| Area              | Route                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Auth              | `POST /auth/otp/request`, `/auth/register`, `/auth/otp/verify`, `/auth/token/refresh`            |
| Users             | `GET/PATCH /users/me`                                                                             |
| Workspaces        | `POST /workspaces`, `GET /workspaces/me`, `GET /workspaces/:id`                                   |
| Workspace settings| `GET /workspace/settings` (aggregate config bundle)                                              |
| Priorities        | `GET/POST /priorities`, `PATCH/DELETE /priorities/:id`                                            |
| Workspace members | `GET/POST /workspace-members`, `PATCH/DELETE /workspace-members/:id`                              |
| Roles             | `GET/POST /roles`, `PATCH/DELETE /roles/:id`                                                      |
| Permissions       | `GET /permissions`                                                                                |
| Plans             | `GET /plans`, `GET /plans/active`, `POST /plans/:planId/activate`, `PATCH /plans/active`          |
| Projects          | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`                                            |
| Project members   | `GET/POST /projects/:projectId/members`, `PATCH/DELETE /projects/:projectId/members/:memberId`   |
| Modules (catalog) | `GET/POST /modules`, `PATCH/DELETE /modules/:id`                                                  |
| Module instances  | `GET/POST /projects/:projectId/modules`, `PATCH/DELETE /projects/:projectId/modules/:instanceId` |
| Tasks             | `GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /projects/:projectId/tasks/:taskId`     |
| Ticket statuses   | `GET/POST /ticket-statuses`, `PATCH/DELETE /ticket-statuses/:id`                                  |

Full request/response schemas are in Swagger at `/api/doc`.

## Design decisions / assumptions

Confirmed with the product owner:

- **Prisma** for the data layer (headline stack), replacing the scaffold's TypeORM.
- **Unknown usernames are not auto-created** on OTP request: the response returns
  `{ slug: "Create-User" }`, and a separate `POST /auth/register` creates the user
  (username, firstName, lastName, email) and sends the first OTP. _(Note: workspace
  and project invite endpoints still create a bare user row by username on demand.)_
- **Project invite auto-invites to the workspace**: if the invitee is not yet a
  workspace member, a `WorkspaceMember` (status `invited`) is created (respecting
  the plan member quota), then the `ProjectMember`.
- **One active Plan per workspace** (no plan-history table).
- Seed task naming pattern: **`{Module Name} - 1`**.

Other notes:

- OTP delivery is stubbed — codes are logged via `OtpService.deliver()`. Wire a real
  SMS/email provider there for production.
- Projects and tasks use **soft delete** (`deletedAt`); workspace/project membership
  removal is a status change (`removed`), not a hard delete.
- System roles (`isSystem`, e.g. Owner) are protected from deletion.
