#!/bin/sh
set -e

# Live/UAT: sync schema only — never wipe-seed here.
# Optional greenfield seed: docker compose --profile seed run --rm seed
echo "[inspection-hub-api] prisma db push…"
npx prisma db push --skip-generate

echo "[inspection-hub-api] starting…"
exec "$@"
