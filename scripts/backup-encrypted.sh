#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the direct Postgres connection string}"
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_SERVICE_KEY:?Set SUPABASE_SERVICE_KEY}"
: "${BACKUP_ENCRYPTION_PASSWORD:?Set BACKUP_ENCRYPTION_PASSWORD}"
: "${BACKUP_OUTPUT_DIR:?Set BACKUP_OUTPUT_DIR to an external or synced encrypted location}"

umask 077
timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/botflow-backup.XXXXXX")"
archive_path="${BACKUP_OUTPUT_DIR%/}/botflow-${timestamp}.tar.gz.enc"

cleanup() {
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

mkdir -p -- "$BACKUP_OUTPUT_DIR"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-acl --file "$work_dir/database.dump"
npx tsx scripts/export-storage.ts "$work_dir/storage"
tar -C "$work_dir" -czf "$work_dir/backup.tar.gz" database.dump storage
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "$work_dir/backup.tar.gz" \
  -out "$archive_path" \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
shasum -a 256 "$archive_path" > "${archive_path}.sha256"

printf 'Encrypted database + Storage backup: %s\n' "$archive_path"
