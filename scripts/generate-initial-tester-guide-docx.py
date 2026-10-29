from docx import Document

out_path = r"D:\CURSOR\Inspector Hub\docs\IRPPMS-Initial-Tester-Guide.docx"

doc = Document()
doc.add_heading("IRPPMS Initial Tester Guide", 0)

doc.add_heading("About the app (quick intro)", level=1)
doc.add_paragraph(
    "IRPPMS (Inspector Resource Planning & Productivity Management System) helps teams plan inspections, "
    "assign inspectors, track day-to-day job progress, and review performance in one place."
)
doc.add_paragraph("It is designed for three main user groups:")
doc.add_paragraph("Inspectors: work assigned jobs, log activity, submit completion, manage their leave.", style="List Bullet")
doc.add_paragraph("Coordinators: create and assign jobs, monitor pipeline flow, plan capacity.", style="List Bullet")
doc.add_paragraph("Managers: review reports and track performance trends.", style="List Bullet")
doc.add_paragraph(
    "Use this guide during first-round testing and share feedback on usability, missing data, and workflow gaps."
)

doc.add_heading("Test login details", level=1)
doc.add_paragraph("App URL: http://localhost:5180", style="List Bullet")
doc.add_paragraph("Password for seeded users: password123", style="List Bullet")
doc.add_paragraph("Recommended test accounts:")
doc.add_paragraph("Coordinator: coordinator@irppms.local", style="List Bullet")
doc.add_paragraph("Manager: manager@irppms.local", style="List Bullet")
doc.add_paragraph("Inspector: inspector@irppms.local", style="List Bullet")

doc.add_heading("Core job pipeline (what to verify)", level=1)
doc.add_paragraph("The job pipeline is the heart of the app. Please test this flow:")
for step in [
    "New: coordinator creates job.",
    "Active: coordinator or manager assigns an inspector; work can start immediately.",
    "Completed: inspector or coordinator marks complete; the job is closed immediately.",
]:
    doc.add_paragraph(step, style="List Number")
doc.add_paragraph("Focus your feedback on:")
doc.add_paragraph("Are status changes clear and easy to understand?", style="List Bullet")
doc.add_paragraph("Is it obvious what action is needed at each stage?", style="List Bullet")
doc.add_paragraph("Are overdue / early / on-time indicators useful?", style="List Bullet")

doc.add_heading("App sections by category", level=1)
sections = [
    (
        "1) Dashboard",
        ["Purpose: Quick operational snapshot: workload, actions, and current activity."],
        [
            "Can you quickly identify what needs attention?",
            "Are KPI cards and summaries understandable?",
            "Is anything important missing from the first screen?",
        ],
    ),
    (
        "2) Jobs & Pipeline",
        ["Purpose: Create jobs, assign inspectors, track execution, and close completed work."],
        [
            "End-to-end flow (new job to closed)",
            "Assign-to-active behaviour (job becomes Active immediately)",
            "Activity logging and completion clarity",
            "Job detail completeness",
        ],
    ),
    (
        "3) Reports",
        ["Purpose: Measure team performance and delivery quality."],
        [
            "Are report labels understandable to non-technical users?",
            "Do insights feel fair and actionable?",
            "What metrics/charts should be added or removed?",
        ],
    ),
    (
        "4) Planner & Capacity",
        ["Purpose: Schedule people against jobs and avoid conflict/overload."],
        [
            "Week/day visibility",
            "Conflict highlighting",
            "Department filtering",
            "Ease of planning decisions",
        ],
    ),
    (
        "5) People & Governance Tabs",
        [
            "Departments: Workload and staffing overview by department.",
            "Competency: Certification coverage and expiry tracking.",
            "Inspectors: Profile-level assignment/activity context.",
            "Leave: Leave creation/editing and role-based visibility.",
            "Job Types / Clients: Reference/configuration setup for operational use.",
        ],
        [
            "Are these tabs easy to navigate?",
            "Is data scoped correctly by role?",
            "Are labels and terms clear to business users?",
        ],
    ),
]
for title, purpose_lines, tests in sections:
    doc.add_heading(title, level=2)
    for line in purpose_lines:
        doc.add_paragraph(line, style="List Bullet")
    doc.add_paragraph("What to test:")
    for test in tests:
        doc.add_paragraph(test, style="List Bullet")

doc.add_heading("Role access summary", level=1)
doc.add_paragraph("Inspector: Dashboard, Jobs, Leave", style="List Bullet")
doc.add_paragraph(
    "Coordinator: Dashboard, Planner, Jobs, Departments, Competency, Reports, Leave, Job Types, Inspectors, Clients",
    style="List Bullet",
)
doc.add_paragraph("Manager: same staff navigation as coordinator", style="List Bullet")

doc.add_heading("Feedback template (copy/paste)", level=1)
for line in [
    "Role tested as: Inspector / Coordinator / Manager",
    "Area tested: Dashboard / Jobs / Reports / Planner / Other",
    "What worked well:",
    "What was confusing:",
    "Bug or issue found:",
    "Suggested improvement:",
    "Priority: High / Medium / Low",
]:
    doc.add_paragraph(line, style="List Bullet")

doc.add_heading("Suggested first test scenarios", level=1)
for step in [
    "Coordinator creates a new job and assigns an inspector (job becomes Active).",
    "Inspector logs daily activity on the assigned job.",
    "Inspector marks job complete and confirms it is closed immediately.",
    "Staff reviews Reports page for timing/performance insights.",
    "Inspector creates leave; staff verifies visibility and audit trail.",
]:
    doc.add_paragraph(step, style="List Number")

doc.save(out_path)
print(f"Created: {out_path}")
