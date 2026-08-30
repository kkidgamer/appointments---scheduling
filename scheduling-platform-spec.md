# Multi-Tenant Appointment Scheduling Platform — Requirements Spec

**Status:** Requirements locked via Q&A. Next step: database schema + migration.
**Product shape:** SaaS platform, staff-driven appointment scheduling, generic across business verticals (spa, salon, garage, etc.), you (platform owner) manually provision each business account. Billing/subscriptions handled entirely outside this system.

---

## A. Business Model

- **Multi-tenant SaaS from day one.** Not a single-business tool — this was the single biggest architectural pivot in this session.
- You are the platform owner. Businesses pay you a subscription **outside the system** (Stripe, manual invoicing, etc.) — no payment code, no price fields, nothing billing-related lives in this app.
- **You manually provision every business** via an admin panel. No self-signup flow in v1.
- A **user belongs to exactly one business** — no cross-business accounts.
- Client data is **fully isolated per business** — no cross-business client matching, even if the same real person uses two businesses on the platform.
- **One location per business in v1.** No `location_id` in the schema. Multi-location is a real future need but explicitly deferred — add it when a real business asks.
- All businesses share the **same feature set** in v1 — no per-business feature toggles.
- Estimated scale: **~10 businesses in year one**, providers ranging **5–20 per business**. Small enough that indexing/partitioning strategy is a non-issue for a long while.

### Business suspension
- You manually flag a business inactive (no automated billing integration in v1).
- Suspended business → **read-only mode**: all existing data (appointments, clients, history) stays visible, but no new writes (no creating/editing appointments) until reactivated.

---

## B. Users & Roles

- Roles are **Owner, Admin, Staff** — but note **"provider" is not a separate role**, it's a boolean flag (`is_provider`) that can sit on any user regardless of role. A business owner who also does the work is simply an owner + provider.
- **Owner** = the person tied to the business account (mainly a billing/ownership concept).
- **A business can have multiple admins** — admin does not have to be the owner.
- **Only admins can create or edit appointments.** Staff and providers do not self-book.
- **Providers can log in**, but see **only their own schedule** — no visibility into other providers' appointments or clients they haven't served (see client visibility note below, which supersedes this for client history specifically).
- Staff (non-provider) see the day's relevant operational info (today's appointments), not full admin dashboards.
- Reports/dashboard summary numbers and Needs Attention queues: **admin only**.

---

## C. Services

- A service can require **specific provider qualifications**, or be **open to any provider** — this is configurable per service, not universal.
- **Duration lives on the service as a default only.** No per-provider duration overrides — staff can freely override duration at booking time regardless of who's assigned (deliberately kept simple).
- Services can be grouped into **categories** (e.g. Hair, Facial, Massage).
- **No price field anywhere in v1** — pricing/payments are fully out of scope and out of the schema.

### Multi-segment visits (major structural decision)
This is the biggest change from the original single-service-per-appointment model:

- A booking ("**visit**") can contain **multiple segments**, each segment being one **provider + one service**.
- Segments within a visit can use **different providers**, running in parallel or in sequence.
- A visit is always **one continuous time window** — if a client wants services at genuinely different times of day, that's two separate visits, not one.
- **Staff sets the overall visit start/end directly** (not auto-computed by summing segments).
- **Staff also sets duration per segment individually.**
- Calendar rendering: each segment shows as its own block in its provider's row/column, with a **shared visual marker** (color/icon) linking blocks that belong to the same visit. Clicking any linked block opens the full visit.

**Architectural consequence:** the atomic schedulable unit is the **segment** (provider + service + time), not the appointment. A "visit" is the parent grouping multiple segments for one client in one continuous window.

---

## D. Provider Scheduling

- Providers work **full-time, single continuous block per day** — no split shifts/lunch-break gaps needed in v1.
- **Default:** providers inherit the business's standard hours. Admin can override an individual provider's schedule when it genuinely differs.
- **Two kinds of exceptions:**
  - **Per-provider exception** — one person's day off, entered individually.
  - **Business-wide closure** — a holiday/closure the admin sets once, automatically applied to all providers, no need to repeat per person.

---

## E. Appointment Rules

- **No time-snapping** — appointments can start at any exact minute (e.g. 9:17), not restricted to a 5/15/30-min grid.
- **A client cannot have two overlapping appointments** — always blocked, no override case identified.
- **Backfilling into the past is allowed** — staff can log a walk-in from earlier the same day (or before) after the fact.
- **Completed appointments lock** after 24 hours. Within that 24-hour window, admin can still correct genuine data-entry mistakes; after that, the record is permanently locked.
- **Cancellation reason** — captured as a field on cancelled appointments.
- **Booking source/channel is required on every appointment**: `walk_in`, `whatsapp`, `instagram`, `phone`, `contact_form`, `other`. This is non-negotiable — it's the core problem the whole project started from.

---

## F. Clients

- **Client records are shared business-wide** — any provider serving a client (not just ones who served them before) can see their history, since that helps quality of service.
- Client data is **isolated per business** (see Section A) — no sharing across businesses even for the same real person.
- Required: **name + phone**. **Email optional.**
- **Simple no-show/cancellation flag/badge** shown to staff when booking a client with a history of missed appointments — informational only, does not block booking.

---

## G. Recurring Appointments

- **Required from day one** (reconfirmed).
- **Full pattern support required**, not a simplified subset:
  - Weekly
  - Every N weeks
  - Monthly by date
  - Monthly by weekday (e.g. "third Thursday")
- Recurring series apply to the **whole multi-segment visit as a template** — default services/segments/providers repeat, but:
  - **Providers can change per occurrence.**
  - **Services can change per occurrence** if the client's needs differ that time.
  - Each occurrence is a **real, independently editable appointment**; deviations from the series template are tracked as **exceptions**, without breaking the rest of the series.
- **Series never auto-cancels.** If a client has consecutive missed/no-show occurrences, the series gets **flagged in the attention queue** as "at risk" — a human (admin) always makes the actual call to end it, never automatic.
- (Carried over from earlier architecture rounds, still valid: series + version model, occurrence identity via `series_version_id` + `occurrence_number`, all-or-nothing validation on bounded series creation, rolling-horizon background generation for ongoing series with issue-flagging on conflict.)

---

## H. Series Editing

- **Two edit scopes only**: "this occurrence only" and "this and all future occurrences." **Editing the past is not supported** — past occurrences are locked history (consistent with Section E's completed-appointment lock).
- When a provider's availability change breaks future series occurrences, the system **always flags for admin review** — never auto-resolves or auto-reassigns.
- When admin resolves a flagged conflict by moving an occurrence to a new date/time, it **stays linked to the series** (not converted into a standalone appointment) — this is the `resulting_appointment_id` mechanism from the earlier architecture design.

---

## I. Conflict Handling

- New appointments/series that would double-book a provider are **blocked by default**, but **admin can always override** — admin has final authority on every scheduling decision in this system.
- **Two separate Needs Attention queues, split by urgency** (not by cause):
  - **Urgent** — needs action soon
  - **Informational** — lower priority, FYI
- **Severity is calculated automatically** (e.g., an unresolved conflict for an occurrence happening within 2 days becomes urgent), but **admin can manually override** the calculated severity.
- Dismissing a generation conflict **permanently skips** that occurrence (carried over from earlier design).

---

## J. Calendar

- **Day, Week, and Multi-Provider views all required in v1.**
- Multi-segment visits with parallel providers render as **linked blocks** (see Section C).
- **Drag-and-drop is supported**, saves **instantly with an undo option** (no confirmation modal on every drag — keeps booking fast).
- Editing via a full edit screen is also supported for more than a simple time/slot change.
- Multi-provider view: **shows all providers by default**, with **filters available** (e.g. by working-today status, by skill) to narrow the view.

---

## K. Reporting

- Admin dashboard shows **everything**: today's appointments, Needs Attention queues, and summary numbers (this week's appointments, completed count, no-show count, etc.).
- Staff see a **scoped operational view** — today's appointments / relevant info only, not full admin summaries.
- **No exports in v1** (no CSV/Excel/PDF) — everything stays inside the system for now.

---

## L. Security

- **Sessions expire after 30 minutes of inactivity.**
- **Sensitive/destructive actions** (deleting a staff account, deleting a client record) require **extra re-confirmation**, beyond a normal dialog.
- **No two-factor authentication in v1** — revisit once real paying businesses are on the platform.

---

## M. Explicitly Out of Scope for v1

- Payments/pricing/subscriptions inside the app (handled entirely externally)
- Multi-location support (schema stays location-free until needed)
- Self-signup for new businesses (you provision manually)
- Per-business feature toggles
- Exports (CSV/PDF/etc.)
- Two-factor authentication
- Public self-booking page
- Rooms/equipment/resources

## N. Confirmed Roadmap (post-v1)

- **SMS reminders** — the clear first priority for v2, directly targets the no-show problem.
- Other future possibilities mentioned but not committed: WhatsApp integration, public booking, email reminders, multi-location.

---

## Open Items / Things to Revisit

- Exact provider/appointment volume per business is still a rough estimate (~10 businesses, 5–20 providers each) — fine for now, revisit if scale assumptions change.
- The severity auto-calculation rule ("within 2 days = urgent") is a reasonable default but the exact threshold hasn't been stress-tested against real usage — treat as adjustable.
- Multi-segment visits are a genuinely more complex data model than the original single-service appointment — this should be the first thing modeled and prototyped, since it touches conflict detection, calendar rendering, and recurring series generation all at once.
- How the four recurrence patterns (especially monthly-by-weekday, e.g. "third Thursday") interact with multi-segment/multi-provider visits hasn't been worked through — a monthly pattern makes the date sequence less predictable, which matters when two providers on the same visit both need re-validating against it. Resolve before building the recurring generator.

---

## Build Roadmap

**Sequencing principle:** build around the riskiest, least-proven part of the spec first — the **multi-segment visit model** — not around whichever piece feels most familiar. Multi-tenancy is mechanically simple (a `business_id` column and consistent query scoping) and low-risk because it's a well-understood pattern. Multi-segment visits are not — they touch conflict detection, calendar rendering, and recurring generation all at once, and nothing about that model has been prototyped yet. If it turns out to need reshaping, you want to find that out in week 2, not week 8 after the calendar and recurrence engine are both built on top of an untested assumption.

### Phase 0 — Prove the segment model (1–1.5 weeks)
Before any UI, no calendar library, no auth: a throwaway script or minimal API that can create a visit with 2+ segments (different providers, different durations, staff-set overall window) and correctly detect a conflict when a segment overlaps an existing booking for that provider. This is the one part of the spec genuinely unproven — everything else here is a known pattern. Don't proceed past this phase until overlap detection against segments (not appointments) works and you're confident in the data shape.

### Phase 1 — Foundation
- Repo, environments, conventions
- PostgreSQL schema for: `businesses`, `users` (with `role` + `is_provider` flag), `services` (+ categories, qualifications), `clients`, `providers` (availability + exceptions)
- `business_id` scoping baked into every table and every query from the start — retrofitting tenant isolation later is far more expensive than building it in from day one
- Auth: email + password, 30-min session expiry, business-scoped login

### Phase 2 — Core booking engine (single visit, no recurrence yet)
- `visits` + `visit_segments` tables, built on the Phase 0 proof
- Conflict detection at the segment level (provider + time range), including the PostgreSQL exclusion constraint
- Qualification checks (open-to-any vs. skill-required services)
- Booking source/channel field — required on every visit, not optional
- Status lifecycle: booked → arrived → completed / no-show / cancelled, with the 24-hour completed-lock rule

### Phase 3 — Staff UI: fast intake
- The make-or-break screen: client search/create, multi-segment visit builder, provider/service pickers
- This is where the actual bottleneck (five intake channels, one manual entry point) gets solved — prioritize speed over polish here

### Phase 4 — Calendar
- Day, Week, Multi-provider views using a mature calendar library, not custom-built
- Linked-block rendering for multi-segment visits (shared visual marker across provider rows)
- Drag-and-drop with instant save + undo, provider/skill filters

### Phase 5 — Recurring engine
- Resolve the open item above (recurrence patterns × multi-segment visits) with a written design note before writing code here — this is the highest-complexity remaining piece
- Series + version model, occurrence identity, all-or-nothing bounded creation, rolling-horizon background job for ongoing series
- Per-occurrence exceptions (provider/service changes), series editing (this-only vs. this-and-future)

### Phase 6 — Needs Attention
- Two queues split by urgency (not cause), auto-calculated severity with manual override
- Conflict/qualification/availability-change flagging, admin-only resolution with transactional resolve-or-stay-open logic

### Phase 7 — Business administration
- Admin panel for you to provision businesses, flag active/suspended, manage per-business admins/staff
- Read-only mode enforcement for suspended businesses

### Phase 8 — Reporting & polish
- Admin dashboard (today + summary numbers + queues), staff scoped view
- No-show/cancellation client badge
- Audit log

### Phase 9 — Reliability & deployment
- Concurrency testing on the segment-conflict and recurring-generation paths specifically — these are where races actually matter
- Deploy to a small VPS or managed platform (Railway/Render/Fly.io) — current scale (~10 businesses, single-digit-to-20 providers each) doesn't justify anything more elaborate
- Backups, basic monitoring on the daily recurrence-generation job (a silently broken cron job is the failure mode you specifically designed the "needs attention" system to avoid — don't let the job itself fail silently)

### What NOT to build yet
SMS reminders (confirmed v2 priority, but don't let it creep into v1 scope), any payment integration, self-signup, multi-location, exports, 2FA, public booking.

[Certain] One sequencing risk worth naming directly: it will be tempting to start with the calendar because it's the visible, demoable part of the product. Resist that — a polished calendar built on an unproven segment-conflict model means rebuilding the calendar's data assumptions later. Phase 0 exists specifically to prevent that rework.
