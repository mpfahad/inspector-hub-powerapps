# App Readiness Audit — Inspection Hub / IRPPMS

**Date:** 2026-11-15  
**Mode:** Read-only (no application source/config/schema changes)  
**Scope:** Docker/build, Prisma/DB checkpoints, API surface, UI flows, CM-022–026 consistency  
**Canvas (Cursor IDE):** `C:\Users\fahad.vq\.cursor\projects\d-CURSOR-Inspector-Hub\canvases\app-readiness-audit.canvas.tsx` — open beside chat

---

## Verdict

**Not ready** for Docker export / production-style container packaging.

Current Docker is a **greenfield hot-reload stack** only (`Dockerfile.dev` + compose that **seeds on every start**). There is no production image, no Vite static serve / nginx, and using compose against UAT data would wipe the SQLite volume. Host UAT DB already has CM-022/024/025 schema pieces — upgrade with `db push` only, never seed.

| Question | Answer |
|----------|--------|
| Dev Docker for empty volume? | Conditional go (`npm run dev:docker`) |
| Safe for existing UAT via compose as-is? | **No** — seed destroys data |
| Production container export ready? | **No** |

---

## Severity-tagged findings

| Sev | Finding | Evidence | Impact |
|-----|---------|----------|--------|
| **Blocker** | Compose reseeds every start (`deleteMany` cascade) | `docker-compose.dev.yml` command; `server/prisma/seed.ts` | Wipes UAT / volume data on every `up` |
| **Blocker** | No production Dockerfile / nginx / Vite build serve | Only `app/Dockerfile.dev`, `server/Dockerfile.dev` | Cannot honestly export a prod container |
| **High** | CM-022 ACL is nav/cards only — jobs/ops APIs unscoped | `server/src/routes/departments.ts` filters; `jobs.ts` has no `departmentIds` checks | Restricted users can still see cross-dept data |
| **High** | Settings create-only; `api.updateUser` unused in UI | `SettingsPage.tsx`; no `updateUser(` callers under `app/src` | Cannot revise dept ACL / role after create |
| **High** | `COOKIE_SECURE` / `NODE_ENV=production` without TLS | `server/src/config/security.ts` | Auth cookies fail over plain HTTP |
| **Medium** | CM-024 auto-close only on API startup (no cron) | `server/src/index.ts` → `promoteAssignedJobsToActive` | Overdue jobs stay open until restart |
| **Medium** | `autoCompleteOnEndDate` / `rateBasis` not in `updateJobSchema` | `server/src/lib/schemas.ts` create vs update | Cannot flip CM-024/025 after create via API |
| **Medium** | No Prisma migrations folder — `db push` only | `server/prisma/migrations` absent | Hard to audit schema drift across envs |
| **Medium** | Zod gaps on timesheet generate + inspector cert mutate | `timesheets` / `reference` routes | Weaker input validation |
| **Low** | Reports “Department workload” → `/departments` redirect | `ReportsPage.tsx` `reportCatalog` | Misleading related-page link |
| **Low** | IRPPMS branding leftovers | `api.ts` offline message; `MapPopoutPage.tsx` title | Brand inconsistency vs Inspection Hub |
| **Low** | Orphan `DepartmentsPage.tsx` (unregistered) | Not imported in `App.tsx` | Dead code |
| **Low** | Dead assignment accept/reject (no client methods) | `assignments.ts` vs `api.ts` | Legacy server surface |

**Assumed (not executed):** full `docker compose up --build` on this Windows host; Alpine openssl / Prisma engine; Windows bind-mount EPERM on `prisma generate`.

---

## 1. Docker / deploy readiness

### Inventory (verified)

| Artifact | Path | Notes |
|----------|------|--------|
| Compose | `docker-compose.dev.yml` | `name: irppms`; ports **4100** / **5180** |
| API image | `server/Dockerfile.dev` | `node:22-alpine`; single-stage; `npm install` then `COPY .` |
| Web image | `app/Dockerfile.dev` | Vite `--host 0.0.0.0 --port 5180` |
| Root scripts | `package.json` | `dev`, `dev:docker`, `db:seed`, `db:push` |
| Prod Dockerfile | **None** | |
| nginx / reverse proxy | **None** | Vite proxy only (`app/vite.config.ts`) |
| `.dockerignore` | **None** | |

### Runtime wiring (verified)

- **API:** `DATABASE_URL=file:/data/irppms.db`, `JWT_SECRET` hardcoded in compose, `CORS_ORIGIN=http://localhost:5180`, `credentials: true` (`server/src/index.ts`).
- **Cookie:** `irppms_token`, httpOnly, sameSite lax; secure when `COOKIE_SECURE` or production (`server/src/config/security.ts`).
- **Web:** `IRPPMS_API_URL=http://api:4100`; client `credentials: 'include'`, relative `/api` (`app/src/lib/api.ts`).
- **Volume:** `irppms-data` → `/data`.
- **Compose command (critical):** `npx prisma db push && npx tsx prisma/seed.ts && npm run dev` — **seed always runs**.

### What “export to Docker” would require

1. Multi-stage Dockerfiles: API `tsc` + web `vite build`.
2. Static serve or nginx same-origin proxy (replace Vite-dev proxy).
3. Startup order: `prisma generate` → `db push` (or real migrations) → **optional** seed → `node dist` / static serve.
4. Named SQLite volume; **never** wipe-seed on UAT.
5. Inject secrets (`JWT_SECRET` 32+); real `CORS_ORIGIN`.
6. Add `.dockerignore`; avoid host Windows paths inside images.

### Container break risks

| Issue | Severity |
|-------|----------|
| Seed-on-start wipes volume | Blocker |
| No prod build/serve path | Blocker |
| Production Secure cookies over HTTP | High |
| Fragile install-before-COPY (generate timing) | Medium |
| Alpine Prisma native binary (assumed) | Medium |
| Windows bind mounts + hot reload (assumed) | Medium |
| Docs path `server/prisma/dev.db` vs actual nested `server/prisma/prisma/dev.db` | Low |

---

## 2. Database / Prisma migration checkpoints

### Mode (verified)

- Provider: **SQLite**
- Migrations folder: **absent** — workflow is **`prisma db push`**
- Seed: destructive full wipe then demo data (`server/prisma/seed.ts`)
- CM fields in schema: `UserDepartmentAccess`; `Job.autoCompleteOnEndDate` (default true); `Job.rateBasis` (default `"day"`)
- Host UAT file `server/prisma/prisma/dev.db`: **PRAGMA verified** — those columns/table already present
- Startup hooks (`server/src/index.ts`): `promoteAssignedJobsToActive()` (includes `autoCloseJobsPastEndDate`) + `applyProductDefaults()`

### A) Fresh container (empty `/data/irppms.db`)

| # | Checkpoint | Success signal | Common failure |
|---|------------|----------------|----------------|
| 1 | Image build | `compose --build` exit 0 | npm install / Alpine engine fail |
| 2 | Volume writable | SQLite under `/data` | Permission denied |
| 3 | `prisma generate` (via push) | Client matches schema | **EPERM** locking `query_engine*.node` (Windows) |
| 4 | `db push` | Tables incl. `UserDepartmentAccess`; Job new cols | Wrong `DATABASE_URL` |
| 5 | Seed (intentional only) | Demo logins work | Unique constraint / partial seed |
| 6 | `GET :4100/api/health` | `{"status":"ok","service":"irppms-api"}` | Port bind / crash |
| 7 | Startup hooks | No “Failed to promote/apply” logs | Missing columns → Prisma errors |
| 8 | Web login via proxy | Cookie; `/api/auth/me` OK | `IRPPMS_API_URL=localhost` inside container |

### B) Existing UAT SQLite — **never seed**

| # | Checkpoint | Success signal | Common failure |
|---|------------|----------------|----------------|
| 1 | Backup `*.db` (+ journal) | Copy retained | Overwrite without backup |
| 2 | Point `DATABASE_URL` at UAT file | Absolute path preferred in container | Relative → nested `prisma/prisma` path |
| 3 | `npx prisma db push` **only** | Cols/tables added; data retained | Someone runs seed / `migrate reset` |
| 4 | Column/table check | `autoCompleteOnEndDate`, `rateBasis`; `UserDepartmentAccess` | Client/schema mismatch → 500s |
| 5 | Restart API **without seed** | Health OK; hooks run | **Current compose command wipes UAT** |
| 6 | Smoke CM-022 | Settings user dept access works | Missing table |
| 7 | Smoke CM-024 | Past-end flagged jobs close on restart | Wrong defaults / missing column |
| 8 | Smoke CM-025 | New job day/hourly persists `rateBasis` | UI/API drift |

| Scenario | Safe sequence | Unsafe |
|----------|---------------|--------|
| Fresh container | push → seed → start | — |
| Existing UAT | push → start (**skip seed**) | Compose command as-is; `db:reset` |

---

## 3. API surface audit

**Auth model:** Cookie JWT `irppms_token` (+ optional Bearer); role reloaded from DB. Public: `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/logout`. Domain routers use `authMiddleware`. `/api/users` is **Admin-only**. There is **no** `/api/settings` — Settings UI uses users + departments.

### Alignment summary

| Area | Server | Client (`api.ts`) | Notes |
|------|--------|-------------------|-------|
| Auth / health | login, logout, me, health | OK | Login rate-limited |
| Jobs | list, detail, create, update, price, submit, cancel, assign, remove, complete, pipeline, duplicates, candidates | OK | Create has CM-024/025; **update omits them** |
| Assignments | mine, accept, reject | mine only | accept/reject orphaned |
| Users | Admin CRUD | methods exist | UI create-only |
| Departments | list + overview (ACL filtered) | OK | Main server-side ACL enforcement |
| Planner / leave / reports / map / price-chart / competency | Mounted | Mostly OK | `GET /reports/inspector-performance` server-only |
| Timesheets | generate, preview, PDF URLs | OK paths | Generate lacks Zod |
| Reference | clients, inspectors, certs | OK | Cert mutate lacks Zod schemas |

### Zod on mutating routes

**Strong:** login, users, job create/update/price/cancel/assign/complete, clients, job types, leave create/update, price chart, inspector create/costs/QE.

**Gaps:** timesheet generate; inspector cert POST/PUT (manual parse); several no-body action routes (submit, remove, leave approve, notification read).

---

## 4. UI / button / flow walkthrough (static)

| Screen | Primary action → API | Outcome / gap |
|--------|----------------------|---------------|
| Login / logout | `api.login` / `api.logout` | Working |
| Dashboard dept cards | `departmentsOverview` → `/d/:code/jobs` | ACL-filtered overview |
| Settings users | `users` + `createUser` (+ `departmentIds`) | **Create-only**; non-Admin sees ask-admin |
| New Job CM-024/025 | `createJob` with toggles | Wired; badges on detail |
| Job detail | assign / complete / cancel | Working |
| Inspectors list / detail | inspectors + pipeline; cert CRUD | CM-026 layout present |
| Planner | `planner` | Booked hours (CM-023) |
| Leave / Clients / Competency / Reports | respective APIs | Reports catalog has misleading `/departments` link |
| Branding | “Inspection Hub” in shell/login/dashboard | IRPPMS leftovers in offline msg / map title |

**Dead / soft-dead:** orphan `DepartmentsPage.tsx`; planned inactive report cards; assignment accept/reject never called from UI.

---

## 5. CM-022–026 residual risk

| CM | Claimed (CHANGE-MANAGER) | Code status | Residual |
|----|--------------------------|-------------|----------|
| **022** | Brand, home cards, Settings, user dept access | Brand/nav/Settings create OK | ACL display-only; no edit UI; APIs unscoped |
| **023** | Planner booked hours | Present | Low |
| **024** | `autoCompleteOnEndDate` + startup close | Schema + create + startup hook | No request-time sweep; not updatable after create |
| **025** | Single/Team + Day/Hourly + `rateBasis` | JobNewPage + TeamSlotsEditor | Not updatable; hourly amounts use `dayRateUsd` field |
| **026** | Inspector detail reorder + expand certs | InspectorDetailPage | UI-only; low risk |

---

## 6. Prioritized post-audit fix list (do not implement here)

1. **Split compose startup:** push-only vs optional one-shot seed (stop wiping volumes).
2. **Add production Dockerfiles** + static/nginx serve path; drop Vite-dev from export images.
3. **Enforce `departmentIds` on jobs / planner / reports / ops APIs** (complete CM-022).
4. **Wire Settings edit user** (`updateUser` + ACL / role / password reset).
5. **CM-024:** request-time or scheduled sweep; optional fields on job update.
6. **CM-025:** allow `rateBasis` update; clarify hourly vs `dayRateUsd` storage.
7. Introduce real Prisma migrations (or documented push runbooks) per environment.
8. Clean IRPPMS user-visible strings; fix Reports → `/departments` link.
9. Add Zod to timesheet generate + inspector cert mutations.
10. Document Secure-cookie / TLS requirements for any “production” `NODE_ENV`.

---

## What could not be verified without a running container

- Full `docker compose -f docker-compose.dev.yml up --build` success on this Windows host
- Alpine openssl / Prisma engine download inside images
- Bind-mount hot-reload stability
- Cookie Secure behavior under `NODE_ENV=production`
- Actual count of UAT jobs that would auto-close on API restart
- End-to-end login through container networking
- Schema drift between Docker volume DB and host `dev.db`

---

## DB readiness recheck (2026-11-16)

Ran `server/scripts/check-db-readiness.ts` against host UAT SQLite (`file:./prisma/dev.db`).

| Checkpoint (audit §2B) | Result |
|------------------------|--------|
| `Job.autoCompleteOnEndDate` | Present |
| `Job.rateBasis` | Present |
| `UserDepartmentAccess` table | Present |
| Primary Admin `fahad.mp@applus.com` | Present (Admin) |
| Sample job fields readable | `autoCompleteOnEndDate: true`, `rateBasis: "day"` |
| Users / ACL rows | 23 users; 10 dept-access rows |

**Host DB schema: ready** for CM-022/024/025/027 features (push already applied; do **not** re-seed).

**Still not Docker-export ready via `docker-compose.dev.yml`** (seed-on-start wipe). **CM-029 (2026-11-16):** use live [`docker-compose.yml`](../docker-compose.yml) + prod Dockerfiles + [`DOCKER-LIVE.md`](./DOCKER-LIVE.md) for the other PC — no seed on start. Post-audit note: Settings edit/bulk/reset passwords are implemented (CM-027).

---

*Original audit was read-only. Recheck + later product changes are logged in `CHANGE-MANAGER.md`.*
