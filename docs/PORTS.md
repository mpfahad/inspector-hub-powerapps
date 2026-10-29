# Port & isolation guide

IRPPMS is configured to run **alongside** the contract app without sharing ports, cookies, or Docker resources.

## Ports

| Service | Contract app (typical) | IRPPMS |
|---------|------------------------|--------|
| Web (Vite) | 5173 | **5180** |
| API | 4000 | **4100** |

## Isolation layers

| Layer | IRPPMS setting |
|-------|----------------|
| **HTTP ports** | 5180 / 4100 |
| **Auth cookie** | `irppms_token` (not `token`) |
| **SQLite file** | `server/prisma/dev.db` or Docker volume `irppms-data` → `/data/irppms.db` |
| **Docker project** | `name: irppms` |
| **Containers** | `irppms-web`, `irppms-api` |
| **JWT secret** | `server/.env` → `JWT_SECRET` (separate from other apps) |
| **Identity** | Local email/password today; Entra-ready schema — see `docs/AUTH.md` |

## Run locally

```bash
# From repo root (starts API on 4100 + UI on 5180)
npm run dev
```

Or separately:

```bash
cd server && npm run dev   # :4100
cd app && npm run dev        # :5180, proxies /api → :4100
```

## Run Docker

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open http://localhost:5180

## Override ports

Set in root `.env` or shell:

```env
IRPPMS_WEB_PORT=5180
IRPPMS_API_PORT=4100
```

Update `server/.env` `PORT` and `CORS_ORIGIN` to match if you change API/web ports.
