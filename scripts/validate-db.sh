#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_DATABASE="${DB_DATABASE:-relay}"

export PGPASSWORD="$DB_PASSWORD"

echo "Checking Postgres at ${DB_HOST}:${DB_PORT}..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" >/dev/null 2>&1; then
  echo "Postgres is not reachable. Start it (e.g. docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres) and retry."
  exit 1
fi

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -lqt | cut -d \| -f 1 | grep -qw "$DB_DATABASE"; then
  echo "Database '${DB_DATABASE}' already exists."
else
  echo "Creating database '${DB_DATABASE}'..."
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" "$DB_DATABASE"
fi
