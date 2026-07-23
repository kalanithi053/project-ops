# ProjectOps API — curl reference

- **Base URL:** `http://localhost:3000/api/v1` (global prefix `api/v1`, default `PORT=3000`)
- **Swagger UI:** `http://localhost:3000/api/doc`
- **Auth:** a single JWT Bearer **access token** identifies the user.
  - **Access token** — from `POST /auth/otp/verify`. Sent as `Authorization: Bearer <token>` on every route.
  - **Refresh token** — from OTP verify; exchange at `POST /auth/token/refresh`.
  - **Active workspace** — selected per-request with the **`x-workspace-slug`** header (not baked into the token). Switching workspaces = changing the header.

```bash
BASE="http://localhost:3000/api/v1"
TOKEN="<accessToken>"
WORKSPACE_SLUG="demo-workspace"
```

Workspace-scoped routes return **400** if `x-workspace-slug` is missing, **404** if
the slug is unknown, and **403** if you are not an active member.

---

## health

```bash
# Liveness probe — Public
curl -s "$BASE/health"
```

## auth (Public)

```bash
# Request OTP. Unknown users are NOT created — the response returns
# { "slug": "Create-User" }, prompting you to register first (below).
# For existing users an OTP is sent (logged to the server console in dev).
curl -s -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{"username":"jane.doe"}'

# Create a user (after a Create-User response) -> creates the user and sends an OTP
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"jane.doe","firstName":"Jane","lastName":"Doe","email":"jane@acme.com"}'

# Verify OTP -> access + refresh token pair
curl -s -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"username":"jane.doe","otp":"123456"}'

# Refresh the token pair (no new OTP)
curl -s -X POST "$BASE/auth/token/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

## users (Bearer)

```bash
# Get my profile
curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN"

# Update my profile
curl -s -X PATCH "$BASE/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","phone":"+15551234567"}'
```

## workspaces (Bearer — no slug header needed)

```bash
# Create workspace (provisions default roles, modules, statuses, plan)
curl -s -X POST "$BASE/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc","slug":"acme"}'

# List my workspaces (use the returned slug as x-workspace-slug below)
curl -s "$BASE/workspaces/me" -H "Authorization: Bearer $TOKEN"

# Get one workspace
curl -s "$BASE/workspaces/11111111-1111-1111-1111-111111111111" \
  -H "Authorization: Bearer $TOKEN"
```

## workspace-members (Bearer + x-workspace-slug)

```bash
# List members
curl -s "$BASE/workspace-members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG"

# Invite a user (roleId optional -> defaults to workspace default role)
curl -s -X POST "$BASE/workspace-members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"username":"john.doe","roleId":"33333333-3333-3333-3333-333333333333"}'

# Update a member role/status  (status: invited|active|removed)
curl -s -X PATCH "$BASE/workspace-members/<memberId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"<roleId>","status":"active"}'

# Remove a member
curl -s -X DELETE "$BASE/workspace-members/<memberId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## roles (Bearer + x-workspace-slug)

```bash
# List roles
curl -s "$BASE/roles" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a custom role
curl -s -X POST "$BASE/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Project Lead","isDefault":false,"permissionCodes":["project.create","task.create"]}'

# Update a role
curl -s -X PATCH "$BASE/roles/<roleId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lead","permissionCodes":["project.read","task.read"]}'

# Delete a custom role
curl -s -X DELETE "$BASE/roles/<roleId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## permissions (Bearer + x-workspace-slug)

```bash
# List permission catalog
curl -s "$BASE/permissions" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## plans (Bearer + x-workspace-slug)

```bash
# Get active plan
curl -s "$BASE/plans/active" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update active plan limits / feature flags
curl -s -X PATCH "$BASE/plans/active" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pro","maxProjects":50,"maxMembers":100,"maxTasksPerModule":500,"features":{"exports":true},"isActive":true}'
```

## modules (Bearer + x-workspace-slug)

```bash
# List modules
curl -s "$BASE/modules" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a module
curl -s -X POST "$BASE/modules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"key":"pipeline","name":"Pipeline","defaultTaskLimit":10,"isDefault":false,"isActive":true}'

# Update a module (key is immutable)
curl -s -X PATCH "$BASE/modules/<moduleId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Delivery Pipeline","defaultTaskLimit":20}'

# Delete a module
curl -s -X DELETE "$BASE/modules/<moduleId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## ticket-statuses (Bearer + x-workspace-slug)

```bash
# List ticket status pipeline
curl -s "$BASE/ticket-statuses" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a ticket status  (category: todo|in_progress|done)
curl -s -X POST "$BASE/ticket-statuses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"In Review","color":"#f59e0b","order":2,"category":"in_progress","isDefault":false}'

# Update a ticket status
curl -s -X PATCH "$BASE/ticket-statuses/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Reviewing","order":3}'

# Delete a ticket status
curl -s -X DELETE "$BASE/ticket-statuses/<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## projects (Bearer + x-workspace-slug)

```bash
# Create a project. mode is required: "HubSpot" | "Dev".
# HubSpot projects auto-attach default modules + seed tasks; Dev projects start empty.
curl -s -X POST "$BASE/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Website Revamp","mode":"HubSpot","description":"Q1 site rebuild","startDate":"2026-01-01T00:00:00.000Z","endDate":"2026-03-31T00:00:00.000Z"}'

# List projects
curl -s "$BASE/projects" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Get a project (with modules + members)
curl -s "$BASE/projects/<projectId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update a project
curl -s -X PATCH "$BASE/projects/<projectId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Website Revamp v2","description":"updated"}'

# Soft-delete a project
curl -s -X DELETE "$BASE/projects/<projectId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## project-members (Bearer + x-workspace-slug)

```bash
# List project members
curl -s "$BASE/projects/<projectId>/members" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Invite a member (auto-invites to workspace if needed)
curl -s -X POST "$BASE/projects/<projectId>/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"username":"john.doe","roleId":"<roleId>"}'

# Update a project member role/status
curl -s -X PATCH "$BASE/projects/<projectId>/members/<memberId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"roleId":"<roleId>","status":"active"}'

# Remove a project member
curl -s -X DELETE "$BASE/projects/<projectId>/members/<memberId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## project modules (module-instances) (Bearer + x-workspace-slug)

```bash
# List modules attached to a project
curl -s "$BASE/projects/<projectId>/modules" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Attach a module to a project (taskLimit optional)
curl -s -X POST "$BASE/projects/<projectId>/modules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"moduleId":"<moduleId>","taskLimit":25}'

# Override a module instance task limit
curl -s -X PATCH "$BASE/projects/<projectId>/modules/<instanceId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"taskLimit":50}'

# Detach a module from a project
curl -s -X DELETE "$BASE/projects/<projectId>/modules/<instanceId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## tasks (Bearer + x-workspace-slug)

```bash
# List tasks (optional filters: moduleInstanceId, statusId)
curl -s "$BASE/projects/<projectId>/tasks?moduleInstanceId=<id>&statusId=<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a task (enforces module task limit)
curl -s -X POST "$BASE/projects/<projectId>/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page","description":"hero + CTA","moduleInstanceId":"<id>","startDate":"2026-01-05T00:00:00.000Z","dueDate":"2026-01-12T00:00:00.000Z","statusId":"<id>","assigneeId":"<userId>","position":0}'

# Get a task
curl -s "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update a task
curl -s -X PATCH "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page v2","statusId":"<id>"}'

# Soft-delete a task
curl -s -X DELETE "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```
