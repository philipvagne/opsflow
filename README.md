# OpsFlow

OpsFlow is a real-time collaborative project management platform inspired by Linear, Jira, and ClickUp.

The application is built as a full-stack workspace with a NestJS API, Prisma/PostgreSQL database layer, React dashboard, JWT authentication, Socket.IO realtime updates, task assignment, and notification workflows.

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
* User login with JWT token response
* Protected backend routes
* Socket authentication through JWT
* Frontend login/signup UI with validation and loading states
* Logout flow that clears the stored token

### Organizations And Projects

* Users can exist without an organization immediately after signup
* Organization creation and joining are handled separately from authentication
* Members can create and view projects inside organizations
* Organization membership is used to scope access and user search

### User Identity Foundation

* `GET /users/me` returns the logged-in user's public profile
* `GET /users/search?q=` searches users by username, full name, or email
* User search is scoped to users who share an organization
* Search responses never expose password hashes or unnecessary user fields

### Task Management

* Create tasks inside projects
* Update task status
* Delete tasks
* Optional due date support in the backend
* Fetch only tasks assigned to the current user through `TaskAssignment`
* Activity log foundation for task status changes

### Realtime Kanban

* Kanban columns for `TODO`, `IN_PROGRESS`, and `DONE`
* Realtime task updates through `task_updated`
* Task cards update assignment avatars in realtime
* Open task modal stays synchronized with live task data
* When the current user is removed from a task, the card disappears instantly and remains gone after refresh

### Multi-Assignee System

* Assign multiple users to one task
* Remove assignees from a task
* Assignment still supports raw user IDs
* Assignment UI also supports same-organization user search
* Assignment and removal emit realtime task updates to authorized users

### Notifications

* Realtime popup notifications through Socket.IO
* Notification dropdown with read/unread state
* Assignment notifications
* Removal/unassignment notifications
* Task status change notifications
* Mark single notifications as read
* Mark all notifications as read

---

## Realtime Architecture

OpsFlow uses two websocket event types with separate responsibilities.

### `task_updated`

Used for Kanban and task state synchronization:

* status changes
* assignment changes
* avatar stack updates
* open task modal synchronization
* removing cards when the current user is no longer assigned

`task_updated` events are emitted to authorized user rooms instead of being broadcast globally.

### `notification`

Used for user-facing alerts:

* toast popups
* notification dropdown updates
* assignment alerts
* unassignment alerts
* status change alerts

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
* ActivityLog
* Notification

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
```

### Notifications

```txt
GET   /tasks/notifications
PATCH /notifications/:id/read
PATCH /tasks/notifications/mark-all-read
```

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
4. Logout and log back in.
5. Try invalid credentials and confirm a readable error appears.

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
2. Change the task status.
3. Confirm assigned users receive status change notifications.
4. Confirm the Kanban board and open task modal stay synchronized.

---

## Current Development Status

### Completed

* Authentication and signup/login UI
* JWT-protected API routes
* Organization and membership foundation
* Project management foundation
* User identity endpoints
* Same-organization user search
* Task assignment and multi-assignee support
* Realtime Kanban synchronization
* Realtime notification system
* Open modal realtime synchronization
* Task activity log foundation
* Backend due date support

### In Progress / Next Improvements

* Dedicated invite flow
* Organization onboarding after signup
* Richer profile and avatar UI
* Drag and drop Kanban
* Comments
* File attachments
* Task filtering and search
* Calendar views
* Presence indicators
* Analytics dashboard

---

## Author

Built by Philip Agne.
