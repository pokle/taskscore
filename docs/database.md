# Database

## D1 Database

TaskScore uses Cloudflare D1 (SQLite) for auth storage.

- **Database name:** `taskscore-auth`
- **Database ID:** `aa8b644f-368e-493a-8b49-1af0d756aff4`
- **Schema file:** `web/workers/auth-api/src/db/schema.sql`

## Running Wrangler

Use `bun run wrangler2` to run wrangler commands:

```bash
bun run wrangler2 d1 execute taskscore-auth --remote --file=web/workers/auth-api/src/db/schema.sql
```

**Important:** Always pass `--remote` to execute against the production database. Without it, wrangler operates on the local dev database only.

## Schema History

- **2026-03-14** — Applied initial schema to remote D1
