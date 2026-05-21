# OpsFlow

OpsFlow is a real-time collaborative project management platform inspired by Linear, Jira, and ClickUp.

The application is built as a full-stack workspace with a NestJS API, Prisma/PostgreSQL database layer, React dashboard, JWT authentication, Socket.IO realtime updates, task assignment, task progress updates, due dates, and notification workflows.

---

## Tech Stack

### Frontend

* React
* Vite
* Axios
* Socket.IO Client
* React Hot Toast

### Backend

* NestJS
* Prisma ORM
* PostgreSQL
* Socket.IO
* JWT Authentication

---

## Project Structure

```txt
opsflow/
|-- apps/
|   `-- api/                 # NestJS backend
|       |-- prisma/          # Prisma schema and migrations
|       `-- src/             # API modules
|-- opsflow-dashboard/       # React frontend
|-- docker-compose.yml       # Local PostgreSQL service
`-- README.md
```

---

## Current Features

### Authentication

* User signup with full name, username, email, and password
* Signup creates only the user account
* New users can exist without an organization immediately after signup
* User login with JWT token response
* Protected backend routes
* Socket authentication through JWT
* Frontend login/signup UI with validation and loading states
* Logout flow that clears the stored token

### Organizations And Projects

* Organization and membership models are still part of the system
* Organization creation and joining are separate from authentication
* Existing organization members can create and view projects
* Organization membership scopes project access, task access, task updates, and user search
* A dedicated organization onboarding, join, or invite flow is planned as a future dashboard feature

### User Identity Foundation

* `GET /users/me` returns the logged-in user's public profile
* `GET /users/search?q=` searches users by username, full name, or email
* User search is scoped to users who share an organization
* Search responses return only `id`, `email`, `username`, and `fullName`
* Password hashes and unnecessary user fields are never exposed

### Task Management

* Create tasks inside projects
* Update task title, description, status, and due date
* Move tasks freely between `TODO`, `IN_PROGRESS`, and `DONE`
* Delete tasks
* Fetch only tasks assigned to the current user through `TaskAssignment`
* Activity logs are created for task status changes
* Due dates can be added, changed, or cleared from the task modal
* Overdue tasks are visually highlighted in the frontend when not complete

### Realtime Kanban

* Kanban columns for `TODO`, `IN_PROGRESS`, and `DONE`
* Realtime task updates through `task_updated`
* Task cards update assignment avatars and due dates in realtime
* Open task modal stays synchronized with live task data
* When the current user is removed from a task, the card disappears instantly and remains gone after refresh

### Multi-Assignee System

* Assign multiple users to one task
* Remove assignees from a task
* Assignment still supports raw user IDs
* Assignment UI also supports same-organization user search
* Assignment and removal emit realtime task updates to authorized users
* Assignment and removal create database notifications and websocket alerts

### Task Progress Updates

* Task modal includes a simple progress update timeline
* Users can post written task updates such as blockers, review notes, and completed work
* Progress updates are stored in a separate `TaskUpdate` model
* Updates include author identity and creation time
* Updates are delivered in realtime through `task_update_created`
* Progress update notifications are sent to assigned users except the author

### Notifications

* Realtime popup notifications through Socket.IO
* Notification dropdown with read/unread state
* Assignment notifications
* Removal/unassignment notifications
* Task status change notifications
* Task progress update notifications
* Due date added, changed, and cleared notifications
* Mark single notifications as read
* Mark all notifications as read
* Delete read notifications
* Unread notifications cannot be deleted

---

## Realtime Architecture

OpsFlow uses separate websocket events for task state, user alerts, and progress updates.

### `task_updated`

Used for Kanban and task state synchronization:

* status changes
* due date changes
* assignment changes
* avatar stack updates
* open task modal synchronization
* removing cards when the current user is no longer assigned

`task_updated` events are emitted to authorized user rooms instead of being broadcast globally.

### `task_update_created`

Used for user-written progress updates:

* appends a new progress update to an open task modal
* keeps collaborators viewing the same task in sync
* is scoped to authorized organization members

### `notification`

Used for user-facing alerts:

* toast popups
* notification dropdown updates
* assignment alerts
* unassignment alerts
* status change alerts
* due date alerts
* progress update alerts

The frontend keeps notification handling in `Dashboard.jsx`. `socket.js` only creates the socket connection.

---

## Database Models

Core Prisma models:

* User
* Organization
* Membership
* Project
* Task
* TaskAssignment
* TaskUpdate
* ActivityLog
* Notification

`TaskUpdate` is separate from `ActivityLog` because it stores user-written collaboration updates. `ActivityLog` remains the foundation for system-generated audit history.

---

## API Overview

### Auth

```txt
POST /auth/register
POST /auth/login
GET  /auth/me
GET  /auth/admin
```

### Users

```txt
GET /users/me
GET /users/search?q=
```

### Organizations

```txt
POST /organizations
GET  /organizations/:orgId
POST /organizations/:orgId/members
```

### Projects

```txt
POST /organizations/:orgId/projects
GET  /organizations/:orgId/projects
GET  /projects/:projectId
```

### Tasks

```txt
POST   /organizations/:orgId/projects/:projectId/tasks
GET    /projects/:projectId/tasks
GET    /tasks/my
PATCH  /tasks/:taskId
DELETE /tasks/:taskId
PATCH  /tasks/:taskId/assign
DELETE /tasks/:taskId/assign/:assigneeId
GET    /tasks/:taskId/activity
GET    /tasks/:taskId/updates
POST   /tasks/:taskId/updates
```

### Notifications

```txt
GET    /tasks/notifications
PATCH  /notifications/:id/read
DELETE /notifications/:id
PATCH  /tasks/notifications/mark-all-read
```

---

## Notification Types

Current notification types include:

```txt
TASK_ASSIGNED
TASK_UNASSIGNED
TASK_STATUS_CHANGED
TASK_UPDATE_POSTED
TASK_DUE_DATE_ADDED
TASK_DUE_DATE_CHANGED
TASK_DUE_DATE_CLEARED
```

Progress update and due date notifications are sent only to assigned users, excluding the user who performed the action.

---

## Local Development

### 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d
```

The database runs on:

```txt
localhost:5432
```

Default local credentials from `docker-compose.yml`:

```txt
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=opsflow
```

### 2. Backend Setup

```bash
cd apps/api
npm install
```

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/opsflow
JWT_SECRET=your_secret_here
PORT=3000
```

Run migrations and start the backend:

```bash
npx prisma migrate dev
npm run start:dev
```

Backend URL:

```txt
http://localhost:3000
```

### 3. Frontend Setup

```bash
cd opsflow-dashboard
npm install
npm run dev
```

Frontend URL:

```txt
http://localhost:5173
```

---

## Useful Commands

### Backend

```bash
cd apps/api
npm run build
npm run test
npx prisma studio
```

### Frontend

```bash
cd opsflow-dashboard
npm run build
npm run lint
```

---

## Manual Testing Checklist

### Authentication

1. Open the frontend.
2. Create an account with full name, username, email, and password.
3. Confirm login redirects to the dashboard.
4. Confirm the new user can have zero organizations without crashing the dashboard.
5. Logout and log back in.
6. Try invalid credentials and confirm a readable error appears.

### User Search And Assignment

1. Register two users.
2. Create an organization or use an existing organization.
3. Add one user to the other's organization through `POST /organizations/:orgId/members`.
4. Open a task modal.
5. Search by username, full name, or email.
6. Assign the searched user.
7. Confirm the assigned user receives a popup and dropdown notification.
8. Confirm avatars update in realtime.

### Realtime Removal

1. Open a task assigned to the current user.
2. Remove the current user from the task.
3. Confirm the card disappears instantly.
4. Refresh the page and confirm the card stays gone.
5. Remove another user while the current user remains assigned.
6. Confirm the card stays visible and avatars update.

### Status Notifications

1. Assign users to a task.
2. Move the task between any status columns, including `DONE` back to `TODO`.
3. Confirm assigned users receive status change notifications.
4. Confirm the Kanban board and open task modal stay synchronized.

### Due Dates

1. Open a task modal.
2. Add a due date.
3. Confirm assigned users except the actor receive a due date added notification.
4. Change the due date.
5. Confirm assigned users except the actor receive a due date changed notification.
6. Clear the due date.
7. Confirm assigned users except the actor receive a due date cleared notification.
8. Refresh and confirm the persisted due date state is correct.
9. Set a past due date on an incomplete task and confirm the overdue visual state appears.

### Task Progress Updates

1. Open a task modal.
2. Post a progress update.
3. Confirm the update appears in the timeline immediately.
4. Open the same task as another authorized organization member.
5. Post another update and confirm it appears in realtime.
6. Confirm assigned users except the author receive a popup and dropdown notification.
7. Confirm unauthorized users cannot fetch or post task updates.

### Notification Deletion

1. Receive or create a notification.
2. Mark it as read.
3. Delete it from the dropdown.
4. Refresh and confirm it stays deleted.
5. Confirm unread notifications do not show a delete button and cannot be deleted by the API.

---

## Current Development Status

### Completed

* Authentication and signup/login UI
* JWT-protected API routes
* Organization and membership foundation
* Signup without automatic organization creation
* Project management foundation
* User identity endpoints
* Same-organization user search
* Task assignment and multi-assignee support
* Realtime Kanban synchronization
* Realtime notification system
* Open modal realtime synchronization
* Task activity log foundation
* Due date UI and backend support
* Due date notifications
* Task progress update timeline
* Realtime task progress updates
* Progress update notifications
* Read notification deletion

### In Progress / Next Improvements

* Dedicated invite flow
* Organization onboarding after signup
* Richer profile and avatar UI
* Drag and drop Kanban
* File attachments
* Task filtering and search
* Calendar views
* Presence indicators
* Analytics dashboard

---

## Author

Built by Philip Agne.
