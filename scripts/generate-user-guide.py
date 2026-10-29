"""Generate layman's Word guide for IRPPMS."""
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-User-Guide.docx"


def set_cell_shading(cell, fill_hex: str):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill_hex)
    cell._tc.get_or_add_tcPr().append(shading)


def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    return h


def add_body(doc, text):
    p = doc.add_paragraph(text)
    p.paragraph_format.space_after = Pt(8)
    p.style.font.size = Pt(11)
    return p


def build_pipeline_diagram(doc):
    add_heading(doc, "How a job moves through the system", level=2)
    add_body(
        doc,
        "Every inspection job follows the same path from creation to close-out. "
        "Think of it as a conveyor belt with three main stops. People at each stop "
        "have a clear job to do before the work moves on.",
    )

    stages = [
        ("1. New", "Draft / Proposed\n\nCoordinator creates the job and may run the assignment engine to suggest an inspector."),
        ("2. Active", "Assigned and in progress\n\nCoordinator or manager assigns an inspector; work can start immediately. Inspector logs daily hours."),
        ("3. Completed", "Closed\n\nInspector or coordinator marks the job complete; it is closed immediately and counts toward performance reports."),
    ]

    table = doc.add_table(rows=3, cols=len(stages))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for i, (title, detail) in enumerate(stages):
        top = table.rows[0].cells[i]
        top.text = title
        for p in top.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_shading(top, "1E3A5F")

        mid = table.rows[1].cells[i]
        if i < len(stages) - 1:
            mid.text = "→"
        else:
            mid.text = "✓"
        for p in mid.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(14)
                run.font.color.rgb = RGBColor(0x0D, 0x94, 0x88)

        bottom = table.rows[2].cells[i]
        bottom.text = detail
        for p in bottom.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.size = Pt(9)

    doc.add_paragraph()

    add_heading(doc, "Side paths (what can go wrong)", level=3)
    bullets = [
        "Coordinators can reassign a job to a different inspector; the job stays Active.",
        "If work runs past the planned end date, the job stays Active but is flagged as overdue on the board and in reports.",
        "Coordinators can mark a job complete on behalf of an inspector if the inspector is unavailable.",
        "Cancelled jobs are removed from the active pipeline.",
    ]
    for item in bullets:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_paragraph()


def build_access_table(doc):
    add_heading(doc, "App tabs — who can see what", level=2)
    add_body(
        doc,
        "The table below lists each area of the app, what it is for in plain language, "
        "and which user roles can open it. Managers and coordinators see the same menus. "
        "Inspectors see a shorter menu focused on their own work.",
    )

    rows = [
        ("Dashboard", "Summary screen: open jobs, utilization, upcoming work, and quick actions.", "Coordinator, Manager, Admin", "Inspector (own work only)"),
        ("Planner", "Calendar view of who is booked, on leave, or in training; spot scheduling conflicts.", "Coordinator, Manager, Admin", "—"),
        ("Jobs", "Main workspace: pipeline board for staff; assignment list, activity logs, and timesheets for inspectors.", "Coordinator, Manager, Admin", "Inspector"),
        ("Job detail", "Single job page: dates, inspector assignment, daily logs, schedule vs completion, mark complete.", "Coordinator, Manager, Admin", "Inspector (own assignments)"),
        ("Departments", "Workload and headcount by inspection department.", "Coordinator, Manager, Admin", "—"),
        ("Competency", "Who holds which certifications and which certs are expiring.", "Coordinator, Manager, Admin", "—"),
        ("Reports", "Inspector performance, utilization, on-time completion, and engagement.", "Coordinator, Manager, Admin", "—"),
        ("Leave", "Record and manage time off; inspectors edit only their own leave.", "Coordinator, Manager, Admin (all staff)", "Inspector (own leave)"),
        ("Job types", "Set up types of inspection work and required certifications.", "Coordinator, Manager, Admin", "—"),
        ("Inspectors", "Staff directory, profiles, assignment history, and activity.", "Coordinator, Manager, Admin", "—"),
        ("Clients", "Client companies used when creating jobs.", "Coordinator, Manager, Admin", "—"),
        ("Notifications", "Bell icon in the sidebar — alerts for assignments and job completions.", "All logged-in users", "All logged-in users"),
    ]

    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    headers = ["Tab / area", "What it does (plain English)", "Coordinator / Manager / Admin", "Inspector"]
    hdr = table.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = text
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(10)
        set_cell_shading(hdr[i], "E8F4F3")

    for tab, desc, staff, inspector in rows:
        row = table.add_row().cells
        row[0].text = tab
        row[1].text = desc
        row[2].text = staff
        row[3].text = inspector
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)

    doc.add_paragraph()
    add_body(
        doc,
        "Note: Admin has the same access as Coordinator and Manager in this version of the app.",
    )


def main():
    doc = Document()

    title = doc.add_heading("IRPPMS — Plain-language guide", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph("Inspector Resource Planning & Performance Management System")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in sub.runs:
        run.italic = True
        run.font.size = Pt(12)
        run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    doc.add_paragraph()

    add_heading(doc, "What is this app?", level=1)
    add_body(
        doc,
        "IRPPMS is a workplace tool for inspection companies. It helps office staff plan "
        "who goes where, and helps inspectors in the field log their days, "
        "and close jobs when finished. Managers can see whether work is on time and "
        "whether teams are busy or under-used — without using spreadsheets or phone calls "
        "for every update.",
    )
    add_body(
        doc,
        "There are three main types of user:",
    )
    for role, desc in [
        ("Inspector", "Does the field work. Logs hours on assigned jobs, requests leave, marks jobs complete."),
        ("Coordinator", "Plans jobs, assigns inspectors, tracks the pipeline, and keeps certifications and leave up to date."),
        ("Manager", "Same planning tools as a coordinator, plus viewing performance reports."),
    ]:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(f"{role} — ")
        run.bold = True
        p.add_run(desc)

    doc.add_paragraph()
    build_pipeline_diagram(doc)
    build_access_table(doc)

    add_heading(doc, "Logging in", level=1)
    add_body(
        doc,
        "Open the app in your web browser (provided by your IT team). Sign in with your "
        "company email and password. If you are an inspector, you will only see Dashboard, "
        "Jobs, and Leave. Coordinators and managers see the full menu including Planner, "
        "Reports, and staff directories.",
    )

    add_heading(doc, "Where to get help", level=1)
    add_body(
        doc,
        "For day-to-day questions about a specific job, contact your coordinator. "
        "For access problems or technical issues, contact your system administrator.",
    )

    doc.core_properties.title = "IRPPMS User Guide"
    doc.core_properties.subject = "Plain-language introduction to IRPPMS"
    doc.core_properties.author = "IRPPMS"

    doc.save(OUT)
    print(f"Created: {OUT}")


if __name__ == "__main__":
    main()
