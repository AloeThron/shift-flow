#!/usr/bin/env bash
# backup-restore drill — ทดสอบ RPO/RTO บน local PostgreSQL
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/shiftflow-${STAMP}.dump"

DATABASE_URL="${DATABASE_URL:-postgresql://shiftflow:shiftflow@localhost:5432/shiftflow?schema=public}"
RESTORE_DB="${RESTORE_DB:-shiftflow_restore_drill}"

mkdir -p "${BACKUP_DIR}"

echo "[1/5] สร้าง logical backup → ${DUMP_FILE}"
pg_dump "${DATABASE_URL}" --format=custom --file="${DUMP_FILE}"

echo "[2/5] สร้าง database ว่างสำหรับ restore: ${RESTORE_DB}"
psql "${DATABASE_URL%%/*/*}" -c "DROP DATABASE IF EXISTS ${RESTORE_DB};" postgres || true
psql "${DATABASE_URL%%/*/*}" -c "CREATE DATABASE ${RESTORE_DB};" postgres

RESTORE_URL="${DATABASE_URL%/*}/${RESTORE_DB}?schema=public"

echo "[3/5] restore dump"
pg_restore --clean --if-exists --no-owner --dbname="${RESTORE_URL}" "${DUMP_FILE}"

echo "[4/5] deploy migrations บน restored DB"
(
  cd "${ROOT_DIR}"
  DIRECT_URL="${RESTORE_URL}" DATABASE_URL="${RESTORE_URL}" pnpm db:migrate:deploy
)

echo "[5/5] smoke query"
psql "${RESTORE_URL}" -c "SELECT COUNT(*) AS org_count FROM \"Organization\";"

echo "✓ backup-restore drill สำเร็จ"
echo "  dump: ${DUMP_FILE}"
echo "  restored: ${RESTORE_DB}"
