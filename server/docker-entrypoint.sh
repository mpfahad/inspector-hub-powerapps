#!/bin/sh
set -e

# Live/UAT: apply migrations (or db push fallback). Never wipe-seed here.
# Optional greenfield seed: docker compose --profile seed run --rm seed
echo "[inspection-hub-api] prisma migrate deploy…"
if ! npx prisma migrate deploy; then
  echo "[inspection-hub-api] migrate deploy failed — falling back to db push (existing volumes / pre-migration DBs)"
  npx prisma db push --skip-generate
fi

echo "[inspection-hub-api] starting…"
exec "$@"
