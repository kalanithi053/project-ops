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
WORKSPACE_SLUG="amwhizcom"
```

Workspace-scoped routes return **400** if `x-workspace-slug` is missing, **404** if
the slug is unknown, and **403** if you are not an active member.

Seed data (dev): user **`demo.owner@amwhiz.com`**, workspace **`amwhizcom`**, OTP **`123456`**.

---

## health

```bash
# Liveness probe — Public
curl -s "$BASE/health"
```

## auth (Public)

```bash
# Request OTP. Unknown emails are NOT created — the response returns
# { "slug": "Create-User" }, prompting you to register first (below).
# For existing (complete) users an OTP is sent (logged to the server console in dev,
# or the user's staticOtp value when set).
curl -s -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com"}'

# Create a user (after a Create-User response) -> creates the user and sends an OTP.
# Also completes a stub user pre-created by a workspace/project invite (email only).
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","firstName":"Jane","lastName":"Doe"}'

# Verify OTP -> access + refresh token pair. Dev default OTP is 123456
# (User.staticOtp; override per user in the DB for a different fixed code).
curl -s -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","otp":"123456"}'

# Refresh the token pair (no new OTP)
curl -s -X POST "$BASE/auth/token/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

## workspace settings (Bearer + x-workspace-slug)

```bash
# Full workspace config bundle: details, plans (with modules), ticket statuses,
# priorities, roles (with permissions) and the permission catalog.
curl -s "$BASE/workspace/settings" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## my permissions (Bearer + x-workspace-slug)

```bash
# Permissions allowed to the current user in the active workspace (workspace role)
curl -s "$BASE/workspace/permission" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Permissions allowed to the current user for a specific project (project role).
# Returns { isMember, role, permissions[] }; isMember=false + [] if not on the project.
curl -s "$BASE/project/<projectId>/permission" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## users (Bearer)

```bash
# Get my profile. Without the workspace header the workspace/permissions fields are omitted.
curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN"

# With x-workspace-slug: also returns the active workspace, my role in it, and my permission codes.
curl -s "$BASE/users/me" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update my profile
curl -s -X PATCH "$BASE/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@acme.com"}'
```

## workspaces (Bearer — no slug header needed)

```bash
# Create workspace. Provisions: roles+permissions, project types (HubSpot/Development),
# plans (Professional/Ultimate/Enterprise) with HubSpot modules each, statuses, priorities.
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
  -d '{"email":"john@acme.com","roleId":"33333333-3333-3333-3333-333333333333"}'

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
# List plan tiers for a project type (projectTypeId query param is required)
curl -s "$BASE/plans?projectTypeId=<projectTypeId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a new plan tier. projectTypeId is REQUIRED (a plan belongs to a project type).
# The plan auto-seeds the default HubSpot modules. isActive:true deactivates the other plans.
curl -s -X POST "$BASE/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"projectTypeId":"<projectTypeId>","name":"Starter","features":{},"isActive":false}'

# Get ALL active plans (array; multiple plans can be active)
curl -s "$BASE/plans/active" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Switch the active plan to a tier (deactivates the others)
curl -s -X POST "$BASE/plans/<planId>/activate" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update the active plan's name / feature flags
curl -s -X PATCH "$BASE/plans/active" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pro","features":{"exports":true}}'
```

## modules (Bearer + x-workspace-slug)

```bash
# List modules (optionally filter by plan)
curl -s "$BASE/modules?planId=<planId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a module — planId is required (a module belongs to a plan)
curl -s -X POST "$BASE/modules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"planId":"<planId>","key":"pipeline","name":"Pipeline","defaultTaskLimit":10,"isDefault":false,"isActive":true}'

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

# Create a ticket status  (category: todo|in_progress|ready_qa|review|done)
curl -s -X POST "$BASE/ticket-statuses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"In Review","color":"#f59e0b","order":2,"category":"review","isDefault":false}'

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

## priorities (Bearer + x-workspace-slug)

```bash
# List priorities
curl -s "$BASE/priorities" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a priority
curl -s -X POST "$BASE/priorities" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Critical","color":"#7c3aed","order":4,"isDefault":false}'

# Update a priority
curl -s -X PATCH "$BASE/priorities/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Blocker","order":5}'

# Delete a priority
curl -s -X DELETE "$BASE/priorities/<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## project-types (Bearer + x-workspace-slug)

```bash
# List project types (chosen at project creation)
curl -s "$BASE/project-types" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a project type. isPlanAdd=false -> projects of this type skip plan/module/task steps.
# isPlanAdd=true auto-seeds the default plans (Professional/Ultimate/Enterprise, inactive),
# each of which auto-seeds the default HubSpot modules.
curl -s -X POST "$BASE/project-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Marketing","description":"HubSpot-style","isPlanAdd":true}'

# Update a project type
curl -s -X PATCH "$BASE/project-types/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"isPlanAdd":false}'

# Delete a project type
curl -s -X DELETE "$BASE/project-types/<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## projects (Bearer + x-workspace-slug)

```bash
# Create a project. Required: name (unique per workspace), startDate, endDate, projectTypeId.
# planId is an ARRAY of plan ids — required (min 1) when the type's isPlanAdd is true.
# isPlanAdd=true -> attaches each chosen plan's default modules + seed tasks; false -> bare project.
curl -s -X POST "$BASE/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Website Revamp","startDate":"2026-01-01T00:00:00.000Z","endDate":"2026-03-31T00:00:00.000Z","projectTypeId":"<projectTypeId>","planId":["<planId>"],"description":"Q1 site rebuild"}'

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
  -d '{"email":"john@acme.com","roleId":"<roleId>"}'

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
# List modules attached to a project.
# Each instance includes addonTask — the count of tasks created beyond taskLimit.
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
# List tasks (optional filters: moduleInstanceId, statusId, priorityId)
curl -s "$BASE/projects/<projectId>/tasks?moduleInstanceId=<id>&statusId=<id>&priorityId=<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a task.
# - moduleInstanceId is REQUIRED when the project's type has isPlanAdd=true (400 otherwise).
# - prefix is auto-generated when omitted (an explicit prefix always wins):
#     module-bound task -> "{Module Name} - N" (N continues across ALL same-named
#     module instances in the project, so numbering never restarts)
#     unbound task      -> "{first letter of project name}-T{task count + 1}" (e.g. "W-T48")
# - Overflow: if the requested instance is at its taskLimit, the task is stored on
#   another instance in the project whose module has the SAME NAME and spare capacity
#   (multi-plan projects). Only when every same-named instance is full does the task
#   stay on the requested instance with its addonTask counter incremented.
curl -s -X POST "$BASE/projects/<projectId>/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page","description":"hero + CTA","moduleInstanceId":"<id>","startDate":"2026-01-05T00:00:00.000Z","dueDate":"2026-01-12T00:00:00.000Z","statusId":"<id>","priorityId":"<id>","assigneeId":"<userId>","position":0}'

# Update ONLY a task's status. Needs the narrow task.status.update permission —
# held by Owner/Admin/Member and the Client role (which lacks full task.update).
curl -s -X PATCH "$BASE/projects/<projectId>/tasks/<taskId>/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"statusId":"<statusId>"}'

# Get a task
curl -s "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update a task
curl -s -X PATCH "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page v2","statusId":"<id>","priorityId":"<id>"}'

# Soft-delete a task
curl -s -X DELETE "$BASE/projects/<projectId>/tasks/<taskId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## incidents (Bearer + x-workspace-slug)

Incidents are **standalone project-level tickets** — they are not tied to a task.

```bash
# Create an incident ticket on a project.
# Needs incident.create — held by Owner/Admin and the Client role.
curl -s -X POST "$BASE/projects/<projectId>/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"title":"Sync fails after go-live","description":"Contacts are not syncing"}'

# List the project's incident tickets (needs project.read)
curl -s "$BASE/projects/<projectId>/incidents" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Get one incident (needs project.read)
curl -s "$BASE/projects/<projectId>/incidents/<incidentId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## comments (Bearer + x-workspace-slug)

```bash
# Comment on a task. Needs comment.create (Owner/Admin/Member/Client).
# mentions: tag other users by email — each must be a member of the workspace,
# otherwise 400 listing the offending emails.
curl -s -X POST "$BASE/projects/<projectId>/tasks/<taskId>/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"Stage order is wrong, please check","mentions":["john@acme.com"]}'

# List comments on a task (needs task.read)
curl -s "$BASE/projects/<projectId>/tasks/<taskId>/comments" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Comment on an incident ticket (same body shape / permissions)
curl -s -X POST "$BASE/projects/<projectId>/incidents/<incidentId>/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"On it — fix lands tomorrow","mentions":["client@customer.com"]}'

# List comments on an incident ticket (needs task.read)
curl -s "$BASE/projects/<projectId>/incidents/<incidentId>/comments" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```
