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
WORKSPACE_SLUG="demo.workspace"
```

Workspace-scoped routes return **400** if `x-workspace-slug` is missing, **404** if
the slug is unknown, and **403** if you are not an active member.

Seed data (dev): user **`demo.workspace@projectops.com`**, workspace **`demo.workspace`**, OTP **`123456`**.

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
  -d '{"name":"Project Lead","isDefault":false,"permissionCodes":["project.create","workitem.create"]}'

# Update a role
curl -s -X PATCH "$BASE/roles/<roleId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lead","permissionCodes":["project.read","workitem.read"]}'

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

## work-types (Bearer + x-workspace-slug)

Work types classify a work item as a task, incident, bug, or any other category
a workspace defines (`category` is one of `task` | `incident` | `bug`). Every
new workspace is seeded with Task/Incident/Bug by default.

```bash
# List work types
curl -s "$BASE/work-types" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Get one work type
curl -s "$BASE/work-types/<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a work type (category: task|incident|bug)
curl -s -X POST "$BASE/work-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Spike","color":"#8b5cf6","category":"task","isActive":true}'

# Update a work type
curl -s -X PATCH "$BASE/work-types/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'

# Delete a work type
curl -s -X DELETE "$BASE/work-types/<id>" \
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

## work-items (Bearer + x-workspace-slug)

Work items are the unified unit of work — a task, incident, bug, or anything
else defined in `work-types` — replacing the old separate tasks/incidents
split. `workItemTypeId` (optional, from `GET /work-types`) classifies the
item; activity-log entries for it use that type's `category` as `entityType`.

```bash
# List work items in a project
curl -s "$BASE/projects/<projectId>/work-items" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a work item. moduleInstanceId is REQUIRED; workItemTypeId is optional
# (falls back to a generic "task" entityType in the activity log when omitted).
curl -s -X POST "$BASE/projects/<projectId>/work-items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page","description":"hero + CTA","moduleInstanceId":"<id>","workItemTypeId":"<workTypeId>","startDate":"2026-01-05T00:00:00.000Z","dueDate":"2026-01-12T00:00:00.000Z","statusId":"<id>","priorityId":"<id>","assigneeId":"<userId>"}'

# Get a work item
curl -s "$BASE/projects/<projectId>/work-items/<workItemId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Update a work item (any subset of the create fields; reassigning
# `assigneeId` emails the new assignee a "reassigned by <actor>" notice
# instead of the generic "updated" notice everyone else gets)
curl -s -X PATCH "$BASE/projects/<projectId>/work-items/<workItemId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design landing page v2","statusId":"<id>","priorityId":"<id>"}'

# Delete a work item
curl -s -X DELETE "$BASE/projects/<projectId>/work-items/<workItemId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Get a work item's activity log (create/update/comment events, oldest first)
curl -s "$BASE/projects/<projectId>/work-items/<workItemId>/activity" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# On-demand nudge — emails the assignee a reminder (400 if unassigned)
curl -s -X POST "$BASE/projects/<projectId>/work-items/<workItemId>/notify" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

Project owner, assignee, and QA assignee (deduped) get an email on create and
on any update that actually changes a field.

## comments (Bearer + x-workspace-slug)

Comments come in two flavors: standalone workspace comments, and comments on a
specific work item (which also appear in that work item's activity log).

```bash
# --- workspace-wide comments ---

# List all comments in the workspace
curl -s "$BASE/comments" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Create a comment. Needs comment.create. mentions: tag other users by email —
# each must be a member of the workspace, otherwise 400 listing the offending emails.
curl -s -X POST "$BASE/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"Heads up team","mentions":["john@acme.com"]}'

# Edit / delete your own comment
curl -s -X PATCH "$BASE/comments/<commentId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"Heads up team (edited)"}'

curl -s -X DELETE "$BASE/comments/<commentId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# --- comments on a work item ---

# List comments on a work item (needs workitem.read)
curl -s "$BASE/projects/<projectId>/work-items/<workItemId>/comments" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Comment on a work item (needs comment.create)
curl -s -X POST "$BASE/projects/<projectId>/work-items/<workItemId>/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"Stage order is wrong, please check","mentions":["john@acme.com"]}'

# Edit / delete your own comment on a work item
curl -s -X PATCH "$BASE/projects/<projectId>/work-items/<workItemId>/comments/<commentId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-workspace-slug: $WORKSPACE_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"body":"Stage order is wrong, please check (edited)"}'

curl -s -X DELETE "$BASE/projects/<projectId>/work-items/<workItemId>/comments/<commentId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## activity log (Bearer + x-workspace-slug)

```bash
# Timeline for one entity (a work item, or anything else logged against an id),
# oldest first. Matched by entityId alone, so the caller doesn't need to know
# which entityType it is.
curl -s "$BASE/activity/<entityId>" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```

## reports (Bearer + x-workspace-slug)

Computed live from `WorkItem` rows — every breakdown groups by whatever
`WorkType`s the workspace actually has configured, not a fixed task/incident
split.

```bash
# Project report: per-module usage, status/priority matrices, dynamic work-type
# breakdown (byType), overall progress, per-member workload
curl -s "$BASE/projects/<projectId>/reports" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"

# Workspace-wide work-item type + status breakdown
curl -s "$BASE/reports" \
  -H "Authorization: Bearer $TOKEN" -H "x-workspace-slug: $WORKSPACE_SLUG"
```
