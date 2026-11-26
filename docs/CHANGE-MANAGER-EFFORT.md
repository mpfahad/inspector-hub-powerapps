# IRPPMS Change Manager — Effort & cost log

Companion to [`CHANGE-MANAGER.md`](./CHANGE-MANAGER.md).  
Tracks **development effort** per change so you can see time and cost by item and as a whole.

**Rate used for costing:** **50 QAR / hour**  
**Effort type:** *Estimated* for CM-001…CM-043 (reconstructed from scope + delivery history). From **CM-044 onward**, log **actual** time when the change is implemented.

---

## How to log time (from now on)

1. When you finish a change, add/update the row in **both**:
   - [`CHANGE-MANAGER.md`](./CHANGE-MANAGER.md) — what changed  
   - **this file** — how long it took  
2. Prefer **actual** clock time (dev + debug + docs for that CM). Round to **5 minutes** (0.08 h) or **15 minutes** (0.25 h).  
3. Do **not** include: waiting for UAT feedback, meetings without coding, or prod `git pull` by others.  
4. If a CM spans several sessions, **sum** them into one `Effort` value.  
5. Update the **Running totals** table at the bottom after each new CM.

| Column | Meaning |
|--------|---------|
| **Effort** | Hours spent (e.g. `1.5` or `0.25`) |
| **Minutes** | Same effort in minutes (for small tasks) |
| **Cost (QAR)** | `Effort × 50` |
| **Basis** | `Est.` = reconstructed; `Actual` = timed while doing the work |

---

## Why a second file? (suggestion)

Keeping effort **out of** the main change register is better because:

- The main CM table stays readable for stakeholders (what / status).  
- This file is for costing and capacity (how long / how much).  
- You can change the hourly rate later and recalculate without rewriting every CM description.

**Optional upgrades later (not required now):**

- Add a **Week** column and a monthly rollup.  
- Split **Build** vs **Bugfix** vs **Docs** if you want finer costing.  
- Cap “session” entries at calendar days so overnight idle isn’t counted.

---

## Foundation (before numbered CMs)

Work that created the local UAT stack (Express / Prisma / React, core jobs/planner/auth, Qatar remapping, PowerApps → app migration). Not every hour was logged as a CM.

| ID | Period | Scope (summary) | Effort (h) | Minutes | Cost (QAR) | Basis |
|----|--------|-----------------|------------|---------|------------|-------|
| FOUND-001 | 2026-06 → 2026-09 | Core IRPPMS UAT stack, screens, workflows, seed/demo → Qatar local app | 100.00 | 6000 | 5,000 | Est. |

---

## Change effort register

| ID | Date | Change (short) | Effort (h) | Minutes | Cost (QAR) | Basis |
|----|------|----------------|------------|---------|------------|-------|
| CM-001 | 2026-09-14 | Assign → Active immediately | 2.00 | 120 | 100 | Est. |
| CM-002 | 2026-09-14 | Complete → Closed immediately | 1.50 | 90 | 75 | Est. |
| CM-003 | 2026-09-14 | Security rebuild / identity prep | 8.00 | 480 | 400 | Est. |
| CM-004 | 2026-09-14 | Reports — Activity view | 3.00 | 180 | 150 | Est. |
| CM-005 | 2026-09-14 | Inspector cost edit + history | 4.00 | 240 | 200 | Est. |
| CM-006 | 2026-09-14 | Job cert badges on board/detail | 3.00 | 180 | 150 | Est. |
| CM-007 | 2026-09-14 | QE post-assign workflow (superseded) | 4.00 | 240 | 200 | Est. |
| CM-008 | 2026-09-14 | Map + lat/lng + area warning | 6.00 | 360 | 300 | Est. |
| CM-009 | 2026-09-14 | Price chart / agreed price | 5.00 | 300 | 250 | Est. |
| CM-010 | 2026-09-15 | QE = inspector profile flag | 4.00 | 240 | 200 | Est. |
| CM-011 | 2026-09-16 | Sign out, QAR, Qatar map | 2.00 | 120 | 100 | Est. |
| CM-012 | 2026-09-20 | Real Lifting roster + clients import | 6.00 | 360 | 300 | Est. |
| CM-013 | 2026-09-20 | Admin-only CTC + cost report | 5.00 | 300 | 250 | Est. |
| CM-014 | 2026-11-04 | Rigs roster + create employee | 6.00 | 360 | 300 | Est. |
| CM-015 | 2026-11-04 | Soft QE assign override UX | 3.00 | 180 | 150 | Est. |
| CM-016 | 2026-11-04 | Multi-day activity batch | 4.00 | 240 | 200 | Est. |
| CM-017 | 2026-11-04 | Timesheet filters + Job types UX | 4.00 | 240 | 200 | Est. |
| CM-018 | 2026-11-05 | Department-centric IA (major) | 16.00 | 960 | 800 | Est. |
| CM-019 | 2026-11-10 | Cancel job + duplicate warn | 4.00 | 240 | 200 | Est. |
| CM-020 | 2026-11-12 | Multi-PAX teams / assign now | 10.00 | 600 | 500 | Est. |
| CM-021 | 2026-11-12 | NDT/Rope intake templates | 2.00 | 120 | 100 | Est. |
| CM-022 | 2026-11-15 | Inspection Hub home / dept cards | 6.00 | 360 | 300 | Est. |
| CM-023 | 2026-11-15 | Planner booked hours / half bars | 3.00 | 180 | 150 | Est. |
| CM-024 | 2026-11-15 | Auto-complete on end date | 3.00 | 180 | 150 | Est. |
| CM-025 | 2026-11-15 | New job control bar (team/rate) | 4.00 | 240 | 200 | Est. |
| CM-026 | 2026-11-15 | Inspector detail layout | 2.00 | 120 | 100 | Est. |
| CM-027 | 2026-11-15 | Admin users / bulk import / passwords | 6.00 | 360 | 300 | Est. |
| CM-028 | 2026-11-16 | Browser tab title | 0.25 | 15 | 13 | Est. |
| CM-029 | 2026-11-16 | Live Docker pack + cookie fix | 8.00 | 480 | 400 | Est. |
| CM-030 | 2026-11-16 | Settings dept CRUD + user search | 2.00 | 120 | 100 | Est. |
| CM-031 | 2026-11-16 | Bulk delete users/departments | 3.00 | 180 | 150 | Est. |
| CM-032 | 2026-11-16 | Soft dept delete + job type delete | 3.00 | 180 | 150 | Est. |
| CM-033 | 2026-11-16 | Remove Inspector logins | 3.00 | 180 | 150 | Est. |
| CM-034 | 2026-11-17 | ACL / AuthZ / migrations hardening | 10.00 | 600 | 500 | Est. |
| CM-035 | 2026-11-17 | Dept dashboard + Nisha UX batch | 6.00 | 360 | 300 | Est. |
| CM-036 | 2026-11-17 | Linked rates + auto activity + CTC | 6.00 | 360 | 300 | Est. |
| CM-037 | 2026-11-17 | Est. hours from job type × days | 1.00 | 60 | 50 | Est. |
| CM-038 | 2026-11-17 | Hourly rate prefill | 1.50 | 90 | 75 | Est. |
| CM-039 | 2026-11-22 | Editable job Price | 1.50 | 90 | 75 | Est. |
| CM-040 | 2026-11-22 | Map below board | 0.75 | 45 | 38 | Est. |
| CM-041 | 2026-11-22 | NDT CSV import (+ Docker fixes) | 4.00 | 240 | 200 | Est. |
| CM-042 | 2026-11-25 | Inspector delete + bulk uploads | 5.00 | 300 | 250 | Est. |
| CM-043 | 2026-11-26 | User Guide folder | 1.00 | 60 | 50 | Est. |
| CM-044 | 2026-11-26 | Effort log + historical estimates | 0.75 | 45 | 38 | Actual |

---

## Running totals

| Bucket | Hours | Cost @ 50 QAR/h |
|--------|------:|----------------:|
| Foundation (FOUND-001) | 100.00 | **5,000 QAR** |
| CM-001 … CM-044 | 183.75 | **9,188 QAR** |
| **Grand total (est.)** | **283.75** | **14,188 QAR** |

### Rounded management summary

| | |
|--|--:|
| **~ Development hours so far** | **≈ 280–290 h** |
| **Hourly rate** | **50 QAR** |
| **Estimated spend** | **≈ 14,000–14,500 QAR** |
| **Of which numbered CMs only** | **≈ 9,200 QAR** |
| **Of which pre-CM foundation** | **≈ 5,000 QAR** |

> These are **engineering estimates**, not timesheet-certified hours. Calendar span was longer (Jun–Nov 2026) because of gaps between UAT waves. Going forward, **Actual** rows will make the total more precise.

---

## Template for the next change

Copy into the table when CM-045+ is done:

```text
| CM-0xx | YYYY-MM-DD | Short title | H.HH | MMM | (H.HH × 50) | Actual |
```

Then refresh **Running totals**.

---

*Last updated: 2026-11-26 (CM-044 effort log created)*
