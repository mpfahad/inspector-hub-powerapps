from docx import Document

BRANDED_OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Initial-Tester-Guide-Branded.docx"
CHECKLIST_OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Quick-Test-Checklist.docx"


def build_branded_guide():
    doc = Document()
    doc.add_heading("IRPPMS | Initial User Testing Guide", 0)
    doc.add_paragraph("Inspector Resource Planning & Productivity Management System")
    doc.add_paragraph("Version: UAT Round 1")
    doc.add_paragraph("")

    doc.add_heading("What the app does", level=1)
    doc.add_paragraph(
        "IRPPMS helps teams plan inspection work, assign inspectors, track daily activity, "
        "and close jobs when work is finished. It gives operations teams one place to monitor "
        "pipeline progress, workloads, and performance trends."
    )
    doc.add_paragraph("Primary users:", style="List Bullet")
    doc.add_paragraph("Inspectors: work assigned jobs, log daily activity, submit completion.", style="List Bullet 2")
    doc.add_paragraph("Coordinators: create jobs, assign inspectors, manage flow and scheduling.", style="List Bullet 2")
    doc.add_paragraph("Managers: review reports and operational performance.", style="List Bullet 2")

    doc.add_heading("Login details for test users", level=1)
    for line in [
        "App URL: http://localhost:5180",
        "Password (seeded users): password123",
        "Coordinator: coordinator@irppms.local",
        "Manager: manager@irppms.local",
        "Inspector: inspector@irppms.local",
    ]:
        doc.add_paragraph(line, style="List Bullet")

    doc.add_heading("Job pipeline (high level)", level=1)
    for step in [
        "New -> Coordinator creates a job",
        "Active -> Coordinator or manager assigns an inspector; work can start immediately",
        "Completed -> Inspector or coordinator marks complete; the job is closed immediately",
    ]:
        doc.add_paragraph(step, style="List Number")

    doc.add_heading("Categorized app areas to review", level=1)
    categories = [
        ("Dashboard", [
            "Purpose: KPI snapshot and current operational status.",
            "Check clarity of cards, summaries, and action prompts.",
        ]),
        ("Jobs & Pipeline", [
            "Purpose: End-to-end operational workflow.",
            "Check assign-to-active flow, activity logging, and completion.",
        ]),
        ("Reports", [
            "Purpose: Visibility into utilization, on-time completion, and performance.",
            "Check if insights are understandable and actionable.",
        ]),
        ("Planner", [
            "Purpose: Capacity planning and conflict detection.",
            "Check timeline readability and filtering usefulness.",
        ]),
        ("Other tabs", [
            "Departments: workload and staffing context.",
            "Competency: certification coverage and expiries.",
            "Inspectors: people profiles and work history.",
            "Leave: leave management with role-based scope.",
            "Timesheets: monthly period selection, preview, PDF generation, and saved reports.",
            "Job Types / Clients: reference setup for operations.",
        ]),
    ]
    for heading, points in categories:
        doc.add_heading(heading, level=2)
        for point in points:
            doc.add_paragraph(point, style="List Bullet")

    doc.add_heading("Role access summary", level=1)
    doc.add_paragraph("Inspector: Dashboard, Jobs, Leave", style="List Bullet")
    doc.add_paragraph(
        "Coordinator: Dashboard, Planner, Jobs, Departments, Competency, Reports, Leave, Job Types, Inspectors, Clients",
        style="List Bullet",
    )
    doc.add_paragraph("Manager: same staff navigation as coordinator", style="List Bullet")

    doc.add_heading("Monthly timesheet generation (important)", level=1)
    doc.add_paragraph(
        "IRPPMS supports monthly timesheet generation from the Jobs area. "
        "Inspectors can generate their own monthly timesheets; staff can generate for selected inspectors."
    )
    for item in [
        "Choose period start and end dates for the month.",
        "Preview calculated hours before saving.",
        "Generate and save the timesheet report.",
        "Download the report as PDF for submission/billing records.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.save(BRANDED_OUT)
    print(f"Created: {BRANDED_OUT}")


def build_quick_checklist():
    doc = Document()
    doc.add_heading("IRPPMS Quick Test Checklist (Round 1)", 0)
    doc.add_paragraph("Use this one-page list during first-pass testing.")

    doc.add_heading("A) Access & Login", level=1)
    for item in [
        "Can login as coordinator, manager, and inspector.",
        "Menu changes correctly by role.",
        "No obvious permission leakage in navigation.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("B) Dashboard", level=1)
    for item in [
        "KPI cards load and values look reasonable.",
        "Action items/summary are understandable.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("C) Job Pipeline", level=1)
    for item in [
        "Create a new job as coordinator.",
        "Assign inspector and confirm the job becomes Active immediately.",
        "Log activity as inspector while job is Active.",
        "Mark complete and confirm the job is closed immediately.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("D) Monthly Timesheet", level=1)
    for item in [
        "Open Jobs and go to timesheet section.",
        "Set monthly date range and preview totals.",
        "Generate/save timesheet successfully.",
        "Download PDF and confirm values match activity logs.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("E) Reports", level=1)
    for item in [
        "Reports load for staff roles.",
        "Utilization/on-time metrics are understandable.",
        "Performance labels feel fair and useful.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("F) Other Tabs", level=1)
    for item in [
        "Planner: schedule visibility and conflict cues are useful.",
        "Departments: workload/staffing data is clear.",
        "Competency: cert statuses and gaps are clear.",
        "Leave: role-based leave actions work correctly.",
        "Inspectors/Clients/Job Types: data can be viewed/managed as expected.",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Feedback fields (copy/paste)", level=1)
    for line in [
        "Role tested as:",
        "Area tested:",
        "What worked well:",
        "What was confusing:",
        "Issue/bug:",
        "Suggested change:",
        "Priority: High / Medium / Low",
    ]:
        doc.add_paragraph(line, style="List Bullet")

    doc.save(CHECKLIST_OUT)
    print(f"Created: {CHECKLIST_OUT}")


if __name__ == "__main__":
    build_branded_guide()
    build_quick_checklist()
