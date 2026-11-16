# IRPPMS — Local Docker Edition

**Inspector Resource Planning & Productivity Management System**

Self-contained stack: React + Express + SQLite. No third-party cloud services.

## Quick start (local, no Docker)

**Recommended — one command (API + UI):**

```bash
npm install
cd server && cp .env.example .env && npm install && npx prisma db push && npm run db:seed && cd ..
cd app && npm install && cd ..
npm run dev
```

Open http://localhost:5180

**Or two terminals** (both must stay running):

```bash
# Terminal 1 — API (port 4100)
cd server
npm run dev

# Terminal 2 — UI (port 5180)
cd app
npm run dev
```

### Troubleshooting: `http proxy error` / `ECONNREFUSED` on login

The UI proxies `/api` to **http://localhost:4100**. That error means the **API is not running**.

1. Start the API: `cd server && npm run dev` — you should see `IRPPMS API listening on http://localhost:4100`
2. Or use `npm run dev` from the **project root** (starts both API and UI)
3. Verify: open http://localhost:4100/api/health — should return `{"status":"ok","service":"irppms-api"}`

> **Port isolation:** IRPPMS uses **5180** (web) and **4100** (API) so it does not conflict with the contract app on **5173** / **4000**. Auth cookie name is `irppms_token` (not `token`).

### UAT admin

| Email | Role | Password |
|-------|------|----------|
| fahad.mp@applus.com | Admin | ApplusHub2026! |

Add other users (Coordinator / Manager / Inspector) from **Settings** after signing in as Admin. **Admin** is required for inspector Daily CTC / billable, cost history, and the cost report.

UAT sign-in is local email/password. Inspector roster accounts are created only when a work email is known. Entra/Azure AD mapping is documented in `docs/AUTH.md` (no Microsoft login button until that flow is registered).

## Docker — live / other PC (recommended)

Production-style stack for the machine that also runs Training Manager and Contract App. **Does not reseed** on start. Full steps: [`docs/DOCKER-LIVE.md`](docs/DOCKER-LIVE.md).

```bash
cp .env.example .env   # set JWT_SECRET (32+ chars); CORS_ORIGIN if using LAN IP
docker compose up -d --build
```

Open http://localhost:5180 · API health http://localhost:4100/api/health

## Docker — local hot reload (dev only)

**Warning:** reseeds (wipes) the Docker SQLite volume every start. Do not use for UAT data.

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Core flow

1. Coordinator creates job → auto engine proposes inspectors
2. Coordinator or manager assigns inspector → job becomes **Active** immediately
3. Inspector logs activity → marks job finished → timesheet created
4. Coordinator or manager reviews reports → PDF download

## Structure

- `server/` — Express API, Prisma, SQLite, assignment engine, PDF timesheets
- `app/` — React UI (Lovable-inspired styling, pipeline-first)
- `docker-compose.dev.yml` — hot reload dev environment
