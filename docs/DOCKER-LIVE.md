# Inspection Hub — live Docker on another PC

Run beside **Training Manager** and **Contract App** as its own compose stack.  
Ports: **5180** (web) · **4100** (API). Contract stays on **5173 / 4000**.

## What this pack is

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](../docker-compose.yml) | Live stack — **migrate deploy** (db push fallback), **no seed on start** |
| [`docker-compose.dev.yml`](../docker-compose.dev.yml) | Dev hot-reload (reseeds — **do not use for UAT**) |
| [`server/Dockerfile`](../server/Dockerfile) | Production API image |
| [`app/Dockerfile`](../app/Dockerfile) | Vite build + nginx (`/api` → API) |
| [`.env.example`](../.env.example) | Secrets / CORS / ports |

Empty DB: API startup still creates Admin `fahad.mp@applus.com` via `ensurePrimaryAdmin` (password not overwritten if the user already exists).

---

## Other PC — first bring-up

1. Copy the whole repo (or clone) onto the other PC.
2. Confirm ports **5180** and **4100** are free (vs Training Manager / Contract).
3. Create env:

```bash
cp .env.example .env
# Edit JWT_SECRET to a long random value (32+ chars)
# If users open http://192.168.x.x:5180 set:
#   CORS_ORIGIN=http://192.168.x.x:5180
```

4. Start:

```bash
docker compose up -d --build
```

5. Smoke:

```bash
curl http://localhost:4100/api/health
# expect: {"status":"ok","service":"irppms-api"}
```

Open **http://localhost:5180** (or `http://<pc-ip>:5180`).

Login: `fahad.mp@applus.com` / `ApplusHub2026!` (fresh volume), or your migrated UAT password if you imported the DB.

Checklist: Departments home → open Lifting → Planner → Settings → users.

---

## Bring current UAT SQLite (recommended)

Do **not** run the seed profile.

On the **dev PC**, UAT file is usually:

`server/prisma/prisma/dev.db`

On the **other PC**, after images exist:

```bash
# 1) Create volume + stop API so the file is not locked
docker compose up -d --build api
docker compose stop api

# 2) Copy host DB into the named volume as irppms.db
#    Adjust HOST_DB path to your copied file
docker run --rm ^
  -v inspection-hub-data:/data ^
  -v "D:\path\to\dev.db:/backup/dev.db:ro" ^
  alpine sh -c "cp /backup/dev.db /data/irppms.db && ls -la /data"

# Linux/mac:
# docker run --rm \
#   -v inspection-hub-data:/data \
#   -v "$PWD/server/prisma/prisma/dev.db:/backup/dev.db:ro" \
#   alpine sh -c "cp /backup/dev.db /data/irppms.db"

# 3) Start full stack (migrate/deploy upgrades schema; no seed)
docker compose up -d
```

**Never** run `docker compose --profile seed` against a volume that already has UAT data.

Backup before overwrite:

```bash
docker run --rm -v inspection-hub-data:/data -v "$PWD:/backup" alpine \
  cp /data/irppms.db /backup/irppms-backup-$(date +%Y%m%d).db
```

---

## Updates (code change, keep data)

```bash
docker compose up -d --build
# volume inspection-hub-data is preserved; entrypoint runs migrate deploy (db push fallback)
```

### NDT roster / job types (CM-041)

After pull + rebuild, load NDT employees/job types (CSVs under `server/prisma/ndt/`, same as `docs/NDT`):

```bash
docker compose exec api npx tsx prisma/import-ndt.ts
```

Local (dev DB): `npm run db:import-ndt` from `server/`.

If migrate deploy fails on an older volume that was created with `db push` only, the entrypoint falls back to `db push`. To baseline cleanly once: `npx prisma migrate resolve --applied 20261117120000_init` inside the API container, then restart.

---

## Greenfield seed (empty lab only)

**Wipes and rebuilds demo data.** Never use on a volume that has real UAT.

```bash
docker compose --profile seed run --rm seed
docker compose up -d
```

---

## Stop / remove containers (keep DB volume)

```bash
docker compose down
# volume inspection-hub-data remains
```

Remove volume only if you intend to destroy data:

```bash
docker compose down -v
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login cookie fails over HTTP | Ensure `COOKIE_SECURE=false` in `.env` |
| `JWT_SECRET` startup error | Set 32+ char secret in `.env` |
| Port in use | Change `IRPPMS_WEB_PORT` / `IRPPMS_API_PORT` or free 5180/4100 |
| Empty departments / lost users | You ran seed or wiped the volume — restore backup |
| API unhealthy | `docker compose logs api` — often Prisma/db path or secret |

---

## Dev vs live

| | Dev compose | Live compose |
|--|-------------|--------------|
| File | `docker-compose.dev.yml` | `docker-compose.yml` |
| Start | `npm run dev:docker` | `docker compose up -d --build` |
| Seed | **Every start** (destructive) | **Never** by default |
| Web | Vite hot reload | nginx static + `/api` proxy |
