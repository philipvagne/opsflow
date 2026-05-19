# OpsFlow

A scalable SaaS-style backend system built with modern backend engineering practices.  
This project focuses on real-world architecture: multi-tenancy, authentication design, and modular backend structure.

---

## 🚀 Tech Stack

- Backend: NestJS (TypeScript)
- Database: PostgreSQL
- ORM: Prisma
- Infrastructure: Docker
- Architecture: Monorepo

---

## 🧱 Project Structure
opsflow/
├── apps/
│ └── api/ # NestJS backend application
├── prisma/ # Prisma schema and migrations
├── docker-compose.yml # PostgreSQL container setup
├── package.json
└── README.md


---

## ⚙️ Features Implemented

### Backend Infrastructure
- NestJS application initialized
- Modular backend structure
- TypeScript configuration
- Development environment with hot reload

### Database Layer
- PostgreSQL running via Docker
- Prisma ORM configured
- Migration system enabled
- Schema-driven database design

### Core Domain Models (Foundation)
- User
- Organization
- Membership (multi-tenant relationship + RBAC structure)

### Developer Tools
- Prisma Studio (database UI)
- Prisma Migrations
- Docker-based local environment

---

## 🧠 Architecture Overview

This project is designed to simulate a real SaaS backend system.

### Core Principles:
- Multi-tenant architecture (Organizations)
- Role-based access control (RBAC)
- Separation of concerns (modules/services)
- Scalable backend structure
- Infrastructure-as-code (Docker)

---

## 🗄️ Database Design (Core Models)

### User
Represents an application user with authentication credentials.

### Organization
Represents a workspace or tenant in the system.

### Membership
Links users to organizations with roles:
- OWNER
- ADMIN
- MEMBER
- VIEWER

This enables multi-tenant SaaS behavior.

---

## 📦 Setup Instructions

### 1. Start Database (Docker)

```bash
docker compose up -d
