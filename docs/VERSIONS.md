# IRPPMS version baselines

Use this file (and git tags) to identify **known-good** points before large changes. Change requests stay in [`CHANGE-MANAGER.md`](./CHANGE-MANAGER.md).

## How to revert to a stable tag

```bash
# Inspect what the tag points to
git show v0.9.0-uat-stable --stat

# Safe: create a branch from the stable tag (does not destroy newer work)
git switch -c restore/uat-stable v0.9.0-uat-stable

# Or tell the agent: “revert to v0.9.0-uat-stable”
```

Do **not** run `git reset --hard` on a shared branch unless you explicitly want to discard later commits.

---

## Stable baselines

| Version / tag | Date | Git commit | Notes |
|---------------|------|------------|-------|
| **`v0.9.0-uat-stable`** | 2026-11-04 | *(tagged on commit that includes CM-014–CM-017)* | **Current UAT stable.** Last good point **before** department-centric IA (**CM-018**). Includes Rigs roster, soft QE assign, multi-day activity logs, timesheet filters, Job Types left/price chart right + add qualifications. |

### What `v0.9.0-uat-stable` includes (summary)

- CM-001 … CM-013 (prior UAT stack)
- **CM-014** — Rigs HR roster + create employee + Inspectors by dept
- **CM-015** — Soft QE assign / override + job-card assignment note
- **CM-016** — Multi-day activity logs
- **CM-017** — Timesheet filters; Job Types UX; create certifications

### What comes next (not in this stable)

- **CM-018** — Department-centric navigation; job types per department; cross-dept assign with amber “loaned/borrowed” markers

---

*Last updated: 2026-11-04*
