# Lovable → PowerApps Canvas Mapping

**Source repo:** [github.com/mpfahad/inspector-hub](https://github.com/mpfahad/inspector-hub)  
**Target:** `app/` — PowerApps-compliant React mockup for SharePoint backend

## Screen mapping

| Lovable route | Canvas screen | Mockup file | Status |
|---------------|---------------|-------------|--------|
| `/` Dashboard | `scrHome` | `ScrHome.tsx` | Done |
| `/departments` | `scrDepartments` | `ScrDepartments.tsx` | Done |
| `/planner` | `scrPlanner` | `ScrPlanner.tsx` | Done (week view + bands) |
| `/jobs` | `scrJobs` + `scrJobDetail` | `ScrJobs.tsx`, `ScrJobDetail.tsx` | Done |
| `/assignments` | `scrAssignments` | `ScrAssignments.tsx` | Done (skill engine) |
| `/activity-logs` | `scrActivityLog` | `ScrActivityLog.tsx` | Done |
| `/inspectors` | `scrInspectors` + `scrInspectorDetail` | `ScrInspectors.tsx`, `ScrInspectorDetail.tsx` | Done |
| `/qualifications` | — | Merge into `scrCompetency` | Partial |
| `/competency` | `scrCompetency` | `ScrCompetency.tsx` | Done |
| `/leave` | `scrLeave` | `ScrLeave.tsx` | Done |
| `/dashboards` | `scrDashboards` | — | **Power BI** recommended |
| `/reports` | `scrReports` | — | **Power BI** recommended |
| `/workflows` | — | Power Automate only | Not in Canvas |
| `/admin` | `scrAdmin` | — | Phase 2 |
| `/login` | Azure AD / SharePoint auth | — | Native to M365 |

## Logic mapping

| Lovable module | PowerApps mockup | Canvas implementation |
|----------------|------------------|----------------------|
| `lib/mock-data.ts` | `powerplatform/seedData.ts` | SharePoint lists |
| `lib/competency.ts` | `powerplatform/competency.ts` | `ForAll` + `Patch` to `colRanked` |
| `lib/scheduler.ts` | `powerplatform/scheduler.ts` | `Filter(Assignments)` + `ClearCollect(colAllocations)` |
| TanStack Router | `AppContext.navigate()` | `Navigate(scrX)` |
| React Query | `Refresh(Jobs)` | SharePoint connector refresh |
| shadcn UI | `components/controls.tsx` | Native Canvas controls |

## Data field mapping (Lovable → SharePoint)

| Lovable | SharePoint column |
|---------|-------------------|
| `job.id` (J-2026-00184) | `Jobs.Title` |
| `inspector.id` (E-1042) | `Inspectors.EmployeeNo` |
| `inspector.dept` | `Inspectors.Department` (Lookup) |
| `assignment.status` Pending/Accepted | `Assignments.Status` Proposed/Confirmed |
| `leave.status` | `LeaveRequests.Status` (Choice) |

## Features not ported (by design)

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Executive dashboards (8 views) | SharePoint charts limited | Power BI |
| Workflow config UI | No Canvas equivalent | Power Automate portal |
| Login page | M365 handles auth | `User().Email` |
| Recharts / bar charts | Use Power BI or HTML text | Simplified KPI tiles in `scrHome` |
| Month planner view | Complex in Canvas | Week view first; month via Power BI |
| Suggest alternatives on conflict | Heavy client logic | Power Automate + AI Builder (optional) |

## Next implementation phases in Canvas

1. **Phase 1 (current mockup):** CRUD, planner week view, competency matrix, assignment ranking  
2. **Phase 2:** Power Automate — leave approval, assignment notifications, cert expiry  
3. **Phase 3:** Power BI — executive dashboards from SharePoint lists  
4. **Phase 4:** Skill engine in Power Fx `ForAll` or Azure Function called via Power Automate for large pools
