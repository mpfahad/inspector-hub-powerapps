"""Generate IRPPMS technical overview Word doc from the markdown content."""
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Technical-Overview.docx"


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = val
    doc.add_paragraph("")


def main():
    doc = Document()
    title = doc.add_heading("IRPPMS — Technical Overview", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph("Inspector Resource Planning & Productivity Management System")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note = doc.add_paragraph(
        "Short technical reference for developers and IT. "
        "For end-user navigation see IRPPMS-Staff-User-Guide."
    )
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("")

    doc.add_heading("What it is", level=1)
    doc.add_paragraph(
        "IRPPMS is a local UAT web app for planning inspection jobs in Qatar: "
        "assign inspectors, track Active → Closed work, certs/QE rules, map, "
        "timesheets, and reports."
    )

    doc.add_heading("Stack", level=1)
    add_table(
        doc,
        ["Layer", "Technology"],
        [
            ["Frontend", "React 19, Vite, TypeScript, Tailwind, React Router, Leaflet"],
            ["Backend", "Express 5, TypeScript (tsx in dev)"],
            ["Data", "Prisma + SQLite (server/prisma/dev.db)"],
            ["Auth", "Local email/password → JWT in httpOnly cookie irppms_token"],
        ],
    )
    doc.add_paragraph("Repo layout", style="List Bullet")
    doc.add_paragraph("app/ — SPA (proxies /api → API)", style="List Bullet")
    doc.add_paragraph("server/ — REST API, Prisma, assignment engine, PDF timesheets", style="List Bullet")
    doc.add_paragraph("docs/ — guides and change register", style="List Bullet")
    doc.add_paragraph("scripts/ — Word doc generators, etc.", style="List Bullet")

    doc.add_heading("Ports & isolation", level=1)
    add_table(
        doc,
        ["Service", "Port"],
        [
            ["Web UI", "5180"],
            ["API", "4100"],
        ],
    )
    doc.add_paragraph(
        "Cookie name is irppms_token (not shared with other apps). Details: docs/PORTS.md."
    )
    doc.add_paragraph(
        'Health check: GET http://localhost:4100/api/health → '
        '{ "status": "ok", "service": "irppms-api" }'
    )

    doc.add_heading("Run locally", level=1)
    doc.add_paragraph(
        "From repo root: install dependencies, copy server/.env.example to .env, "
        "prisma db push, db:seed, then npm run dev. Open http://localhost:5180"
    )
    add_table(
        doc,
        ["Command", "Purpose"],
        [
            ["npm run db:seed (server)", "Full wipe + seed"],
            ["npm run db:import-roster (server)", "Upsert roster/clients (keep jobs)"],
            ["npm run db:seed-sample-jobs (server)", "Sample/historical jobs for reports"],
            ["npm run dev:docker", "Docker compose dev stack"],
        ],
    )

    doc.add_heading("Roles", level=1)
    add_table(
        doc,
        ["Role", "Access"],
        [
            ["Inspector", "Own jobs, activity, leave, timesheets"],
            ["Coordinator / Manager", "Staff menus: jobs, planner, reports (non-cost), map, setup"],
            ["Admin", "Staff access + inspector CTC/billable + cost report"],
        ],
    )
    doc.add_paragraph(
        "Staff = Coordinator + Manager + Admin. Cost fields are stripped from APIs "
        "for non-Admin (CM-013)."
    )
    doc.add_paragraph("Demo password: password123")
    doc.add_paragraph(
        "Accounts: coordinator@ / manager@ / admin@irppms.local"
    )
    doc.add_paragraph("Entra/AD-ready schema (no OIDC button yet): docs/AUTH.md")

    doc.add_heading("Job workflow (product rules)", level=1)
    for step in [
        "Create job (New = Draft / Proposed)",
        "Assign → job + assignment Active immediately (no inspector accept)",
        "Optional: Requires QE-approved inspector → only Inspector.qeApproved may be assigned",
        "Log activity while Active",
        "Complete → job Closed immediately (no manager approval)",
    ]:
        doc.add_paragraph(step, style="List Number")
    doc.add_paragraph(
        "Pipeline stages in UI: New (blue) · Active (green) · Completed (gray)"
    )

    doc.add_heading("Architecture (brief)", level=1)
    doc.add_paragraph(
        "Browser (5180) → cookie irppms_token → Vite/React proxies /api → "
        "Express API (4100) → Prisma → SQLite"
    )
    doc.add_paragraph(
        "Auth: login sets JWT cookie; middleware reloads user (including role) "
        "from DB each request."
    )

    doc.add_heading("Key server areas", level=2)
    add_table(
        doc,
        ["Path", "Responsibility"],
        [
            ["routes/", "HTTP endpoints (/api/jobs, /api/reports, /api/map, …)"],
            ["services/jobWorkflow.ts", "Assign / complete / status promotion"],
            ["services/assignmentEngine.ts", "Rank candidates; geo area warnings"],
            ["services/authz.ts", "Staff vs inspector scoping; isAdmin"],
            ["middleware/auth.ts", "JWT + requireRole"],
        ],
    )

    doc.add_heading("Key frontend areas", level=2)
    add_table(
        doc,
        ["Path", "Responsibility"],
        [
            ["pages/", "Screens (Jobs, Planner, Reports, …)"],
            ["components/jobs/", "Board, map panel, assign, timesheet"],
            ["lib/api.ts", "Typed API client"],
            ["context/AuthContext.tsx", "Session"],
        ],
    )
    doc.add_paragraph(
        "Map lives on Jobs (not a separate nav item). /map redirects to /jobs#map."
    )

    doc.add_heading("Main API groups", level=1)
    add_table(
        doc,
        ["Prefix", "Notes"],
        [
            ["/api/auth", "Login, logout, session"],
            ["/api/jobs", "CRUD, assign, complete, price, pipeline"],
            ["/api/map", "Clients + jobs with stage tags for map"],
            ["/api/reports", "Activity, performance, overdue; /costs Admin only"],
            ["/api/inspectors", "Profiles; cost update Admin only"],
            ["/api/planner", "Capacity / conflicts"],
            ["/api/timesheets", "Generate / PDF"],
            ["/api/leave, /api/competency, /api/dashboard, …", "Supporting modules"],
        ],
    )
    doc.add_paragraph(
        "Mutating routes generally use Zod validation. Inspectors are scoped to own assignments."
    )

    doc.add_heading("Data highlights (Prisma)", level=1)
    doc.add_paragraph(
        "Important entities: User, Inspector, Client, Job, Assignment, ActivityLog, "
        "InspectorCert, JobType, PriceChart, LeaveRequest, Timesheet, InspectorCostHistory."
    )
    for item in [
        "Money fields often named *Usd in schema; UI displays QAR",
        "Assignment stores cost snapshot (dailyCostUsd / dailyBillableUsd) at assign time",
        "Geo: latitude / longitude on Client (and Job when set)",
        "Schema: server/prisma/schema.prisma",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Change register", level=1)
    doc.add_paragraph(
        "Product changes are logged in docs/CHANGE-MANAGER.md (CM-001 … CM-013). "
        "Keep stakeholder/staff guides in sync when behaviour changes."
    )

    doc.add_heading("Related docs", level=1)
    add_table(
        doc,
        ["Doc", "Audience"],
        [
            ["IRPPMS-Staff-User-Guide", "Coordinators & managers"],
            ["IRPPMS-Stakeholder-Guide", "Broader UAT (may lag product)"],
            ["AUTH.md", "Auth / Entra readiness"],
            ["PORTS.md", "Ports & isolation"],
            ["CHANGE-MANAGER.md", "Change history"],
        ],
    )

    doc.add_paragraph("")
    footer = doc.add_paragraph(
        "UAT build — SQLite local. Not production-hardened for multi-tenant cloud deployment."
    )
    footer.runs[0].italic = True

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
