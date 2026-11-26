# Inspection Hub — User Guide

**Version:** 2026-11-25 (post CM-042)  
**Audience:** Coordinators, Managers, and Admins  
**App:** Inspection Hub (IRPPMS) — department-centric job & workforce planning

---

## 1. Sign in

1. Open the app (UAT/live typically **http://localhost:5180** or your PC IP on port **5180**).
2. Sign in with your **email** and **password**.
3. Use **Sign out** in the left menu when finished.

| Role | What you do |
|------|-------------|
| **Coordinator** | Day-to-day: jobs, assign, job types, inspectors, leave, competency |
| **Manager** | Oversight + leave approve; same department tools (some setup limited by role) |
| **Admin** | Everything above + **Settings** (users/departments) + employee **CTC / cost** |

> Field inspectors no longer have logins. Roster people are managed by staff; they do not sign in.

---

## 2. How the app is organised

### Home — pick a department

After login you see **department cards** (Lifting, NDT, Rigs, Rope Access, …).  
Click a department to open its workspace. The left menu then shows only that department.

### Inside a department (left menu)

| Menu | Purpose |
|------|---------|
| **Dashboard** | KPIs, upcoming jobs, activity for **this** department |
| **Jobs** | Board / list, map, create jobs, assign, timesheets |
| **Inspectors** | Employee roster for the company (filter by dept); add / bulk upload |
| **Job types** | Categories, rates, required certs for **this** department |
| **Planner** | Who is booked / on leave (day · week · month) |
| **Competency** | Matrix of people × certifications |
| **Leave** | Request / approve leave |
| **Reports** | Activity, performance, overdue; **Cost & margin = Admin only** |

**Settings** (Admin) sits outside the department menu: users, departments, bulk user import.

**Notifications** — bell icon for assignment / completion alerts.

---

## 3. Jobs (main workflow)

Page order on **Jobs**:

1. Filter chips — **All / New / Active / Completed**  
2. **Board** or **List**  
3. **Map** (below the board)  
4. **Timesheet generation** (bottom)

### Create a job

1. Open the department → **Jobs** → **+ New job**.  
2. Set **Completion** (auto vs manual), **Single / Team**, **Day rate / Hourly**.  
3. Choose **Job type** — rates and est. hours prefill from the type:
   - Est. hours ≈ **default hours × calendar days × inspectors** (editable).  
   - Day jobs use **day rate**; hourly jobs use **hour rate** (derived if only day rate exists).  
4. Client, dates, location, priority.  
5. **Assign later** (job stays Proposed) or **Assign now** (fill inspector rows; filled row → Active).  
6. Save.

### On the job detail page

- **Edit job details** — title, dates, hours, location, scope, and **Price (QAR)** (editable on Draft / Proposed / Active).  
- **Assign / reassign** inspectors; rates prefill from job type.  
- **Activity logs** — auto-created for the date window when assigned/Active; you can still edit.  
- **Mark complete** — enter/confirm **Price**; employee CTC is **not** shown (Admin sees cost elsewhere).  
- Toggles (where shown): auto-complete on end date, rate basis.

### Map

- Colours: **blue = New**, **green = Active**, **gray = Completed**.  
- Same filter chips as the board.  
- Optional pop-out window for a larger map.

---

## 4. Job types

Path: department → **Job types**.

- **Day rate**, **Hour rate**, **Default hours** — enter any two; the third calculates.  
- Attach **required qualifications** from the catalog.  
- **+ New job type** for one-off create.  
- **Bulk upload** for many rows at once:

```text
code, name, description, dayRate, defaultHours, active, requiredCertCodes
RA-TECH,Rope Access Tech,IRATA support,2200,8,Yes,IRATA-L1
```

Cert codes can be pipe-separated: `IRATA-L1|IRATA-L2`.

---

## 5. Inspectors (employees)

Path: **Inspectors** (or from department menu).

- Search / filter by department, status, QE.  
- **+ New employee** for a single person.  
- **Bulk upload**:

```text
employeeNo,name,departmentCode,email,jobTitle,status,qeApproved,baseLocation,hireDate
E9001,Jane Rope,ROPE,jane@applus.com,Rope Tech,Active,No,Doha,2024-01-15
```

Department **code** must already exist (e.g. `LIFT`, `NDT`, `ROPE`).

### Inspector profile

- Toggle **QE approved**.  
- Change **status** (Active / On leave / Training / Inactive).  
- **Mark inactive** — leaves the assignable pool; history kept.  
- **Delete inspector** — removed only if no job history; otherwise marked Inactive.  
  Blocked while they still have **open** assignments.  
- Manage certifications (add / edit dates / remove).  
- **CTC / daily cost** — **Admin only**.

---

## 6. Competency

- Matrix of inspectors vs qualifications.  
- Click a cell to edit (add/update/remove cert dates).  
- Use for matching people to job-type requirements.

---

## 7. Planner & leave

- **Planner** — capacity bars; half-day shows as a **half-width** blue bar.  
- **Leave** — Coordinators/Managers record or approve leave so Planner stays accurate.

---

## 8. Settings (Admin)

**Settings → Departments**

- **Add department** — e.g. Name `Rope Access`, Code `ROPE`.  
- Edit name/code/manager email.  
- Delete only when there are **no open jobs** (inspectors/closed jobs move to Unassigned/HOLD).

**Settings → Users**

- Add / edit Admin, Manager, Coordinator logins.  
- Assign department access (blank = all departments).  
- **Bulk import** users (email, name, role, department codes).  
- Temporary passwords shown once for export.

---

## 9. Reports

- Activity, performance, overdue — department scoped.  
- **Cost & margin** — Admin only (uses job **Price** vs logged cost).

---

## 10. Typical day

| Goal | Where |
|------|--------|
| See today’s load | Department **Dashboard** or **Planner** |
| Raise a job | **Jobs** → + New job |
| Assign someone | Job card → Assign, or New job → Assign now |
| Fix commercial price | Job detail → Edit job → **Price** |
| Check certs | **Competency** or inspector profile |
| Add a new department | **Settings** → Add department |
| Load many employees | **Inspectors** → Bulk upload |
| Load many job types | **Job types** → Bulk upload |
| Timesheet PDF/data | **Jobs** page → bottom section |

---

## 11. Quick rules

- Work is **per department** — pick the right card first.  
- Assign → job becomes **Active** (no inspector accept step).  
- Complete → job **Closed** (with Price).  
- Currency on screen is **QAR**.  
- **Price** = commercial job price (not employee CTC).  
- CTC is **Admin-only**.  
- Timesheets live under **Jobs**, not a separate menu.  
- Map sits **under** the board, **above** timesheets.

---

## 12. Live / UAT update (IT)

On the host PC:

```powershell
cd C:\Apps\inspection-hub
git pull
docker compose up -d --build
```

Optional NDT roster reload (when CSVs change):

```powershell
docker compose exec api npm run db:import-ndt
```

---

*This is the current staff user guide. Keep only this file in `docs/USER GUIDE/` so the latest copy is easy to find.*
