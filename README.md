# Inspector Hub — PowerApps Edition

Power Apps Canvas + SharePoint reference implementation for **IRPPMS** (Inspector Resource Planning & Productivity Management System).

## Repositories

| Repo | Purpose |
|------|---------|
| [mpfahad/inspector-hub](https://github.com/mpfahad/inspector-hub) | Lovable production UI (TanStack Start + mock data) |
| **inspector-hub-powerapps** (this repo) | PowerApps-compliant mockup + SharePoint schema |

## Quick start

```bash
cd app
npm install
npm run dev
```

## Contents

- `app/` — React mockup mirroring Canvas screens, Power Fx patterns, SharePoint list shapes
- `docs/POWERAPPS_FEASIBILITY.md` — what works on SharePoint vs needs Power Automate / Power BI
- `docs/sharepoint-schema.json` — SharePoint list column definitions
- `docs/LOVABLE_MAPPING.md` — screen-by-screen map from Lovable app to Canvas
- `IRPPMS_ERD.mmd` — entity relationship diagram
- `lovable-source/` — local clone of Lovable repo (gitignored; clone with `git clone https://github.com/mpfahad/inspector-hub.git lovable-source`)

## Create GitHub repo

```powershell
cd "D:\CURSOR\Inspector Hub"
git add .
git commit -m "Align PowerApps mockup with Lovable inspector-hub"
git branch -M main
git remote add origin https://github.com/mpfahad/inspector-hub-powerapps.git
git push -u origin main
```

Create the empty repo on GitHub first: **inspector-hub-powerapps**

## Screens (Canvas names)

| Screen | Lovable equivalent |
|--------|-------------------|
| scrHome | Dashboard |
| scrDepartments | /departments |
| scrPlanner | /planner |
| scrJobs | /jobs |
| scrAssignments | /assignments (skill engine) |
| scrInspectors | /inspectors |
| scrCompetency | /competency |
| scrActivityLog | /activity-logs |
| scrLeave | /leave |
