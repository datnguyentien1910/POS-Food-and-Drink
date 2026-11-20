#!/usr/bin/env bash
#
# Dump a database from the running Postgres container to a custom-format file.
#
#   ./scripts/backup.sh <db> <file>
#
# Example:
#   ./scripts/backup.sh restodash backups/restodash.dump
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

mkdir -p "$(dirname "$FILE")"

echo "Backing up database '$DB' -> '$FILE'"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc' sh "$DB" > "$FILE"
echo "Backup complete: $FILE"
