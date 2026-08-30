# Multi-Tenant Appointment Scheduling Platform

SaaS platform for staff-driven appointment scheduling across business verticals (spa, salon, garage, etc.).

## Tech Stack

- **Backend:** Express.js + PostgreSQL + Knex migrations
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Auth:** JWT with 30-minute expiry
- **Deploy:** Docker, Railway, or Render ready

## Quick Start

### Option A: Docker (recommended)
```bash
docker-compose up -d          # Starts PostgreSQL + backend
cd backend && npm run migrate && npm run seed
cd ../frontend && npm install && npm run dev
```

### Option B: Manual
```bash
# 1. Database
createdb scheduling_platform

# 2. Backend
cd backend
cp .env.example .env          # Edit with your PostgreSQL creds
npm install
npm run migrate
npm run seed                  # Loads demo data

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Owner | sarah@glowbeauty.com | password123 |
| Admin | mike@glowbeauty.com | password123 |
| Stylist | emma@glowbeauty.com | password123 |
| Stylist | lisa@glowbeauty.com | password123 |
| Staff | amy@glowbeauty.com | password123 |

## Features

### Phase 0-1: Foundation
- Multi-tenant architecture with `business_id` scoping on every table
- PostgreSQL schema with exclusion constraint for segment conflict detection
- JWT auth with 30-minute session expiry
- Role-based access (Owner, Admin, Staff) + provider flag

### Phase 2: Booking Engine
- Multi-segment visits (multiple providers/services per visit)
- Conflict detection at segment level (provider + time range overlap)
- Qualification checks (open-to-any vs. skill-required services)
- Booking source tracking (walk-in, WhatsApp, Instagram, phone, form, other)
- Status lifecycle: booked → arrived → completed / no-show / cancelled
- 24-hour completed-lock rule

### Phase 3: Staff UI
- Login page with JWT auth
- Client search/create with no-show/cancellation badges
- Multi-segment visit booking form
- Services management with categories and qualifications
- Staff management (create, deactivate, password reset)

### Phase 4: Calendar
- **Day view** — single-day timeline with all visits
- **Week view** — 7-day grid with visit blocks
- **Multi-provider view** — columns per provider, all visits visible
- **Drag-and-drop** — instant save with undo support
- Linked blocks for multi-service visits (purple ring)
- Current time indicator

### Phase 5: Recurring Engine
- Four recurrence patterns: weekly, every N weeks, monthly by date, monthly by weekday
- Series + version model (editing "this and all future" creates new version)
- Per-occurrence exceptions (provider/service changes)
- All-or-nothing bounded creation (validates all occurrences upfront)

### Phase 6: Needs Attention
- Two severity levels: urgent (needs action soon) + informational (FYI)
- Auto-calculated severity (within 48h = urgent)
- Manual severity override by admin
- Resolve/dismiss with notes
- Issue types: conflict, qualification mismatch, availability change, series at risk, client flag

### Phase 7: Business Administration
- Owner-only business settings
- Staff provisioning (create users with roles + provider flag)
- Business suspension (read-only mode enforcement)

### Phase 8: Reporting & Polish
- Dashboard with today's stats, this week's numbers, attention counts
- Provider performance metrics (completed, no-shows, hours)
- Booking source breakdown with percentage bars
- Full audit log with old/new value diffs
- Date range filtering for period analysis

### Phase 9: Reliability & Deployment
- Docker Compose for local development
- Dockerfile for backend
- Railway + Render deployment configs
- Concurrency test script (`node src/test-concurrency.js`)

## API Endpoints

### Auth
- `POST /api/auth/register` — Create business + owner
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Core
- `GET/POST/PATCH /api/businesses` — Business management
- `GET/POST/PATCH/DELETE /api/users` — Staff CRUD
- `GET/POST/PATCH/DELETE /api/services` — Services + categories
- `GET/POST/PATCH/DELETE /api/clients` — Client management
- `GET/POST/PATCH /api/visits` — Visit + segment booking
- `GET/PUT/POST/DELETE /api/availability` — Provider schedules + closures

### Recurring
- `GET/POST/PATCH /api/series` — Recurring series management
- `PATCH /api/series/:id/edit-future` — Edit this and all future
- `POST /api/series/:id/exception` — Per-occurrence exception

### Operations
- `GET/POST/PATCH /api/attention` — Needs attention queue
- `GET /api/attention/counts` — Dashboard badges
- `GET /api/reports/dashboard` — Dashboard stats
- `GET /api/reports/providers` — Provider metrics
- `GET /api/reports/booking-sources` — Source breakdown
- `GET /api/audit` — Audit log

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend   │────▶│  PostgreSQL   │
│  (Next.js)   │     │  (Express)  │     │   (Knex)      │
│  :5173       │     │  :3001      │     │  :5432        │
└─────────────┘     └─────────────┘     └──────────────┘
     SPA + SSR        REST API            Multi-tenant DB
```

## Database Schema

14 tables with UUID PKs, `business_id` scoping, and PostgreSQL exclusion constraints:

- `businesses` — Tenant root
- `users` — Staff with role + is_provider flag
- `service_categories` — Service grouping
- `services` — With duration + qualification toggle
- `provider_services` — Provider↔service qualification links
- `clients` — With no-show/cancellation counters
- `visits` — Multi-segment visit parent
- `visit_segments` — Atomic schedulable unit (with exclusion constraint)
- `provider_availability` — Weekly schedules
- `provider_exceptions` — Day-off overrides
- `business_closures` — Holiday closures
- `visit_series` — Recurring template
- `visit_series_versions` — Version history
- `visit_series_occurrences` — Individual occurrences
- `attention_items` — Needs attention queue
- `audit_log` — Change history
