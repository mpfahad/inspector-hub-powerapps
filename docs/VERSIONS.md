# IRPPMS version baselines

Use this file (and git tags) to identify **known-good** points before large changes. Change requests stay in [`CHANGE-MANAGER.md`](./CHANGE-MANAGER.md).

## How to revert to a stable tag

```bash
# Inspect what the tag points to
git show v0.10.0-uat --stat

# Safe: create a branch from the stable tag (does not destroy newer work)
git switch -c restore/v0.10.0-uat v0.10.0-uat

# Older pre–dept-IA baseline
git switch -c restore/uat-stable v0.9.0-uat-stable

# Or tell the agent: “revert to v0.10.0-uat”
```

Do **not** run `git reset --hard` on a shared branch unless you explicitly want to discard later commits.

---

## Stable baselines

| Version / tag | Date | Git commit | Notes |
|---------------|------|------------|-------|
| **`v0.10.0-uat`** | 2026-11-15 | e0b3ef5 | **Current UAT cut.** Includes CM-018…CM-021 (dept IA, cancel/duplicate, multi-PAX assign later/now, NDT/Rope intake templates). |
| **`v0.9.0-uat-stable`** | 2026-11-04 | `d26dee4` (approx.) | Last good point **before** department-centric IA (**CM-018**). Includes Rigs roster, soft QE assign, multi-day activity logs, timesheet filters, Job Types UX. |
| `checkpoint/pre-team-create-rows` | 2026-11-10 | `c284dd8` | Intermediate: multi-PAX add/remove **before** Assign now row UX (dates/day rate). |

### What `v0.10.0-uat` includes (summary)

- Everything in `v0.9.0-uat-stable` (CM-001…CM-017)
- **CM-018** — Department-centric navigation; job types per department; cross-dept assign + loaned/borrowed
- **CM-019** — Cancel job with note; duplicate create warning
- **CM-020** — Multi-PAX teams; Assign later vs Assign now; manage team rows; rates at complete
- **CM-021** — NDT / Rope Access Excel/CSV intake templates (import deferred)

### What comes next (not in this cut)

- Import NDT / Rope Access roster + job types from filled templates
- Further product increments as logged in CHANGE-MANAGER

### Post-`v0.10.0-uat` (unreleased on this branch)

- **CM-022** — Inspection Hub branding; dept cards on home; sidebar focuses on selected dept only; Settings bottom-left
- **CM-023** — Planner booked hours on cells/rows
- **CM-024** — Auto-complete on end date (toggle + startup sweep)
- **CM-025** — New job control bar (single/team · day/hourly)
- **CM-026** — Inspector detail: active/history up; leave + expandable certs down
- **CM-027** — Admin `fahad.mp@applus.com`; Settings create/edit/bulk import/reset + export temp passwords; demo staff removed
- **CM-028** — Browser title **Inspection Hub**
- **CM-029** — Live Docker pack (`docker-compose.yml` + prod Dockerfiles + `docs/DOCKER-LIVE.md`); no seed-on-start
- **CM-030–033** — Settings dept CRUD/delete; cascade to HOLD; no Inspector logins
- **CM-034** — Dept ACL on staff APIs; Manager vs Coordinator; job autoComplete/rateBasis edit; hourly auto-close; Prisma migrations baseline; seed-off docs
- Planner: &lt;6h booked → half-width day bar (CM-023 refinement)
- Readiness audit notes: `docs/APP-READINESS-AUDIT.md` (dev compose still wipe-seeds; use live compose for other PC)

---

*Last updated: 2026-11-17*
