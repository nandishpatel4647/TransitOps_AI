# 🚛 TransitOps AI

### Enterprise Smart Fleet & Transport Operations Platform

A complete Transport Management System (TMS) that digitizes the entire lifecycle of transport operations — from vehicle registration to trip dispatch, maintenance, fuel tracking, and business intelligence — built for **Odoo Hackathon 2026**.

<p align="left">
  <img src="https://img.shields.io/badge/status-in%20development-orange" alt="status" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="react" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="typescript" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="node" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white" alt="prisma" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="license" />
</p>

---

## 📖 Table of Contents

- [Problem Statement](#-problem-statement)
- [Overview](#-overview)
- [Target Users](#-target-users)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Database Schema](#-database-schema)
- [Business Rules](#-business-rules)
- [Getting Started](#-getting-started)
- [Demo Credentials](#-demo-credentials)
- [Project Structure](#-project-structure)
- [Example Workflow](#-example-workflow)
- [Roadmap](#-roadmap--module-status)
- [Screenshots](#-screenshots)
- [Known Limitations](#-known-limitations)
- [Team](#-team)
- [License](#-license)

---

## 🎯 Problem Statement

Many logistics companies still rely on spreadsheets and manual logbooks to manage transport operations. This leads to scheduling conflicts, underutilized vehicles, missed maintenance, expired driver licenses, inaccurate expense tracking, and poor operational visibility.

**TransitOps AI** replaces the spreadsheet chaos with a single centralized platform that manages the complete lifecycle of transport operations — vehicle registration, driver management, dispatching, maintenance, fuel logging, expense tracking, and analytics — with automated business-rule enforcement and real-time insights.

---

## 🧭 Overview

TransitOps AI is designed to feel like **Power BI meets Odoo** — a modern, data-dense, enterprise-grade ERP experience with a glassmorphism design language, animated KPI dashboards, and role-based workflows for every stakeholder in a fleet operation.

---

## 👥 Target Users

| Role | Responsibility |
|---|---|
| **Fleet Manager** | Oversees fleet assets, maintenance, vehicle lifecycle, and operational efficiency |
| **Dispatcher** | Creates trips, assigns vehicles and drivers, monitors active deliveries |
| **Driver** | Views assigned trips, updates trip status, logs fuel |
| **Safety Officer** | Ensures driver compliance, tracks license validity, monitors safety scores |
| **Financial Analyst** | Reviews operational expenses, fuel consumption, maintenance costs, and profitability |
| **Maintenance Manager** | Manages service records, workshop scheduling, and repair costs |
| **Super Admin** | Full system access and configuration |
| **Viewer** | Read-only access for stakeholders |

---

## ✨ Key Features

### 🔐 Authentication & RBAC
Secure JWT-based login, role-based module visibility, session management, and profile/avatar management.

### 📊 Dashboard
Real-time KPI cards (Fleet Utilization, Active Trips, Vehicles in Maintenance, Revenue, ROI), interactive charts (fleet trends, cost breakdowns, trip completion rates), and a live activity feed.

### 🚚 Vehicle Management
Full vehicle registry with unique registration enforcement, document uploads (Insurance, PUC, Fitness Certificate, Permit), depreciation tracking, and lifecycle status management.

### 👤 Driver Management
Driver profiles with license tracking, automatic expiry alerts, safety scoring, and status-based assignment eligibility.

### 🗺️ Trip Management
End-to-end trip lifecycle (`Draft → Dispatched → Completed / Cancelled`) with automated vehicle/driver status transitions and full validation against business rules.

### ⚡ Smart Dispatch Board
Kanban-style drag-and-drop dispatch board with live availability indicators.

### 🔧 Maintenance Management
Service record tracking with automatic vehicle status changes (`Available ↔ In Shop`).

### ⛽ Fuel & Expense Management
Fuel logs with auto-computed efficiency, categorized expense tracking linked to vehicles, trips, and drivers.

### 📈 Reports & Analytics
Fuel efficiency, fleet utilization, operational cost, and **Vehicle ROI** reports with CSV export.

### 🤖 AI Fleet Assistant
Natural-language chat interface to query live fleet data — *"Which vehicles need maintenance next week?"*, *"Show drivers with expired licenses"*, *"Which vehicle has the lowest ROI?"*

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form, Zod, Recharts, Framer Motion
- **Backend:** Node.js, Express, TypeScript, Zod, JWT, bcrypt, Multer
- **Database & ORM:** SQLite, Prisma ORM
- **Styling & Icons:** Tailwind CSS, Lucide React

---

## 🏗️ System Architecture

```
┌─────────────────────┐      HTTP Requests      ┌───────────────────────────┐
│     Vite React      │ ──────────────────────> │    Node Express Server    │
│  (client, port 5173)│ <────────────────────── │  (server, port 3000)      │
└─────────────────────┘     JWT (httpOnly cookie)     └──────────┬───────────┘
                                                                   │
                                                           Prisma ORM
                                                                   │
                                                        ┌──────────▼───────────┐
                                                        │   SQLite / Postgres   │
                                                        └────────────────────────┘
```

- **Monorepo** with independent `/client` and `/server` packages
- **Stateless auth** via JWT stored in httpOnly, sameSite cookies
- **Transactional business logic** — all status transitions (dispatch, complete, maintenance) run as atomic Prisma transactions to prevent race conditions

---

## 🗄️ Database Schema

| Entity | Description |
|---|---|
| `User` | Login credentials, role, profile, avatar |
| `ActivityLog` | Full audit trail of user actions |
| `Vehicle` | Registry, documents, status, financials |
| `Driver` | Profile, license, safety score, status |
| `Trip` | Lifecycle, cargo, assigned vehicle/driver, timeline |
| `TripStop` | Multi-stop trip legs |
| `MaintenanceLog` | Service records linked to vehicles |
| `FuelLog` | Fuel entries linked to vehicle/driver |
| `Expense` | Categorized costs linked to vehicle/trip/driver |
| `Notification` | System and compliance alerts |

> Full schema definitions live in [`/server/prisma/schema.prisma`](./server/prisma/schema.prisma)

---

## ⚖️ Business Rules

TransitOps AI enforces the following rules at the **database and API level** (not just UI validation):

1. ✅ Vehicle registration numbers must be unique.
2. 🚫 Retired or In Shop vehicles never appear in dispatch selection.
3. 🚫 Drivers with expired licenses or Suspended status cannot be assigned to trips.
4. 🚫 A vehicle or driver already On Trip cannot be assigned to another trip.
5. ⚖️ Cargo weight must not exceed the assigned vehicle's maximum load capacity.
6. 🔄 Dispatching a trip automatically sets both vehicle and driver to `On Trip`.
7. ✔️ Completing a trip automatically restores both to `Available`.
8. ↩️ Cancelling a dispatched trip restores both to `Available`.
9. 🔧 Creating an active maintenance record automatically sets vehicle status to `In Shop`.
10. 🏁 Closing maintenance restores the vehicle to `Available` (unless Retired).

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm or pnpm
- Git

### 1. Clone the repository
```bash
git clone https://github.com/nandishpatel4647/TransitOps_AI.git
cd TransitOps_AI
```

### 2. Backend setup
```bash
cd server
npm install
# Configure environmental values in .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```
Server runs at `http://localhost:3000`

### 3. Frontend setup
```bash
cd ../client
npm install
npm run dev
```
Client runs at `http://localhost:5173`

### 4. Open the app
Navigate to `http://localhost:5173` and log in using any of the [demo credentials](#-demo-credentials) below.

---

## 🔑 Demo Credentials

All seeded accounts use the password: **`demo1234`**

| Role | Email | Permissions / Gating |
|---|---|---|
| **Super Admin** | `superadmin@transitops.ai` | Read/write access to all screens, database logs |
| **Fleet Manager** | `fleetmanager@transitops.ai` | Access to Vehicles, Drivers, Trips, Reports, Logs |
| **Dispatcher** | `dispatcher@transitops.ai` | Access to Vehicles, Trips, Dispatch board |
| **Safety Officer** | `safety@transitops.ai` | Access to Driver profiles, safety scores |
| **Financial Analyst** | `finance@transitops.ai` | Access to Expenses, Reports, ROI analytics |
| **Maintenance Manager** | `maintenance@transitops.ai` | Access to Maintenance logs, shop schedules |
| **Driver** | `driver@transitops.ai` | Access to assigned trips, fuel log entries |
| **Viewer** | `viewer@transitops.ai` | Read-only access across the dashboard metrics |

---

## 📁 Project Structure

```
transitops-ai/
├── client/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # Sidebar, Navbar, shared UI
│   │   ├── context/        # AuthContext, ThemeContext
│   │   ├── pages/          # Login, Dashboard, Vehicles, Drivers, Trips...
│   │   └── App.tsx
│   └── package.json
├── server/                 # Node + Express + TypeScript backend
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── middleware/     # auth.ts (JWT + RBAC)
│   │   ├── routes/
│   │   └── index.ts
│   └── package.json
├── uploads/                 # Vehicle/driver documents, avatars
└── README.md
```

---

## 🔁 Example Workflow

1. Register vehicle `Van-05` — max capacity 500 kg, status `Available`
2. Register driver `Alex` with a valid license
3. Create a trip with cargo weight `450 kg`
4. System validates `450 kg ≤ 500 kg` → dispatch allowed
5. Vehicle and driver status automatically become `On Trip`
6. Complete the trip — enter final odometer and fuel consumed
7. Vehicle and driver automatically return to `Available`
8. Create a maintenance record (e.g., Oil Change) — vehicle automatically becomes `In Shop` and is hidden from dispatch
9. Reports update operational cost and fuel efficiency based on the latest data

---

## 🗺️ Roadmap / Module Status

| # | Module | Status |
|---|---|---|
| 1 | Auth, RBAC & Scaffold | 🟢 Complete |
| 2 | Dashboard | 🟢 Complete |
| 3 | Vehicle Management | 🟢 Complete |
| 4 | Driver Management | 🟢 Complete |
| 5 | Trip Management | 🟡 In Progress |
| 6 | Smart Dispatch Board | ⚪ Planned |
| 7 | Maintenance Management | ⚪ Planned |
| 8 | Fuel & Expense Tracking | ⚪ Planned |
| 9 | Reports & Analytics | ⚪ Planned |
| 10 | Notifications | ⚪ Stretch Goal |
| 11 | AI Fleet Assistant | ⚪ Stretch Goal |
| 12 | Final Polish & Responsive QA | ⚪ Planned |

---

## 🖼️ Screenshots

> _Add screenshots here as modules are completed:_

```md
![Dashboard](./docs/screenshots/dashboard.png)
![Trip Management](./docs/screenshots/trips.png)
![Dispatch Board](./docs/screenshots/dispatch.png)
```

---

## ⚠️ Known Limitations

- Built with SQLite for hackathon speed; schema is Postgres-ready via a single `DATABASE_URL` swap.
- Forgot Password / Email Verification flows are intentionally excluded — seeded demo accounts are used instead.
- AI Assistant uses a lightweight query-matching layer rather than a full LLM integration in the base build.
- File uploads are stored locally (`/uploads`), not on cloud storage, for this build.

---

## 👨‍💻 Team

| Name | Role |
|---|---|
| Nandish Patel | Frontend Developer |
| Krina Suthar | Full Stack Developer |
| Arnob Maity | Full Stack Developer |

---

## 📄 License

This project was built for **Odoo Hackathon 2026** and is provided under the [MIT License](./LICENSE).

---

<p align="center">Built with ⚡ under 8 hours for Odoo Hackathon 2026</p>
