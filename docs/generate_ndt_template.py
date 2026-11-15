"""Generate NDT + Rope Access multi-sheet Excel data template for IRPPMS."""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

header_fill = PatternFill("solid", fgColor="1E3A5F")
header_font = Font(color="FFFFFF", bold=True, size=11)
required_fill = PatternFill("solid", fgColor="FEF3C7")
example_fill = PatternFill("solid", fgColor="F0FDFA")
note_font = Font(color="64748B", italic=True, size=10)
title_font = Font(bold=True, size=14, color="1E3A5F")
thin = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)


def style_header(ws, row, cols):
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = thin
    ws.row_dimensions[row].height = 36


def autosize(ws, min_w=12, max_w=42):
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        length = 0
        for cell in col:
            if cell.value is None:
                continue
            length = max(length, min(max_w, len(str(cell.value)) + 2))
        ws.column_dimensions[letter].width = max(min_w, length)


def write_rows(ws, start_row, rows, fill_example=True):
    for r, row in enumerate(rows, start=start_row):
        for c, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=val if val != "" else None)
            if fill_example:
                cell.fill = example_fill
            cell.border = thin
    return start_row + len(rows)


def blank_rows(ws, start_row, count, cols, required_cols=()):
    for r in range(start_row, start_row + count):
        for c in range(1, cols + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = thin
            if c in required_cols:
                cell.fill = required_fill


def main():
    wb = Workbook()

    # ----- README -----
    ws = wb.active
    ws.title = "README"
    ws["A1"] = "IRPPMS — NDT Inspection & Rope Access data template"
    ws["A1"].font = title_font
    ws.merge_cells("A1:F1")
    ws["A2"] = (
        "Department focus: NDT Inspection (code NDT). "
        "Use for inspectors who perform NDT methods and/or rope-access NDT."
    )
    ws["A2"].font = note_font
    ws.merge_cells("A2:F2")

    instructions = [
        ("How to fill", ""),
        ("1", "Complete sheets in order: Cert_Catalog → Job_Types → JobType_Requirements → Clients → Inspectors → Inspector_Certs → (optional) Jobs."),
        ("2", "Yellow cells in blank rows = required for import. Leave optional columns blank if unknown."),
        ("3", "Dates must be YYYY-MM-DD (e.g. 2024-06-15)."),
        ("4", "Employee_No must be unique (prefer Order Number VEQE… if used elsewhere in IRPPMS)."),
        ("5", "Cert_Code on Inspector_Certs / JobType_Requirements must match Cert_Catalog exactly."),
        ("6", "Job_Type_Code must match Job_Types.Code. Client_Name must match Clients.Name."),
        ("7", "QE_Approved = Yes only if QP/QE approved inspector (not trainer-only)."),
        ("8", "Daily_Cost_QAR / Daily_Billable_QAR are Admin-only in-app; include only if Finance provides them."),
        ("9", "Teal sample rows show format — replace or delete before sending final data."),
        ("10", "Do not rename sheet names or column headers — they map to the IRPPMS import."),
        ("", ""),
        ("Sheets in this workbook", ""),
        ("README", "These instructions"),
        ("Lookups", "Allowed values for status, Yes/No, academic level, etc."),
        ("Cert_Catalog", "Qualification / method codes (UT, PAUT, IRATA, …)"),
        ("Job_Types", "NDT / rope-access test types offered by the department"),
        ("JobType_Requirements", "Which certs each test type requires"),
        ("Clients", "Client sites (shared across departments)"),
        ("Inspectors", "People home-department = NDT"),
        ("Inspector_Certs", "Who holds which qualification + expiry"),
        ("Jobs", "Optional backlog jobs to load under NDT"),
    ]
    ws["A4"] = "Section / #"
    ws["B4"] = "Detail"
    style_header(ws, 4, 2)
    for i, (a, b) in enumerate(instructions, start=5):
        ws.cell(row=i, column=1, value=a)
        ws.cell(row=i, column=2, value=b)
        if a and not a[0].isdigit():
            ws.cell(row=i, column=1).font = Font(bold=True)
    autosize(ws)
    ws.column_dimensions["B"].width = 100

    # ----- Lookups -----
    ws = wb.create_sheet("Lookups")
    ws["A1"] = "Allowed values (reference). Do not change unless adding a new allowed value."
    ws["A1"].font = title_font
    ws.merge_cells("A1:F1")
    headers = [
        "Inspector_Status",
        "Yes_No",
        "Highest_Qualification",
        "Job_Priority",
        "Job_Status",
        "Mandatory",
    ]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, 6)
    cols_data = [
        ["Active", "OnLeave", "Training", "Inactive"],
        ["Yes", "No"],
        ["Diploma", "Graduate", "Certificate", "Other"],
        ["Low", "Normal", "High", "Urgent"],
        ["Draft", "Proposed", "PendingAcceptance", "Active", "Completed", "Closed", "Cancelled"],
        ["Yes", "No"],
    ]
    for col, values in enumerate(cols_data, start=1):
        for r, v in enumerate(values, start=4):
            ws.cell(row=r, column=col, value=v)
    autosize(ws)

    # ----- Cert_Catalog -----
    ws = wb.create_sheet("Cert_Catalog")
    ws["A1"] = "Certification / qualification catalog (NDT methods + rope access). Add rows as needed."
    ws["A1"].font = note_font
    ws.merge_cells("A1:E1")
    headers = ["Cert_Code", "Cert_Name", "Issuer", "Validity_Months", "Notes"]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    certs = [
        ("NDT-UT-L2", "Ultrasonic Testing Level II", "ASNT/PCN", 60, "Common UT"),
        ("NDT-UT-L3", "Ultrasonic Testing Level III", "ASNT/PCN", 60, ""),
        ("NDT-PAUT-L2", "Phased Array UT Level II", "PCN/ISO 9712", 60, ""),
        ("NDT-TOFD-L2", "TOFD Level II", "PCN/ISO 9712", 60, ""),
        ("NDT-MT-L2", "Magnetic Particle Level II", "ASNT/PCN", 60, ""),
        ("NDT-PT-L2", "Penetrant Testing Level II", "ASNT/PCN", 60, ""),
        ("NDT-RT-L2", "Radiographic Testing Level II", "ASNT/PCN", 60, ""),
        ("NDT-VT-L2", "Visual Testing Level II", "ASNT/PCN", 60, ""),
        ("NDT-ET-L2", "Eddy Current Level II", "ASNT/PCN", 60, ""),
        ("NDT-LT-L2", "Leak Testing Level II", "ASNT", 60, "Optional"),
        ("CSWIP-3.1", "Welding Inspector 3.1", "TWI", 60, "Often paired with NDT"),
        ("CSWIP-3.2", "Senior Welding Inspector 3.2", "TWI", 60, ""),
        ("API-510", "Pressure Vessel Inspector", "API", 36, ""),
        ("API-570", "Piping Inspector", "API", 36, ""),
        ("API-653", "Aboveground Storage Tank Inspector", "API", 36, ""),
        ("IRATA-L1", "IRATA Rope Access Level 1", "IRATA", 36, "Rope access"),
        ("IRATA-L2", "IRATA Rope Access Level 2", "IRATA", 36, ""),
        ("IRATA-L3", "IRATA Rope Access Level 3 Supervisor", "IRATA", 36, ""),
        ("SPRAT-L1", "SPRAT Rope Access Level I", "SPRAT", 36, "Alt. to IRATA"),
        ("SPRAT-L2", "SPRAT Rope Access Level II", "SPRAT", 36, ""),
        ("SPRAT-L3", "SPRAT Rope Access Level III", "SPRAT", 36, ""),
        ("OFFSHORE", "Offshore / HUET / BOSIET (as applicable)", "Op. cert", 48, "Site access"),
        (
            "QE-INSP",
            "QE / QP Approved Inspector",
            "QP",
            36,
            "Also set QE_Approved=Yes on Inspectors sheet",
        ),
    ]
    next_row = write_rows(ws, 4, certs)
    blank_rows(ws, next_row, 15, 5, required_cols=(1, 2))
    autosize(ws)
    ws.column_dimensions["B"].width = 42
    ws.column_dimensions["E"].width = 40

    # ----- Job_Types -----
    ws = wb.create_sheet("Job_Types")
    ws["A1"] = "Test / service types under NDT Inspection. Code unique within NDT department."
    ws["A1"].font = note_font
    ws.merge_cells("A1:F1")
    headers = ["Code", "Name", "Description", "Default_Price_QAR", "Active", "Notes"]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    job_types = [
        ("NDT-UT", "UT Thickness / Flaw Survey", "Conventional ultrasonic inspection", 2800, "Yes", ""),
        ("NDT-PAUT", "PAUT / TOFD Survey", "Phased array and/or TOFD", 4500, "Yes", ""),
        ("NDT-MT", "Magnetic Particle Inspection", "MT surface inspection", 1800, "Yes", ""),
        ("NDT-PT", "Liquid Penetrant Inspection", "PT surface inspection", 1600, "Yes", ""),
        ("NDT-RT", "Radiographic Inspection", "RT film or digital", 5200, "Yes", ""),
        ("NDT-VT", "Visual Inspection (NDT)", "VT / welding visual", 1400, "Yes", ""),
        ("NDT-ET", "Eddy Current Inspection", "ET tubing / surface", 3600, "Yes", ""),
        ("NDT-MULTI", "Multi-method NDT Package", "Combined methods on one scope", 6000, "Yes", ""),
        ("NDT-RA-UT", "Rope Access UT", "UT delivered via rope access", 3800, "Yes", "Requires IRATA + UT"),
        ("NDT-RA-MULTI", "Rope Access Multi-NDT", "Multi-method via rope access", 5200, "Yes", "Requires IRATA + NDT"),
        ("NDT-WELD", "Welding Inspection + NDT", "CSWIP scope with NDT support", 3200, "Yes", ""),
    ]
    next_row = write_rows(ws, 4, job_types)
    blank_rows(ws, next_row, 12, 6, required_cols=(1, 2))
    autosize(ws)
    ws.column_dimensions["C"].width = 40

    # ----- JobType_Requirements -----
    ws = wb.create_sheet("JobType_Requirements")
    ws["A1"] = "Link each Job_Type.Code to required Cert_Catalog.Cert_Code. One row per requirement."
    ws["A1"].font = note_font
    ws.merge_cells("A1:D1")
    headers = ["Job_Type_Code", "Cert_Code", "Mandatory", "Notes"]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    reqs = [
        ("NDT-UT", "NDT-UT-L2", "Yes", ""),
        ("NDT-PAUT", "NDT-PAUT-L2", "Yes", ""),
        ("NDT-PAUT", "NDT-UT-L2", "Yes", "Usually also holds conventional UT"),
        ("NDT-MT", "NDT-MT-L2", "Yes", ""),
        ("NDT-PT", "NDT-PT-L2", "Yes", ""),
        ("NDT-RT", "NDT-RT-L2", "Yes", ""),
        ("NDT-VT", "NDT-VT-L2", "Yes", ""),
        ("NDT-ET", "NDT-ET-L2", "Yes", ""),
        ("NDT-MULTI", "NDT-UT-L2", "Yes", "Adjust to actual package"),
        ("NDT-MULTI", "NDT-MT-L2", "No", ""),
        ("NDT-RA-UT", "IRATA-L1", "Yes", "Min IRATA L1; prefer L2+"),
        ("NDT-RA-UT", "NDT-UT-L2", "Yes", ""),
        ("NDT-RA-MULTI", "IRATA-L2", "Yes", ""),
        ("NDT-RA-MULTI", "NDT-UT-L2", "Yes", ""),
        ("NDT-WELD", "CSWIP-3.1", "Yes", ""),
    ]
    next_row = write_rows(ws, 4, reqs)
    blank_rows(ws, next_row, 20, 4, required_cols=(1, 2))
    autosize(ws)

    # ----- Clients -----
    ws = wb.create_sheet("Clients")
    ws["A1"] = "Clients are global (not NDT-only). Add new clients or reuse existing IRPPMS names exactly."
    ws["A1"].font = note_font
    ws.merge_cells("A1:G1")
    headers = ["Name", "Industry", "Location", "Latitude", "Longitude", "Contact", "Email"]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    clients = [
        ("QatarEnergy LNG", "Oil & Gas", "Ras Laffan Industrial City", 25.913, 51.555, "", ""),
        ("QatarEnergy Refining", "Oil & Gas", "Mesaieed Industrial City", 24.991, 51.549, "", ""),
        ("Qatar Steel", "Metals", "Mesaieed", 24.995, 51.55, "", ""),
        ("QChem", "Petrochemicals", "Mesaieed", 25.01, 51.54, "", ""),
        ("Dolphin Energy", "Oil & Gas", "Ras Laffan", 25.91, 51.54, "", ""),
        ("Sample Client Co", "Oil & Gas", "Doha Industrial Area", 25.178, 51.442, "Site contact name", "contact@example.com"),
    ]
    next_row = write_rows(ws, 4, clients)
    blank_rows(ws, next_row, 25, 7, required_cols=(1,))
    autosize(ws)
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["C"].width = 28

    # ----- Inspectors -----
    ws = wb.create_sheet("Inspectors")
    ws["A1"] = "Home department = NDT. One row per person. Teal rows = examples — replace with real roster."
    ws["A1"].font = note_font
    ws.merge_cells("A1:N1")
    headers = [
        "Employee_No",
        "Full_Name",
        "Email",
        "Job_Title",
        "Status",
        "QE_Approved",
        "Highest_Qualification",
        "Base_Location",
        "Hire_Date",
        "Years_Experience",
        "Weekly_Capacity_Hrs",
        "Daily_Cost_QAR",
        "Daily_Billable_QAR",
        "Notes",
    ]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    inspectors = [
        (
            "VEQE5001",
            "Example UT Inspector",
            "ut.inspector@example.com",
            "NDT Ultrasonic Inspector",
            "Active",
            "No",
            "Diploma",
            "Doha",
            "2021-03-15",
            8,
            40,
            "",
            "",
            "Replace with real data",
        ),
        (
            "VEQE5002",
            "Example PAUT / Rope Tech",
            "paut.rope@example.com",
            "Multi-discipline NDT Rope Access",
            "Active",
            "Yes",
            "Graduate",
            "Ras Laffan",
            "2019-07-01",
            12,
            40,
            "",
            "",
            "Holds PAUT + IRATA L2",
        ),
        (
            "VEQE5003",
            "Example Rope Supervisor",
            "ra.supervisor@example.com",
            "Rope Access Level III Supervisor",
            "Active",
            "No",
            "Graduate",
            "Doha",
            "2018-01-10",
            15,
            40,
            "",
            "",
            "IRATA L3 — may support NDT crews",
        ),
    ]
    next_row = write_rows(ws, 4, inspectors)
    blank_rows(ws, next_row, 40, 14, required_cols=(1, 2))
    dv_status = DataValidation(type="list", formula1='"Active,OnLeave,Training,Inactive"', allow_blank=True)
    dv_yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    dv_qual = DataValidation(type="list", formula1='"Diploma,Graduate,Certificate,Other"', allow_blank=True)
    ws.add_data_validation(dv_status)
    ws.add_data_validation(dv_yn)
    ws.add_data_validation(dv_qual)
    dv_status.add("E4:E100")
    dv_yn.add("F4:F100")
    dv_qual.add("G4:G100")
    autosize(ws)
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 30
    ws.column_dimensions["D"].width = 32
    ws.column_dimensions["N"].width = 36

    # ----- Inspector_Certs -----
    ws = wb.create_sheet("Inspector_Certs")
    ws["A1"] = (
        "One row per certificate held. Employee_No + Cert_Code must match Inspectors / Cert_Catalog. "
        "Prefer real Issued_On / Expires_On."
    )
    ws["A1"].font = note_font
    ws.merge_cells("A1:F1")
    headers = ["Employee_No", "Cert_Code", "Issued_On", "Expires_On", "Certificate_No", "Notes"]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    icerts = [
        ("VEQE5001", "NDT-UT-L2", "2023-01-15", "2028-01-14", "", "Example"),
        ("VEQE5001", "NDT-MT-L2", "2022-06-01", "2027-05-31", "", ""),
        ("VEQE5002", "NDT-PAUT-L2", "2022-09-10", "2027-09-09", "", ""),
        ("VEQE5002", "NDT-UT-L2", "2021-04-20", "2026-04-19", "", ""),
        ("VEQE5002", "IRATA-L2", "2024-02-01", "2027-01-31", "", ""),
        ("VEQE5002", "OFFSHORE", "2024-05-01", "2028-04-30", "", ""),
        ("VEQE5003", "IRATA-L3", "2023-11-01", "2026-10-31", "", ""),
    ]
    next_row = write_rows(ws, 4, icerts)
    blank_rows(ws, next_row, 50, 6, required_cols=(1, 2, 3, 4))
    autosize(ws)

    # ----- Jobs -----
    ws = wb.create_sheet("Jobs")
    ws["A1"] = (
        "Optional. Department = NDT. Client_Name and Job_Type_Code must match other sheets. "
        "Leave blank if you only want master data first."
    )
    ws["A1"].font = note_font
    ws.merge_cells("A1:L1")
    headers = [
        "Job_Ref",
        "Title",
        "Client_Name",
        "Job_Type_Code",
        "Location",
        "Start_Date",
        "End_Date",
        "Priority",
        "Status",
        "Requires_QE",
        "Agreed_Price_QAR",
        "Scope_Notes",
    ]
    for i, h in enumerate(headers, 1):
        ws.cell(row=3, column=i, value=h)
    style_header(ws, 3, len(headers))
    jobs = [
        (
            "",
            "UT survey — Example Tank Farm",
            "QatarEnergy LNG",
            "NDT-UT",
            "Ras Laffan",
            "2026-12-01",
            "2026-12-10",
            "Normal",
            "Draft",
            "No",
            "",
            "Example only — leave Job_Ref blank to auto-number on import",
        ),
        (
            "",
            "Rope access PAUT — Flare structure",
            "QatarEnergy Refining",
            "NDT-RA-UT",
            "Mesaieed",
            "2026-12-05",
            "2026-12-15",
            "High",
            "Draft",
            "Yes",
            "",
            "",
        ),
    ]
    next_row = write_rows(ws, 4, jobs)
    blank_rows(ws, next_row, 30, 12, required_cols=(2, 3, 4, 6, 7))
    dv_pri = DataValidation(type="list", formula1='"Low,Normal,High,Urgent"', allow_blank=True)
    dv_st = DataValidation(
        type="list",
        formula1='"Draft,Proposed,PendingAcceptance,Active,Completed,Closed,Cancelled"',
        allow_blank=True,
    )
    dv_yn2 = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    ws.add_data_validation(dv_pri)
    ws.add_data_validation(dv_st)
    ws.add_data_validation(dv_yn2)
    dv_pri.add("H4:H100")
    dv_st.add("I4:I100")
    dv_yn2.add("J4:J100")
    autosize(ws)
    ws.column_dimensions["B"].width = 36
    ws.column_dimensions["C"].width = 24
    ws.column_dimensions["L"].width = 44

    out = Path(__file__).resolve().parent / "NDT-RopeAccess-Data-Template.xlsx"
    wb.save(out)
    print(f"Wrote {out}")
    print("Sheets:", wb.sheetnames)


if __name__ == "__main__":
    main()
