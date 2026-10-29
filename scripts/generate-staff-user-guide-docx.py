"""Generate Coordinator & Manager Word user guide (no Admin costing)."""
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Staff-User-Guide.docx"


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
    title = doc.add_heading("IRPPMS — Coordinator & Manager User Guide", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph("Inspector Resource Planning & Productivity Management System")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note = doc.add_paragraph(
        "Simple guide for day-to-day use. Admin-only cost tools are not covered here."
    )
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("")

    doc.add_heading("Sign in", level=1)
    doc.add_paragraph("Open http://localhost:5180", style="List Number")
    doc.add_paragraph("Enter your email and password", style="List Number")
    doc.add_paragraph("Use Sign out in the left menu when finished", style="List Number")
    add_table(
        doc,
        ["Role", "Demo email", "Password"],
        [
            ["Coordinator", "coordinator@irppms.local", "password123"],
            ["Manager", "manager@irppms.local", "password123"],
        ],
    )

    doc.add_heading("What you use the app for", level=1)
    for item in [
        "Create and assign inspection jobs",
        "Track progress on the Jobs board and map",
        "See who is available in the Planner",
        "Review activity and performance reports",
        "Manage leave, inspectors, clients, and job types",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Left menu — what each area is", level=1)
    add_table(
        doc,
        ["Menu", "What it is", "What you do there"],
        [
            ["Dashboard", "Home snapshot", "See open/active jobs, upcoming work, and recent activity"],
            ["Planner", "Team calendar", "See who is booked, on leave, or overloaded (day / week / month)"],
            [
                "Jobs",
                "Main work area",
                "Create jobs, assign inspectors, track New → Active → Completed; map + board + list; timesheets at the bottom",
            ],
            ["Departments", "Department overview", "Check workload and headcount by department"],
            ["Competency", "Certifications", "See who holds which certs and what is expiring"],
            ["Reports", "Team insights", "Activity (who logged hours), performance, and overdue jobs"],
            ["Leave", "Leave requests", "Approve inspector leave, or record leave for staff"],
            ["Job Types", "Job categories", "Set up job types and default commercial prices"],
            ["Inspectors", "People roster", "Open profiles, QE-approved flag, certifications"],
            ["Clients", "Client list", "View client names and locations used on jobs"],
        ],
    )
    doc.add_paragraph(
        "Notifications — bell icon at the top for assignment and completion alerts."
    )

    doc.add_heading("Jobs — how to navigate (most used)", level=1)
    for step in [
        "Open Jobs in the left menu.",
        "Use the chips at the top: All / New / Active / Completed (filters both the map and the board).",
        "Map — large dots = client sites; small dots = jobs. Colours: blue = New, green = Active, gray = Completed. Scroll to zoom.",
        "Board or List — switch view under the map.",
        "Click a job card (or map popup link) to open job detail.",
        "Scroll to the bottom of Jobs for Generate timesheet.",
    ]:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Typical job flow", level=2)
    for step in [
        "+ New job — fill client, dates, scope; optionally tick Requires QE-approved inspector.",
        "Assign an inspector → job becomes Active straight away (no accept step).",
        "If QE is required, only inspectors marked QE approved on their profile can be assigned.",
        "Inspector (or you) logs hours while the job is Active.",
        "Mark complete → job is Closed immediately (no manager approval step).",
    ]:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Other common tasks", level=1)
    add_table(
        doc,
        ["Task", "Where"],
        [
            ["See who is free next week", "Planner"],
            ["Check cert coverage / expiry", "Competency or Inspectors"],
            ["Approve leave", "Leave"],
            ["See who logged hours this month", "Reports → Activity"],
            ["Change default job price for a type", "Job Types"],
            ["Find a client location", "Clients or the map on Jobs"],
        ],
    )

    doc.add_heading("Roles at a glance", level=1)
    add_table(
        doc,
        ["Role", "Access"],
        [
            ["Coordinator", "Full staff menus — create, assign, close jobs, reports, leave, setup"],
            ["Manager", "Same staff menus — focus on oversight, Planner, Reports, Leave"],
            ["Inspector", "Only Dashboard, Jobs (their work), Leave — not covered in this guide"],
            ["Admin", "Same as staff, plus cost tools — out of scope for this guide"],
        ],
    )

    doc.add_heading("Quick tips", level=1)
    for tip in [
        "Assign = job goes Active immediately.",
        "Complete = job is Closed immediately.",
        "Timesheets live under Jobs, not a separate menu.",
        "Map and board share the same New / Active / Completed filter.",
        "Currency on screen is QAR.",
    ]:
        doc.add_paragraph(tip, style="List Bullet")

    doc.add_paragraph("")
    doc.add_paragraph(
        "For UAT feedback, note your role, the menu area tested, what worked, and what was unclear."
    )

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
