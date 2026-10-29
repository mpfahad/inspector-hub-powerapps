# IRPPMS — Technical Overview

Short technical reference for developers and IT. For end-user navigation see `IRPPMS-Staff-User-Guide.md`.

---

## What it is

**IRPPMS** (Inspector Resource Planning & Productivity Management System) is a local UAT web app for planning inspection jobs in Qatar: assign inspectors, track Active → Closed work, certs/QE rules, map, timesheets, and reports.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript, Tailwind, React Router, Leaflet |
| Backend | Express 5, TypeScript (`tsx` in dev) |
| Data | Prisma + SQLite (`server/prisma/dev.db`) |
| Auth | Local email/password → JWT in httpOnly cookie `irppms_token` |

**Repo layout**

- `app/` — SPA (proxies `/api` → API)
- `server/` — REST API, Prisma, assignment engine, PDF timesheets
- `docs/` — guides and change register
- `scripts/` — Word doc generators, etc.

---

## Ports & isolation

| Service | Port |
|---------|------|
| Web UI | **5180** |
| API | **4100** |

Cookie name is **`irppms_token`** (not shared with other apps). Details: `docs/PORTS.md`.

Health check: `GET http://localhost:4100/api/health` → `{ "status": "ok", "service": "irppms-api" }`

---

## Run locally

```bash
# From repo root (API + UI)
npm install
cd server && cp .env.example .env && npm install && npx prisma db push && npm run db:seed && cd ..
cd app && npm install && cd ..
npm run dev
```

Open http://localhost:5180

**Useful server scripts**

| Command | Purpose |
|---------|---------|
| `npm run db:seed` | Full wipe + seed |
| `npm run db:import-roster` | Upsert roster/clients (keep jobs) |
| `npm run db:seed-sample-jobs` | Sample/historical jobs for reports |

Docker: `npm run dev:docker` or `docker compose -f docker-compose.dev.yml up --build`

---

## Roles

| Role | Access |
|------|--------|
| **Inspector** | Own jobs, activity, leave, timesheets |
| **Coordinator / Manager** | Staff menus: jobs, planner, reports (non-cost), map, setup |
| **Admin** | Staff access + inspector CTC/billable + cost report |

Staff = Coordinator + Manager + Admin. Cost fields are stripped from APIs for non-Admin (CM-013).

Demo password: `password123`  
Accounts: `coordinator@` / `manager@` / `admin@irppms.local`

Entra/AD-ready schema (no OIDC button yet): `docs/AUTH.md`

---

## Job workflow (product rules)

1. Create job (**New** = Draft / Proposed)  
2. **Assign** → job + assignment **Active** immediately (no inspector accept)  
3. Optional: job flag **Requires QE-approved inspector** → only `Inspector.qeApproved` may be assigned  
4. Log activity while Active  
5. **Complete** → job **Closed** immediately (no manager approval)

Pipeline stages in UI: **New** (blue) · **Active** (green) · **Completed** (gray)

---

## Architecture (brief)

```
Browser (5180)
    │  cookie: irppms_token
    ▼
Vite / React  ──proxy /api──►  Express API (4100)
                                  │
                                  ▼
                              Prisma → SQLite
```

**Auth:** login sets JWT cookie; middleware reloads user (including role) from DB each request.

**Key server areas**

| Path | Responsibility |
|------|----------------|
| `routes/` | HTTP endpoints (`/api/jobs`, `/api/reports`, `/api/map`, …) |
| `services/jobWorkflow.ts` | Assign / complete / status promotion |
| `services/assignmentEngine.ts` | Rank candidates; geo area warnings |
| `services/authz.ts` | Staff vs inspector scoping; `isAdmin` |
| `middleware/auth.ts` | JWT + `requireRole` |

**Key frontend areas**

| Path | Responsibility |
|------|----------------|
| `pages/` | Screens (Jobs, Planner, Reports, …) |
| `components/jobs/` | Board, map panel, assign, timesheet |
| `lib/api.ts` | Typed API client |
| `context/AuthContext.tsx` | Session |

Map lives on **Jobs** (not a separate nav item). `/map` redirects to `/jobs#map`.

---

## Main API groups

| Prefix | Notes |
|--------|--------|
| `/api/auth` | Login, logout, session |
| `/api/jobs` | CRUD, assign, complete, price, pipeline |
| `/api/map` | Clients + jobs with stage tags for map |
| `/api/reports` | Activity, performance, overdue; **`/costs` Admin only** |
| `/api/inspectors` | Profiles; **cost update Admin only** |
| `/api/planner` | Capacity / conflicts |
| `/api/timesheets` | Generate / PDF |
| `/api/leave`, `/api/competency`, `/api/dashboard`, … | Supporting modules |

Mutating routes generally use Zod validation. Inspectors are scoped to own assignments.

---

## Data highlights (Prisma)

Important entities: `User`, `Inspector`, `Client`, `Job`, `Assignment`, `ActivityLog`, `InspectorCert`, `JobType`, `PriceChart`, `LeaveRequest`, `Timesheet`, `InspectorCostHistory`.

- Money fields often named `*Usd` in schema; UI displays **QAR**  
- Assignment stores **cost snapshot** (`dailyCostUsd` / `dailyBillableUsd`) at assign time  
- Geo: `latitude` / `longitude` on Client (and Job when set)

Schema: `server/prisma/schema.prisma`

---

## Change register

Product changes are logged in `docs/CHANGE-MANAGER.md` (CM-001 … CM-013). Keep stakeholder/staff guides in sync when behaviour changes.

---

## Related docs

| Doc | Audience |
|-----|----------|
| `IRPPMS-Staff-User-Guide.md` / `.docx` | Coordinators & managers |
| `IRPPMS-Stakeholder-Guide.md` | Broader UAT (may lag product) |
| `AUTH.md` | Auth / Entra readiness |
| `PORTS.md` | Ports & isolation |
| `CHANGE-MANAGER.md` | Change history |

---

*UAT build — SQLite local. Not production-hardened for multi-tenant cloud deployment.*
