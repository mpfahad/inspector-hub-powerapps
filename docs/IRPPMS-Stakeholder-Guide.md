# IRPPMS Stakeholder & Tester Guide

**Inspector Resource Planning & Productivity Management System**  
Safe summary for initial testers and business stakeholders — June 2026

---

## What IRPPMS does

IRPPMS helps inspection teams plan work, assign inspectors, track daily activity, close jobs, and review performance — in one place instead of spreadsheets and email chains.

**Who uses it**

- **Inspectors** — work assigned jobs, log hours, submit completion, manage leave, generate their own timesheets.
- **Coordinators** — create jobs, assign people, monitor the pipeline, plan capacity, generate timesheets for any inspector.
- **Managers** — review reports and operational performance.

---

## How to sign in (test environment)

- **App URL:** http://localhost:5180  
- **Password (demo users):** password123  

| Role | Email |
|------|--------|
| Coordinator | coordinator@irppms.local |
| Manager | manager@irppms.local |
| Admin | admin@irppms.local |

---

## Job pipeline (simple view)

1. **New** — Coordinator creates a job (optionally ticks **Requires QE-approved inspector**)
2. **Active** — Assign makes the job Active immediately (CM-001). If the QE flag is on, only inspectors marked **QE approved** on their profile can be assigned
3. **Hours** — Logged only when the job is Active
4. **Complete** — Mark complete closes the job immediately
4. **Completed** — Inspector or coordinator marks the job complete; it is closed immediately  

---

## Where to generate monthly timesheets

There is **no separate Timesheet tab**. Timesheets live inside **Jobs**.

1. Open **Jobs** in the left menu.  
2. Scroll to the bottom section **Generate timesheet**.  
3. Choose **period start** and **period end** (defaults to previous calendar month).  
4. **Inspectors** — generate only their own timesheet (no inspector dropdown).  
5. **Coordinators / Managers** — select an inspector from the dropdown, then generate for that person.  
6. Use **View** to preview, **Save report** to store it, or **Download PDF** for a copy.

Direct link shortcut: `/jobs#timesheet` (scrolls to the timesheet section).

---

## App areas — what each section is for

| Area | What it does |
|------|----------------|
| **Dashboard** | Snapshot of open work, utilization, upcoming jobs, and recent activity |
| **Jobs** | Pipeline board (staff) or assigned-job list (inspectors); job detail; activity logs; **timesheets at bottom** |
| **Planner** | Who is booked, on leave, or overloaded; day/week/month views |
| **Reports** | Team performance plus a single **Activity** view (who logged hours/narrative on which jobs) |
| **Map** | Staff map of clients and open jobs (sample coordinates; OpenStreetMap) |
| **Departments** | Workload and headcount by department |
| **Competency** | Who holds which certifications; expiry alerts |
| **Inspectors** | Staff profiles, assignments, activity history |
| **Leave** | Record and manage leave (inspectors: own only; staff: all) |
| **Job Types / Clients** | Setup and reference data for creating jobs |
| **Notifications** | Bell icon — alerts for assignments and job completions |

**Who sees what**

- **Inspector:** Dashboard, Jobs, Leave  
- **Coordinator / Manager:** All staff areas above (including Planner, Reports, Map, Departments, Competency, Inspectors, Clients, Job Types)

---

## Production map — current development stage

Overall stage: **User acceptance testing (UAT)** — core workflows are usable; some items remain before full production rollout.

| Module | Status | What works today | What is still needed |
|--------|--------|------------------|----------------------|
| **Sign-in & access** | In progress | Email/password login; APIs enforce roles (inspectors only see their own jobs) | Company sign-in (Azure AD / Entra) |
| **Dashboard** | Done | KPIs, department load, upcoming jobs, activity feed | — |
| **Jobs & pipeline** | Done | Create → assign (Active immediately; if job requires QE-approved inspector, only profile-flagged inspectors) → complete (job is closed) | — |
| **Timesheets** | In progress | Period selection, preview, save, PDF download from Jobs | PDF layout to match your official timesheet template |
| **Planner** | Done | Timeline, capacity bands, conflicts, filters | — |
| **Reports** | Done | Activity log report, utilization, on-time finish, performance bands | — |
| **Departments** | Done | Workload and staffing overview | — |
| **Competency** | Done | Certification matrix and expiry tracking | — |
| **Leave** | Done | Inspector requests stay Pending until staff approve; staff can record leave directly | — |
| **Notifications** | Done | In-app alerts for key workflow events | — |
| **Inspectors / Clients / Job types** | Done | Reference data and profiles | — |
| **Security (production-ready)** | In progress | Inspector API scoping, session reload from DB, input validation on writes | Final hardening for live deployment |
| **Azure AD integration** | Planned | Schema and identity layer ready (`docs/AUTH.md`); local passwords for UAT | Connect to company Entra ID / SSO |

---

## Known gaps (no dates — for discussion)

These are the main items **not yet complete** for production:

1. **Timesheet PDF format** — output works, but layout must match your current official timesheet template (branding, columns, signatures).  
2. **Azure AD / company sign-in** — users still sign in with app passwords in test; identity fields are ready for Entra (see `docs/AUTH.md`). Production should use company accounts.  
3. **Scheduled exports** — no automatic monthly email or scheduled CSV export yet.  
4. **Assignment SLA report** — time-to-assign and reassignment history not in a dedicated report yet.  
5. **Client billing export** — PDF timesheets exist; full CSV billing export for invoicing is not built.  
6. **Production security pass** — additional checks before go-live on your network.

---

## Suggested test scenarios

1. Coordinator creates a job and assigns an inspector (job becomes Active if QE is not required).  
2. Staff mark a few inspectors **QE approved** on their profile; coordinator creates a job with **Requires QE-approved inspector**, assigns a QE-approved inspector (job goes Active), and confirms a non–QE-approved inspector is blocked.  
3. Inspector logs activity on the assigned Active job.  
4. Inspector or coordinator marks the job complete (it is closed immediately).  
5. Inspector generates own monthly timesheet from **Jobs** (bottom section).  
6. Coordinator generates timesheet for an inspector (inspector dropdown).  
7. Staff reviews **Reports** (Activity + performance).  
8. Inspector adds leave; staff confirms it appears in **Planner** / **Leave**.  
9. Staff opens **Map** to see geocoded clients and open jobs.  


---

## Feedback template

Please send feedback in this format:

- **Role tested as:** Inspector / Coordinator / Manager  
- **Area tested:** Dashboard / Jobs / Timesheet / Reports / Planner / Other  
- **What worked well:**  
- **What was confusing:**  
- **Issue or bug:**  
- **Suggested improvement:**  
- **Priority:** High / Medium / Low  

---

*This document is intended for UAT and stakeholder review. It avoids technical implementation detail.*
