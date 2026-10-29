# Inspector roster — data status

**Real roster imported (2026-09-20)** from the Applus qualification matrix and client list.

| Loaded | Count |
|--------|------:|
| Inspectors | 17 |
| Qatar clients | 10 |
| Certification catalog codes | 23 |

### Mapping notes

- **QP Approved Inspector ✓** → `Inspector.qeApproved = true` (jobs with “Requires QE-approved inspector” only accept these people).
- **QP Approved Trainer** alone does **not** set `qeApproved` (e.g. Sooraj K.V is trainer-only).
- Cert issued/expiry dates are **placeholders** (`2024-01-01` → `2029-01-01`, status Valid) until HR supplies real dates.
- Sample daily CTC / billable (QAR) kept from the prior roster where names matched; new people got reasonable sample rates.
- Academic level stored on `Inspector.highestQualification` (`Diploma` / `Graduate`).

### Inspector logins

Each inspector has a local user: **work email** + password **`password123`**.

### Prefer upsert (no full wipe)

```bash
cd server
npx prisma db push
npm run db:import-roster
```

Full wipe + reseed (destroys jobs/assignments):

```bash
cd server
npm run db:seed
```

### Remaining HR / ops gaps (optional)

Still useful if available later: department, base location, hire date, years experience, weekly capacity, **real cert expiry dates**. Do **not** put CTC on this sheet — costs are edited in-app (CM-005).

| # | Full name | Employee no. | Work email | QE (QP insp.) | Qualification |
|---|-----------|--------------|------------|---------------|---------------|
| 1 | Abhilash B. Raman | VEQE1264 | abhilash.balan@applus.com | yes | Diploma |
| 2 | Afsal Vazhayil | VEQE3733 | afsal.vazhayil@applus.com | no | Diploma |
| 3 | Aju Joseph | VEQE4219 | aju.joseph@applus.com | yes | Graduate |
| 4 | Arunaravind Kakadath | VEQE0552 | arun.kakadath@applus.com | yes | Graduate |
| 5 | Binu Antony | VEQE2824 | binu.antony@applus.com | no | Graduate |
| 6 | Jinu Varghese | VEQE4331 | jinu.varghese@applus.com | no | Graduate |
| 7 | Julius Pudd Sevilla | VEQE1233 | julius.sevilla@applus.com | yes | Graduate |
| 8 | Mayil Raja Tharma Raj | VEQE2122 | mayil.tharmaraj@applus.com | no | Graduate |
| 9 | Muhammed Ayaz | VEQE4957 | muhammad.ayaz@applus.com | no | Graduate |
| 10 | Muniasamy Subburam | VEQE4812 | muniasamy.subburam@applus.com | no | Graduate |
| 11 | Muthu Sankar M. | VEQE0954 | muthusankar.mathusoothanam@applus.com | no | Diploma |
| 12 | Ram Narayan | VEQE2125 | ram.narayan@applus.com | no | Diploma |
| 13 | Sivakumar Adoni | VEQE0949 | siva.kumar@applus.com | no | Graduate |
| 14 | Sooraj K.V | VEQE4384 | sooraj.veedu@applus.com | no (trainer) | Graduate |
| 15 | Sreejith K. S. | VEQE1395 | sreejith.sankarankutty@applus.com | no | Graduate |
| 16 | Srinivasan Ethirajan | VEQE0481 | srinivasan.ethiran@applus.com | no | Graduate |
| 17 | Venkatasan Karuppiah | VEQE2119 | venkatasan.karuppiya@applus.com | no | Graduate |

*IRPPMS · roster import CM-012*
