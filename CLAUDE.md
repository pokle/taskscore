# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskScore is a web application for analyzing hanggliding/paragliding competition track logs (IGC files). Pilots submit flights via email, and the system provides task analysis, scoring explanations, and thermal location tracking.

## Architecture

Client-heavy serverless architecture on Cloudflare:

```
Pilots (email IGC) → Email Worker → R2 (storage) + D1 (database)
                           ↓
Frontend (Pages) ←→ API Worker ←→ R2 + D1
```

**Key Components:**
- **Cloudflare Pages** - Static frontend with client-side IGC parsing
- **Email Worker** - Receives submissions at `submit@{domain}`, validates senders, stores IGC files
- **API Worker** - RESTful API for CRUD operations
- **R2** - Content-addressed IGC storage (`/igc/{sha256}.igc`) + email archives
- **D1** - SQLite for pilots, competitions, tasks, submissions

**Design Principles:**
- No flight data lost - store every valid IGC, sort out associations later
- Email as interface - no user accounts for pilots
- Client-side processing - IGC parsing happens in browser
- Free tier focused - designed for Cloudflare free limits

## Build & Development

*Project is in early design phase - no build system configured yet.*

When implemented:
- `wrangler dev` - Local development server
- `wrangler deploy` - Deploy to production
- `wrangler d1 migrations apply` - Apply database migrations

Domain: `taskscore.shonky.info`

## Project Structure

```
/specs/           - Feature and architecture specifications
/explorations/    - Experimental code (NOT for production use)
```

## Key Data Model

- **Pilot** - Canonical identity (can have multiple emails)
- **Submission** - States: `unmatched` → `matched` → `entered`
- **IGC files** - Deduplicated by SHA-256 content hash

## Documentation Requirements

- All features documented as specifications at `specs/{feature}-spec.md`
- See `specs/system-architecture-spec.md` for detailed architecture

## Coding Preferences

- MUST read library/tool documentation before use (Context7 tool, web docs)
- Decisions MUST be explainable - return explanations for scoring decisions, audit logs, and unit testing
- Place experimental code in `/explorations/` - never use in production
