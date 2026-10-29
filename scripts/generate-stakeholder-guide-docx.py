"""Generate single safe stakeholder UAT guide (Word)."""
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Stakeholder-Guide.docx"

PRODUCTION_MAP = [
    ("Sign-in & access", "In progress", "Email/password login; roles control menus", "Company sign-in (Azure AD)"),
    ("Dashboard", "Done", "KPIs, department load, upcoming jobs, activity feed", "—"),
    ("Jobs & pipeline", "Done", "Create → optional QE approve → assign (Active if no QE flag) → complete (closed)", "—"),
    ("Timesheets", "In progress", "Period selection, preview, save, PDF from Jobs page", "PDF layout to match official company template"),
    ("Planner", "Done", "Timeline, capacity, conflicts, filters", "—"),
    ("Reports", "Done", "Activity report, utilization, on-time finish, performance insights", "—"),
    ("Departments", "Done", "Workload and staffing overview", "—"),
    ("Competency", "Done", "Certification matrix and expiry tracking", "—"),
    ("Leave", "Done", "Leave management with audit for staff", "—"),
    ("Notifications", "Done", "In-app alerts for workflow events", "—"),
    ("Inspectors / Clients / Job types", "Done", "Profiles and reference data", "—"),
    ("Security (production-ready)", "In progress", "Core access controls improved", "Final hardening for live deployment"),
    ("Azure AD integration", "Planned", "Ready for future connection", "Connect to company Entra ID / SSO"),
]

GAPS = [
    "Timesheet PDF format — output works, but layout must match your official timesheet template.",
    "Azure AD / company sign-in — test uses app passwords; production should use company accounts.",
    "Scheduled exports — no automatic monthly email or scheduled CSV export yet.",
    "Assignment SLA report — time-to-assign and reassignment history not in a dedicated report.",
    "Client billing export — PDF timesheets exist; full CSV billing export not built.",
    "Production security pass — additional checks before go-live on your network.",
]


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
    title = doc.add_heading("IRPPMS Stakeholder & Tester Guide", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph("Inspector Resource Planning & Productivity Management System")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("Safe summary for initial testers and business stakeholders")
    doc.add_paragraph("")

    doc.add_heading("What IRPPMS does", level=1)
    doc.add_paragraph(
        "IRPPMS helps inspection teams plan work, assign inspectors, track daily activity, "
        "close jobs, and review performance in one place."
    )
    doc.add_paragraph("Inspectors: work assigned jobs, log hours, submit completion, manage leave, generate own timesheets.", style="List Bullet")
    doc.add_paragraph("Coordinators: create jobs, assign people, monitor pipeline, plan capacity, generate timesheets for any inspector.", style="List Bullet")
    doc.add_paragraph("Managers: review reports and operational performance.", style="List Bullet")

    doc.add_heading("How to sign in (test environment)", level=1)
    doc.add_paragraph("App URL: http://localhost:5180", style="List Bullet")
    doc.add_paragraph("Password (demo users): password123", style="List Bullet")
    doc.add_paragraph("Coordinator: coordinator@irppms.local", style="List Bullet")
    doc.add_paragraph("Manager: manager@irppms.local", style="List Bullet")
    doc.add_paragraph("Inspector: inspector@irppms.local", style="List Bullet")

    doc.add_heading("Job pipeline", level=1)
    for step in [
        "New — Coordinator creates a job (optionally: QE must approve inspector)",
        "QE approval — If flagged, a manager (acting as QE) approves the selected inspector before work starts",
        "Active — If the flag is off, assign makes the job Active immediately; if on, Active starts after QE approval",
        "Completed — Inspector or coordinator marks the job complete; it is closed immediately",
    ]:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Where to generate monthly timesheets", level=1)
    doc.add_paragraph("There is no separate Timesheet tab. Timesheets are inside the Jobs page.")
    for step in [
        "Open Jobs in the left menu.",
        "Scroll to the bottom section: Generate timesheet.",
        "Choose period start and end (defaults to previous calendar month).",
        "Inspectors: generate only their own timesheet (no inspector dropdown).",
        "Coordinators / Managers: select an inspector, then generate for that person.",
        "Use View to preview, Save report to store, or Download PDF for a copy.",
    ]:
        doc.add_paragraph(step, style="List Number")
    doc.add_paragraph("Shortcut: open Jobs and scroll to the timesheet section at the bottom.")

    doc.add_heading("App areas — what each section is for", level=1)
    areas = [
        ("Dashboard", "Snapshot of open work, utilization, and recent activity"),
        ("Jobs", "Pipeline (staff) or assigned jobs (inspectors); activity logs; timesheets at bottom"),
        ("Planner", "Who is booked, on leave, or overloaded"),
        ("Reports", "Team performance and a single Activity view of logged hours"),
        ("Map", "Clients and open jobs on a simple map"),
        ("Departments", "Workload by department"),
        ("Competency", "Certifications and expiry"),
        ("Inspectors", "Staff profiles and history"),
        ("Leave", "Time off management"),
        ("Job Types / Clients", "Setup data for jobs"),
        ("Notifications", "Bell icon for alerts"),
    ]
    for name, desc in areas:
        doc.add_paragraph(f"{name}: {desc}", style="List Bullet")
    doc.add_paragraph("Inspector menu: Dashboard, Jobs, Leave.")
    doc.add_paragraph("Coordinator / Manager: all areas above including Planner and Reports.")

    doc.add_heading("Production map — current development stage", level=1)
    doc.add_paragraph(
        "Overall stage: User acceptance testing (UAT). Core workflows are usable; "
        "some items remain before full production rollout."
    )
    add_table(
        doc,
        ["Module", "Status", "What works today", "What is still needed"],
        PRODUCTION_MAP,
    )

    doc.add_heading("Known gaps (for discussion)", level=1)
    doc.add_paragraph("Main items not yet complete for production:")
    for gap in GAPS:
        doc.add_paragraph(gap, style="List Bullet")

    doc.add_heading("Suggested test scenarios", level=1)
    for step in [
        "Coordinator creates a job and assigns an inspector (job becomes Active if QE is not required).",
        "Coordinator creates a job with QE must approve inspector, assigns someone, then a manager QE-approves before hours can be logged.",
        "Inspector logs activity on the assigned Active job.",
        "Inspector or coordinator marks the job complete (it is closed immediately).",
        "Inspector generates own monthly timesheet from Jobs (bottom section).",
        "Coordinator generates timesheet for an inspector.",
        "Staff reviews Reports (Activity + performance).",
        "Inspector adds leave; staff checks Planner / Leave.",
        "Staff opens Map to see geocoded clients and open jobs.",
    ]:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Feedback template", level=1)
    for line in [
        "Role tested as:",
        "Area tested:",
        "What worked well:",
        "What was confusing:",
        "Issue or bug:",
        "Suggested improvement:",
        "Priority: High / Medium / Low",
    ]:
        doc.add_paragraph(line, style="List Bullet")

    doc.core_properties.title = "IRPPMS Stakeholder Guide"
    doc.core_properties.subject = "UAT and production map"
    doc.save(OUT)
    print(f"Created: {OUT}")


if __name__ == "__main__":
    main()
