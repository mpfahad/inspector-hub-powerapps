# Inspector Hub — PowerApps Canvas + SharePoint Feasibility

Based on `IRPPMS_ERD.mmd` (Inspector Resource Planning & Productivity Management System).

## Verdict

| Area | SharePoint + Canvas | Notes |
|------|---------------------|-------|
| Core CRUD (Jobs, Inspectors, Assignments, Activity Logs) | **Yes — full function** | Standard lists, lookups, forms, galleries |
| Scheduling & resource allocation | **Yes — with design care** | Use Assignments list + calendar/gallery views; no native Gantt |
| Certifications & qualifications | **Yes** | Junction lists (`InspectorCert`, `InspectorQual`) |
| Leave requests | **Yes** | Status workflow via Choice column + Power Automate for approvals |
| Training sessions | **Yes** | Simple list + gallery |
| Role-based UI (Admin / Manager / Inspector) | **Yes** | `UserRoles` list + `If(User().Email in ...)` patterns |
| Notifications (email/Teams) | **Partial** | Requires **Power Automate** flows; not native in Canvas |
| Multi-level approvals | **Partial** | `Approvals` list + Power Automate; Canvas shows status only |
| Productivity analytics / dashboards | **Partial** | Simple KPIs in-app; rich charts → **Power BI** |
| Offline mobile for field inspectors | **Partial** | Power Apps mobile offline has list size/sync limits |
| Complex search across text fields | **Partial** | SharePoint `Search()` is **not delegable** — use indexed Choice/lookup filters |
| JSON notification payloads | **No (native)** | Use separate columns or multiline text; avoid JSONB |

### Bottom line (v2.0 specification)

| Tier | Coverage | What it includes |
|------|----------|------------------|
| **Tier 1 — Canvas + SharePoint alone** | ~60% | Jobs, inspectors, assignments, activity logs, leave forms, basic schedule grid, role-gated screens |
| **Tier 2 — + Power Automate** | ~80% | Notifications, approval chains (L1/L2), cert expiry alerts, escalation timers |
| **Tier 3 — + Power BI** | ~90% | Executive dashboards, KPI drill-down, utilisation heatmaps |
| **Not practical on SharePoint alone** | Remaining | Skill engine at scale (weighted 100-pt scoring), sub-200ms planner re-render, Postgres-style RLS, real-time conflict engine on large datasets |

The Lovable v2.0 spec assumes **Supabase/PostgreSQL** (RLS, `has_role()`, security-definer). SharePoint can replicate the **data model** and **most workflows**, but not the **performance-sensitive assignment engine** or **8 drill-down executive dashboards** without Power BI and careful delegation design.

### Bottom line (ERD-only / MVP)

You can implement **~85% of core inspection scheduling and productivity tracking** in a Canvas app backed by SharePoint lists. The remaining **15%** (automated notifications, approval routing, advanced analytics, document versioning at scale) needs **Power Automate**, **Power BI**, or **Dataverse** if you outgrow SharePoint limits.

---

## SharePoint list design (maps 1:1 to ERD)

Each list uses SharePoint `ID` (auto) instead of UUID. Add a `RecordGuid` text column only if you need stable external references.

| List | Key columns | Relationships |
|------|-------------|---------------|
| **Departments** | Title, Code, Manager (Person) | — |
| **Clients** | Title, Industry, Location | — |
| **Inspectors** | Title, EmployeeNo, Department (Lookup), BaseLocation, Status (Choice), HireDate | → Departments |
| **Jobs** | Title (Ref), Client (Lookup), Department (Lookup), Scope, StartDate, EndDate, Status, Priority | → Clients, Departments |
| **Assignments** | Job (Lookup), Inspector (Lookup), AllocatedHours, Role, Status, CreatedBy (Person), DecidedAt | → Jobs, Inspectors |
| **ActivityLogs** | Inspector, Job, LogDate, Hours, ProductiveHours, Narrative, QualityScore | → Inspectors, Jobs |
| **LeaveRequests** | Inspector, Type, StartDate, EndDate, Status, Approver (Person) | → Inspectors |
| **TrainingSessions** | Inspector, Course, StartDate, EndDate, Provider | → Inspectors |
| **Certifications** | Title, Code, Issuer, ValidityMonths | — |
| **InspectorCerts** | Inspector, Certification, IssuedOn, ExpiresOn, DocUrl | junction |
| **Qualifications** | Title, Category, Level | — |
| **InspectorQuals** | Inspector, Qualification, GrantedOn | junction |
| **UserRoles** | UserEmail, Role (Choice) | — |
| **Notifications** | UserEmail, TemplateId, Payload, Channel, Status, SentAt | audit |
| **Approvals** | EntityType, EntityId, Level, Approver, Decision, DecidedAt | workflow |

### SharePoint constraints to plan for

1. **Delegation**: Filter/Sort on indexed columns only for lists > 5,000 rows.
2. **Data row limit**: Default 500, max 2,000 per query — use pagination (see mockup).
3. **Lookup columns**: Max 16 lookups per list — Jobs and Assignments are fine.
4. **Person columns**: Slower than text email — use `UserEmail` text for role checks where possible.
5. **No joins**: Use `LookUp(Jobs, ID = galJobs.Selected.ID)` pattern, not SQL-style joins.
6. **Attachments**: Use for cert documents; enable explicit column selection in app.

---

## Recommended Canvas app screens

| Screen | Purpose | Primary data source |
|--------|---------|---------------------|
| `scrHome` | KPI tiles, quick actions | Filtered collections |
| `scrJobs` | Job gallery + filters | Jobs |
| `scrJobDetail` | Job form + assignment sub-gallery | Jobs, Assignments |
| `scrInspectors` | Inspector directory | Inspectors |
| `scrInspectorDetail` | Profile, certs, quals, leave | Multiple lookups |
| `scrSchedule` | Week view of assignments | Assignments (date filter) |
| `scrActivityLog` | Daily productivity entry | ActivityLogs |
| `scrLeave` | Leave request form + approval queue | LeaveRequests |
| `scrTraining` | Training register | TrainingSessions |
| `scrAdmin` | Reference data (certs, quals, depts) | Admin lists |

---

## What to add beyond Canvas

| Need | Solution |
|------|----------|
| Leave approval emails | Power Automate: on item created → approval action |
| Cert expiry alerts | Scheduled flow → check `ExpiresOn` |
| Manager dashboards | Power BI dataset on SharePoint lists |
| Audit trail | SharePoint version history + `Approvals` list |

---

## Migration path from this React mockup

The React app in `/app` mirrors:

- SharePoint list internal names (`Title`, `JobId`, etc.)
- Power Fx operations in `/app/src/powerplatform/operations.ts`
- Screen navigation via `Navigate('scrJobs')` pattern
- Global variables in `AppContext` (= `Set()` / `UpdateContext()`)
- Galleries with delegable `Filter()` only

When rebuilding in Canvas, copy formulas from comments marked `// PowerFx:` in the source.
