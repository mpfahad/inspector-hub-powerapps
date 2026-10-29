# IRPPMS Change Manager

Living register of change requests for **Inspector Resource Planning & Productivity Management System (IRPPMS)**.

## How to use

- Add new rows at the **bottom** of the table (do not renumber existing IDs).
- **ID format:** `CM-###` (e.g. `CM-003`) — permanent reference for discussion, planning, and implementation.
- **Date raised:** when the request was logged.
- **Implemented change summary:** fill in when work is done; start the entry with the **implementation date** (e.g. `2026-09-15: …`).
- Keep stakeholder docs and UAT checklists in sync when a change is implemented.

### Status values

| Status | Meaning |
|--------|---------|
| **Under review** | Logged; impact and approach not yet agreed |
| **Approved** | Agreed; ready to plan or implement |
| **In progress** | Development or documentation update underway |
| **Implemented** | Delivered; summary recorded |
| **Deferred** | Accepted but not scheduled |
| **Rejected** | Will not be implemented |

---

## Change register

| ID | Date raised | Change requested | Requester | Status | Implemented change summary |
|----|-------------|------------------|-----------|--------|----------------------------|
| CM-001 | 2026-09-02 | Remove inspector assignment acceptance: when a coordinator or manager assigns an inspector, the job becomes **Active** immediately (no accept/decline step). Update pipeline, dashboard, reports, and documentation accordingly. | Stakeholder | Implemented | 2026-09-14: Assign sets job and assignment to **Active** immediately (no accept/decline). Pipeline, dashboard, and stakeholder guide treat leftover PendingAcceptance as Active; startup promotion migrates old rows. |
| CM-002 | 2026-09-02 | Remove manager approval for completed jobs: when an inspector or coordinator marks a job complete, the job is **closed** immediately (no pending-approval stage). Update pipeline, dashboard, reports, and documentation accordingly. | Stakeholder | Implemented | 2026-09-14: Mark complete closes the job immediately (no manager-approval / Completed holding stage). Pipeline and stakeholder guide already show complete → Closed; leftover Completed rows are promoted to Closed on API start. |
| CM-003 | 2026-09-14 | Security rebuild: close inspector API data leaks (jobs, profiles, planner, operations KPIs), Entra/AD-ready identity (nullable password, `externalSubject`, `Inspector.userId`), activity-log assignment check, Zod on mutating routes, inspector leave pending staff approval, logout cookie flags. Stay on SQLite UAT. | Internal (security audit) | Implemented | 2026-09-14: Inspector APIs scoped to own jobs/assignments/activity; staff keep full access. User identity fields and `services/identity.ts` added for future Entra OIDC (same `irppms_token` cookie). Activity logs require an active assignment. Inspector-created leave is Pending until staff approve. Logout clears cookie with matching sameSite/secure. See `docs/AUTH.md`. |
| CM-004 | 2026-09-14 | One Activity report on Reports (staff): period filter showing who logged hours/narrative on which jobs. Not a second competing reports product — a single activity view on Reports. | Stakeholder | Implemented | 2026-09-14: Staff Reports includes an Activity section (`GET /api/reports/activity`) with period filter, hours, narrative, inspector, and job. Existing performance/overdue views remain; no separate reports app. |
| CM-005 | 2026-09-14 | Periodic employee cost updates: staff (Coordinator/Manager/Admin) can edit inspector Daily CTC (USD) and Daily billable (USD) on inspector detail. Keep a simple cost history (date, cost, billable, who changed) so past jobs are not silently rewritten. Current values drive new work. | Stakeholder | Implemented | 2026-09-14: Inspector detail lets staff edit Daily CTC and Daily billable. `InspectorCostHistory` records date, cost, billable, and who changed. **Visibility narrowed by CM-013** (Admin-only view/edit + assignment rate snapshot + cost report). |
| CM-006 | 2026-09-14 | Job certificate basics visible on job board cards, job list, and job detail: required certs in plain language (code + name, mandatory vs optional, inspector holds / missing / expiring). Reuse Job.certRequirements + job type certs vs assigned InspectorCerts. | Stakeholder | Implemented | 2026-09-14: Jobs list, board cards, and detail show required certs (code + name, mandatory/optional) and hold/missing/expiring against the assigned inspector’s certifications. Falls back to job-type certs when the job has none. |
| CM-007 | 2026-09-14 | Per-job QE approval to select inspector. Toggle **QE must approve inspector** on the job (not job type only). If false: assign → Active immediately (CM-001). If true: coordinator can pick inspector but job is not Active until Manager/Admin (labelled QE) approves. Inspector cannot log hours until approved. Do not restore inspector accept/reject. | Stakeholder | Superseded | 2026-09-14: Original post-assign Manager QE workflow. **Superseded by CM-010** — QE approved is an inspector profile property, not a post-assign step. |
| CM-008 | 2026-09-14 | Geospatial: lat/lng on Client (and Job when useful). Staff Leaflet map of clients and open jobs (no Google key). Seed/geocode sample clients. Assignment engine warns if candidate already has an overlapping/active job in the same area (~50 km or same city/location string). Warning only — do not hard-block. | Stakeholder | Implemented | 2026-09-14: Clients (and jobs) store lat/lng; sample clients geocoded from location strings. Staff Map nav uses Leaflet/OSM. Assignment suggestions warn when the inspector already has overlapping work in the same area (~50 km or matching location text). |
| CM-009 | 2026-09-14 | Job pricing / price chart: staff-editable default price by job type and/or global default (USD). On assign, copy default onto the job (`agreedPriceUsd`); coordinator can edit at assign and at complete (before close). Show price on job detail. Keep inspector CTC/billable separate. | Stakeholder | Implemented | 2026-09-14: Price chart (global default + per job type) is staff-editable. Assign copies the default onto `Job.agreedPriceUsd` (editable at assign and at complete). Job detail shows agreed price; inspector daily CTC/billable stay separate. |
| CM-010 | 2026-09-15 | **Correction to CM-007:** QE approved is an **inspector** status (`Inspector.qeApproved`, default false), set on profile create/edit — not a post-assign Manager approval of a specific assignment. Job keeps **Requires QE-approved inspector** (`requiresQeApproval`). If off: any eligible inspector → Active immediately (CM-001). If on: only `qeApproved=true` inspectors may be assigned (hard block otherwise); suggestions filter/warn. Remove Proposed-until-QE-approve workflow and hours blocked until that. No inspector accept/reject. | Stakeholder | Implemented | 2026-09-15: Added `Inspector.qeApproved`; removed `Job.qeApprovedAt` / `qeApprovedByEmail` and `/qe-approve`. Assign always → Active when allowed; engine blocks non–QE-approved for flagged jobs. Staff toggle on inspector detail/list; job form copy updated. Seed marks first 3 roster inspectors QE-approved for UAT. |
| CM-011 | 2026-09-16 | Sign out in app shell; display currency **QAR** (not USD/$); Qatar-only demo locations and map default (Leaflet/OSM centered on Qatar). | Stakeholder | Implemented | 2026-09-16: Sidebar **Sign out** calls `POST /api/auth/logout` and clears session to login. UI money labels/formatting use QAR (`formatMoney`). Sample clients/geocode remapped to Doha, Ras Laffan, Mesaieed, Al Khor; Map opens on Qatar (~25.3, 51.5). Schema `*Usd` fields unchanged. |
| CM-012 | 2026-09-20 | Import real Applus qualification-matrix roster (17 inspectors: emp no, email, QP→QE, certs, academic level) and 10 Qatar clients with geocodes; replace demo US/old roster names; inspector local logins. | Stakeholder | Implemented | 2026-09-20: Roster + cert catalog in `inspectorRoster.ts`; `highestQualification` on Inspector; upsert via `npm run db:import-roster` (prefer over full seed wipe). QP Approved Inspector → `qeApproved`; QP Trainer alone does not. Placeholder cert dates 2024-01-01→2029-01-01. 10 Qatar clients geocoded. See `docs/INSPECTOR-ROSTER-DATA-REQUEST.md`. |
| CM-013 | 2026-09-20 | Admin-only inspector costing: only Admin may view/edit Daily CTC, Daily billable, and cost history; add Admin cost/margin report; snapshot rates onto Assignment at assign so past jobs are not rewritten when rates change. Coordinators keep commercial job price / price chart. Ensure Admin UAT login. | Stakeholder | Implemented | 2026-09-20: Supersedes CM-005 staff-wide cost visibility. `requireRole('Admin')` on cost PUT and `GET /api/reports/costs`; cost fields stripped from inspector APIs for non-Admin (including self). Assignment `dailyCostUsd`/`dailyBillableUsd` snapshotted at assign. Reports Cost & margin section Admin-only. `import-roster` upserts `admin@irppms.local`. |

---

*Last updated: 2026-09-20*
