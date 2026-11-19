#!/usr/bin/env bash
#
# Restore a custom-format dump into a database in the running Postgres
# container, dropping existing objects first.
#
#   ./scripts/restore.sh <db> <file>
#
# Example:
#   ./scripts/restore.sh restodash backups/restodash.dump
#
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <db> <file>" >&2
  exit 1
fi

DB="$1"
FILE="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f "$FILE" ]; then
  echo "Backup file not found: $FILE" >&2
  exit 1
fi

echo "Restoring database '$DB' <- '$FILE'"
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --clean --if-exists' sh "$DB" < "$FILE"
echo "Restore complete: $DB"
