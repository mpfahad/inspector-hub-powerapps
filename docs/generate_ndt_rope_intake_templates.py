"""Generate two intake templates for NDT / Rope Access.

1) Employees (+ held certificates) — one row per person-cert
2) Job types (+ required certs) — one row per type-requirement

Certificate catalog is derived on import from unique Cert_Code values
appearing in either file (plus Cert_Name / Issuer when provided).
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUT = Path(__file__).resolve().parent

header_fill = PatternFill("solid", fgColor="1E3A5F")
header_font = Font(color="FFFFFF", bold=True, size=11)
required_fill = PatternFill("solid", fgColor="FEF3C7")
example_fill = PatternFill("solid", fgColor="F0FDFA")
note_font = Font(color="64748B", italic=True, size=10)
title_font = Font(bold=True, size=13, color="1E3A5F")
thin = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)


def style_header(ws, row: int, cols: int) -> None:
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = thin
    ws.row_dimensions[row].height = 40


def autosize(ws, min_w=12, max_w=36) -> None:
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        length = 0
        for cell in col:
            if cell.value is None:
                continue
            length = max(length, min(max_w, len(str(cell.value)) + 2))
        ws.column_dimensions[letter].width = max(min_w, length)


def write_table(ws, title: str, note: str, headers: list[str], rows: list[tuple], blank: int, required_cols: set[int]) -> None:
    ws["A1"] = title
    ws["A1"].font = title_font
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws["A2"] = note
    ws["A2"].font = note_font
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))

    for i, h in enumerate(headers, 1):
        ws.cell(row=4, column=i, value=h)
    style_header(ws, 4, len(headers))

    r = 5
    for row in rows:
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val if val != "" else None)
            cell.fill = example_fill
            cell.border = thin
        r += 1

    for _ in range(blank):
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = thin
            if c in required_cols:
                cell.fill = required_fill
        r += 1

    autosize(ws)


def to_csv(path: Path, headers: list[str], rows: list[tuple]) -> None:
    import csv

    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(headers)
        for row in rows:
            w.writerow(["" if v is None else v for v in row])


def build_employees() -> None:
    headers = [
        "Employee_No",
        "Full_Name",
        "Department_Code",
        "Email",
        "Job_Title",
        "Status",
        "QE_Approved",
        "Highest_Qualification",
        "Base_Location",
        "Hire_Date",
        "Daily_Cost_QAR",
        "Daily_Billable_QAR",
        "Cert_Code",
        "Cert_Name",
        "Cert_Issuer",
        "Cert_Issued_On",
        "Cert_Expires_On",
    ]
    # One row per held certificate (repeat employee fields). Leave cert cols blank if none yet.
    rows = [
        (
            "E5001",
            "Example UT Inspector",
            "NDT",
            "ut.example@company.com",
            "NDT Ultrasonic Inspector",
            "Active",
            "No",
            "Diploma",
            "Doha",
            "2021-03-15",
            180,
            250,
            "NDT-UT-L2",
            "Ultrasonic Testing Level II",
            "ASNT/PCN",
            "2022-01-10",
            "2027-01-09",
        ),
        (
            "E5001",
            "Example UT Inspector",
            "NDT",
            "ut.example@company.com",
            "NDT Ultrasonic Inspector",
            "Active",
            "No",
            "Diploma",
            "Doha",
            "2021-03-15",
            180,
            250,
            "NDT-MT-L2",
            "Magnetic Particle Level II",
            "ASNT/PCN",
            "2022-06-01",
            "2027-05-31",
        ),
        (
            "E5002",
            "Example Rope Access NDT Tech",
            "NDT",
            "ra.ndt@company.com",
            "Multi-discipline NDT Rope Access",
            "Active",
            "Yes",
            "Graduate",
            "Ras Laffan",
            "2020-08-01",
            200,
            275,
            "NDT-UT-L2",
            "Ultrasonic Testing Level II",
            "PCN",
            "2021-04-12",
            "2026-04-11",
        ),
        (
            "E5002",
            "Example Rope Access NDT Tech",
            "NDT",
            "ra.ndt@company.com",
            "Multi-discipline NDT Rope Access",
            "Active",
            "Yes",
            "Graduate",
            "Ras Laffan",
            "2020-08-01",
            200,
            275,
            "IRATA-L2",
            "IRATA Rope Access Level 2",
            "IRATA",
            "2023-02-20",
            "2026-02-19",
        ),
        (
            "E5003",
            "Example Rope Tech (no NDT yet)",
            "RIGS",
            "",
            "Multi Disciplined Rope Technician",
            "Active",
            "No",
            "",
            "Doha",
            "2023-10-08",
            "",
            "",
            "IRATA-L1",
            "IRATA Rope Access Level 1",
            "IRATA",
            "2024-01-15",
            "2027-01-14",
        ),
    ]

    wb = Workbook()
    ws = wb.active
    ws.title = "Employees_Certs"
    write_table(
        ws,
        "NDT / Rope Access — Employees & certificates held",
        "Yellow = required for import. One row per certificate held. Repeat Employee_No/Name for each cert. "
        "Department_Code: NDT or RIGS. Dates: YYYY-MM-DD. Cert catalog is built from unique Cert_Code (+ Name/Issuer).",
        headers,
        rows,
        blank=40,
        required_cols={1, 2, 3},
    )
    xlsx = OUT / "NDT-RopeAccess-Employees.xlsx"
    wb.save(xlsx)
    to_csv(OUT / "NDT-RopeAccess-Employees.csv", headers, rows)
    print(f"Wrote {xlsx.name} and CSV")


def build_job_types() -> None:
    headers = [
        "Department_Code",
        "Job_Type_Code",
        "Job_Type_Name",
        "Description",
        "Default_Price_QAR",
        "Active",
        "Required_Cert_Code",
        "Required_Cert_Name",
        "Mandatory",
    ]
    rows = [
        ("NDT", "NDT-UT", "UT Thickness / Flaw Survey", "Conventional ultrasonic", 2800, "Yes", "NDT-UT-L2", "Ultrasonic Testing Level II", "Yes"),
        ("NDT", "NDT-PAUT", "PAUT / TOFD Survey", "Phased array and/or TOFD", 4500, "Yes", "NDT-PAUT-L2", "Phased Array UT Level II", "Yes"),
        ("NDT", "NDT-PAUT", "PAUT / TOFD Survey", "Phased array and/or TOFD", 4500, "Yes", "NDT-UT-L2", "Ultrasonic Testing Level II", "Yes"),
        ("NDT", "NDT-MT", "Magnetic Particle Inspection", "MT surface inspection", 1800, "Yes", "NDT-MT-L2", "Magnetic Particle Level II", "Yes"),
        ("NDT", "NDT-PT", "Liquid Penetrant Inspection", "PT surface inspection", 1600, "Yes", "NDT-PT-L2", "Penetrant Testing Level II", "Yes"),
        ("NDT", "NDT-RT", "Radiographic Inspection", "RT film or digital", 5200, "Yes", "NDT-RT-L2", "Radiographic Testing Level II", "Yes"),
        ("NDT", "NDT-RA-UT", "Rope Access UT", "UT via rope access", 3800, "Yes", "NDT-UT-L2", "Ultrasonic Testing Level II", "Yes"),
        ("NDT", "NDT-RA-UT", "Rope Access UT", "UT via rope access", 3800, "Yes", "IRATA-L1", "IRATA Rope Access Level 1", "Yes"),
        ("NDT", "NDT-RA-MULTI", "Rope Access Multi-NDT", "Multi-method via rope", 5200, "Yes", "NDT-UT-L2", "Ultrasonic Testing Level II", "Yes"),
        ("NDT", "NDT-RA-MULTI", "Rope Access Multi-NDT", "Multi-method via rope", 5200, "Yes", "IRATA-L2", "IRATA Rope Access Level 2", "Yes"),
        ("RIGS", "RA-TECH", "Rope Access Technician Scope", "Rope access support", 2200, "Yes", "IRATA-L1", "IRATA Rope Access Level 1", "Yes"),
    ]

    wb = Workbook()
    ws = wb.active
    ws.title = "JobTypes_Reqs"
    write_table(
        ws,
        "NDT / Rope Access — Job types & required certificates",
        "Yellow = required. One row per required cert. Repeat Job_Type_Code/Name for each requirement. "
        "Cert catalog is also built from Required_Cert_Code (+ Name). Mandatory: Yes/No.",
        headers,
        rows,
        blank=30,
        required_cols={1, 2, 3, 7},
    )
    xlsx = OUT / "NDT-RopeAccess-JobTypes.xlsx"
    wb.save(xlsx)
    to_csv(OUT / "NDT-RopeAccess-JobTypes.csv", headers, rows)
    print(f"Wrote {xlsx.name} and CSV")


if __name__ == "__main__":
    build_employees()
    build_job_types()
