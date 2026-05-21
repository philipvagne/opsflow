# OpsFlow

A real-time collaborative project management platform inspired by tools like Linear, Jira, and ClickUp.

Built with a modern full-stack architecture using:

* React
* NestJS
* Prisma
* PostgreSQL
* Socket.IO
* JWT Authentication

---

# Features

## Authentication

* JWT-based authentication
* Secure login system
* Protected API routes
* Socket authentication via JWT

---

# Organizations & Projects

* Multi-organization architecture
* Role-based memberships
* Project management system
* Organization scoped permissions

---

# Real-Time Collaborative Kanban

## Task Management

* Create tasks
* Update task statuses
* Delete tasks
* Real-time task synchronization
* Optimistic UI updates

## Kanban Board

* TODO / IN_PROGRESS / DONE workflow
* Instant state updates without refresh
* Live websocket synchronization
* Realtime collaborative state management

---

# Multi-Assignee Collaboration System

## Multi-Assignee Architecture

* Assign multiple users to a task
* Remove assignees instantly
* Real-time collaborative updates
* Normalized websocket event architecture

## Collaborative UI

* Assignee avatar stacks
* Real-time assignee synchronization
* Interactive task modal
* Hover interactions
* Dynamic collaborative task cards

---

# Notification System

## Real-Time Notifications

* Live websocket notifications
* Instant task assignment alerts
* Read/unread state handling
* Notification dropdown system
* Real-time frontend synchronization

---

# Activity Tracking

* Task activity logs
* Status transition tracking
* Audit trail foundation
* Pagination-ready activity architecture

---

# Due Date System

* Optional task due dates
* Backend due date support
* Foundation for overdue engine

---

# Real-Time Architecture

## Websocket Events

The system uses normalized websocket architecture:

### task_updated

Used for:

* status updates
* assignment updates
* future collaborative task mutations

### notification

Used for:

* user alerts
* popups
* notification dropdown sync

This architecture avoids:

* duplicate realtime listeners
* stale frontend state
* unnecessary refetching
* websocket event fragmentation

---

# Tech Stack

## Frontend

* React
* Socket.IO Client
* React Hot Toast

## Backend

* NestJS
* Prisma ORM
* PostgreSQL
* Socket.IO
* JWT Authentication

---

# Database Design

## Core Models

* User
* Organization
* Membership
* Project
* Task
* TaskAssignment
* ActivityLog
* Notification

---

# Realtime Collaboration Features

* Multi-user Kanban synchronization
* Real-time task updates
* Real-time assignment system
* Real-time notifications
* Collaborative UI state management
* Optimistic frontend architecture

---

# Current Development Status

## Completed

* Authentication system
* Organization system
* Project system
* Realtime Kanban board
* Multi-assignee system
* Notification engine
* Activity logging foundation
* Realtime websocket architecture

## In Progress

* Due date visual system
* Overdue task engine
* Activity timeline UI
* Drag & drop Kanban
* User profile avatars

---

# Future Roadmap

* Drag & drop Kanban
* Presence system
* Typing indicators
* Comment threads
* File attachments
* Workspace permissions
* Team analytics
* Task filtering/search
* Calendar views
* AI workflow automation

---

# Architecture Highlights

## Backend Patterns

* Service-based architecture
* DTO validation
* JWT websocket authentication
* Prisma relational modeling
* Real-time event normalization

## Frontend Patterns

* Custom React hooks
* Optimistic UI updates
* Realtime state synchronization
* Component-driven architecture

---

# Local Development

## Backend

```bash
cd apps/api
npm install
npx prisma migrate dev
npm run start:dev
```

## Frontend

```bash
cd opsflow-dashboard
npm install
npm run dev
```

---

# Environment Variables

## Backend (.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/opsflow
JWT_SECRET=your_secret_here
```

---

# Author

Built by Philip Agne
