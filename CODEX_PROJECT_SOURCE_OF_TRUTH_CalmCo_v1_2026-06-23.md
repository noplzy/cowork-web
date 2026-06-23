# Codex Project Source of Truth — Calm&Co / 安感島 Web Platform

Version: 2026-06-23 v1
Audience: Codex Windows App / Codex CLI / GitHub PR agents
Repository: `noplzy/cowork-web`
Local path: `D:\dev\cowork-web`

---

## 0. Purpose

This document is the operating source of truth for Codex when modifying the Calm&Co / 安感島 web platform.

Codex must use this file together with the repo-scoped skills:

- `.agents/skills/cowork-system-overview-loader/SKILL.md`
- `.agents/skills/supabase-migration-safe-runner/SKILL.md`
- `.agents/skills/github-pr-delivery/SKILL.md`

This document does **not** replace the detailed product and architecture docs. It compresses the mature commercial platform direction into one implementation control file so Codex does not accidentally optimize for a toy MVP, a cold SaaS dashboard, or a half-finished feature surface.

---

## 1. Non-negotiable operating rules

### 1.1 One round, one core goal

For each task, Codex must identify:

1. Single goal for this round.
2. Explicit non-goals.
3. Actual execution path.
4. Direct imports and dependencies.
5. Relevant API routes.
6. Relevant Supabase tables / functions / RLS / migrations.
7. Client/server boundary.
8. Validation commands and observable signals.

Do not mix unrelated targets in one PR. Do not combine admin RBAC, Daily cleanup, Buddies payout, Pricing v2, AI, UI polish, and deployment changes in one round.

### 1.2 No silent assumptions

Before coding, Codex must state at least 3 competing implementation or root-cause hypotheses.

Examples:

- Current admin permission may rely only on env-based `ADMIN_EMAILS`.
- DB-backed admin role table may not exist or may not be wired into server routes.
- Mutation routes may exist without audit logging.
- Schema may exist in migration but may not be applied in Supabase production.
- UI may exist while backend / RLS / ledger / audit path is incomplete.

### 1.3 Production fact vs next-spec

Codex must separate:

- **Production fact**: confirmed in current repo or production path.
- **Next-spec**: approved direction but not necessarily implemented or live.
- **Not ready for commercial claim**: visible UI or draft schema exists, but operational loop is incomplete.

Never treat documentation goals as implemented code.

### 1.4 Complete-file discipline

When delivering code to the user, prefer complete overwrite-ready file contents or a PR with exact changed files.

Do not give vague patch instructions unless explicitly requested.

### 1.5 Do not directly push to main

Always work on a branch:

```bash
git checkout main
git pull origin main
git checkout -b codex/<single-goal-name>
```

Then commit and open a PR.

---

## 2. Product identity and commercial target

安感島 / Calm&Co is **not** just a coworking tool and not an infinite AI companion app.

Formal product definition:

> A mature, low-pressure digital companionship platform using Rooms as the core real-time presence container, supporting focused work, daily companionship, gentle social interaction, future professional services, and eventually AI Shared Host capabilities.

The platform must preserve:

- Warm, mature, low-pressure brand feeling.
- Deep-blue night scene / warm light / quiet trust mood.
- Not a cold SaaS dashboard.
- Not a surveillance platform.
- Not adult / gambling / gray-market / exploitative companionship.
- Not a cheap livestream tipping marketplace.

Commercial maturity requires:

```text
Brand: Calm&Co / 安感島
→ Rooms real-time companionship
→ Presence / no-camera-required / anti-idle
→ Auth / phone identity / risk gate
→ Billing / entitlement / usage ledger
→ Support / moderation / block / report / appeal / audit
→ Buddies marketplace only after governance and payment loops
→ AI Shared Host only after Host Credit, usage ledger, cost cap, admin kill switch
```

---

## 3. Current confirmed repo facts to respect

Codex must verify these again from the latest repo before implementation, but the current known facts are:

### 3.1 Tech stack

- Next.js App Router.
- React.
- Supabase Postgres + Auth + RLS.
- Daily for RTC / private rooms / meeting token.
- ECPAY for payment.
- Vercel for deployment / cron.
- Cloudflare for DNS.
- GCP SMS Relay for phone OTP provider egress.

### 3.2 Rooms / Presence / Daily

Known production-path concepts:

- `RoomLifecycleBridge` sends background room lifecycle signals.
- Presence event API writes to `room_presence_events`.
- `/api/rooms/leave` calls `cowork_leave_room`.
- `/api/internal/rooms/cleanup` calls `cowork_cleanup_expired_rooms` and can clean Daily rooms.
- Current cron is daily-level, not every 5 minutes.

Important: Daily room cleanup and lifecycle must be treated as cost and trust infrastructure, not cosmetic UI cleanup.

### 3.3 Room durations

Current direction:

- General rooms: 25 / 50 / 75 minutes.
- Activity / Studio / Buddies / themed room: 90 minutes.
- 100 minutes is deprecated and should not be reintroduced into general UX.

### 3.4 Room categories

Current safe production category set is likely:

- `focus`
- `life`
- `share`
- `hobby`

`support` and `pro` are next-spec unless the latest code proves otherwise. Do not add them by UI only. If added, update TypeScript unions, DB constraints / enum, room creation gate, filters, moderation rules, and any prompt/policy layer together.

### 3.5 Pricing / Billing

Current production payment must remain conservative:

- The active paid product may still be the pilot VIP monthly one-time plan.
- NT$299 / 599 / 1299 are formal Pricing v2 direction unless latest repo and ECPAY config prove they are fully wired and purchasable.
- Do not make UI claim a purchasable plan if ECPAY checkout, entitlement, invoice event, refund event, and ledger are not aligned.

### 3.6 SMS / Phone identity

Current architecture:

```text
/account/identity
→ supabase.auth.updateUser({ phone })
→ Supabase Auth Send SMS Hook
→ https://sms-hook.getcalmandco.com/api/supabase/send-sms
→ nginx
→ sms-relay FastAPI on GCP
→ EVERY8D
→ user receives OTP
→ supabase.auth.verifyOtp({ type: "phone_change" })
→ auth.users.phone / auth.users.phone_confirmed_at
```

Source of truth for phone binding:

- `auth.users.phone`
- `auth.users.phone_confirmed_at`
- `auth.users.phone_change`
- `auth.users.phone_change_sent_at`

Do not use `user_metadata.phone_verified` as the formal source of truth.

### 3.7 AI

AI architecture is strategically preserved but should remain commercially frozen until the operational base is ready.

Do not formally sell AI Shared Host until all are true:

- Host Credit schema and ledger are complete.
- AI usage events are logged.
- Provider cost cap exists.
- Admin kill switch exists.
- Privacy and consent are clear.
- Rooms lifecycle and Presence are stable.

Personal AI is not the main product. Shared Host is the strategic differentiator, but only after cost and governance controls exist.

### 3.8 Buddies

Buddies may have service / slot / booking skeletons, but it is not a mature transaction marketplace until these are complete:

- Provider review.
- Identity gate.
- Payment.
- Escrow / settlement / payout.
- Refund.
- Dispute.
- Support ticket linking.
- Admin audit.
- Room creation after booking.

Do not implement payout / escrow before admin, support, moderation, and dispute loops are stable.

---

## 4. Mature commercial platform gaps

The platform must move from “usable” to “operable.”

Key modules to close:

| Module | Required commercial closure |
|---|---|
| Rooms | lifecycle audit, Daily reconciliation, cleanup dashboard |
| Presence | selector, BRB, extension confirmation, reliability events |
| Identity | admin review, stale phone cleanup, risk gate, audit |
| Admin | DB-backed roles, server-only permission checks, admin audit logs |
| Support | support tickets, messages, events, refund linking |
| Safety | reports, blocks, moderation cases, appeals, action logs |
| Billing | billing ledger, entitlement events, refund events, invoice events |
| Pricing | product catalog, ECPAY checkout, entitlement, invoice names aligned |
| Buddies | provider review, bookings, dispute, payout only after safety loop |
| AI | Host Credit, usage ledger, cost cap, privacy, kill switch |
| Docs / SQL | migration source of truth, not SQL Editor-first workflows |

---

## 5. Priority order from now

Do not follow old milestone order blindly. The recommended mature commercial order is:

### P0 — M6 Admin role-based permissions

This should be first.

Reason: Every mature admin console, identity review, dispute queue, refund handling, provider review, and Daily reconciliation depends on safe admin authorization and audit logs.

Definition of Done:

- Codex inventories all current admin checks.
- If no DB-backed admin role model exists, propose and implement the minimal one.
- Server-only admin helper exists.
- service_role is used only in server routes.
- Client never receives service_role.
- Every admin mutation writes `admin_audit_logs` or equivalent.
- RLS behavior is documented.
- Validation includes build, lint, migration dry-run, and API smoke tests.

Non-goals:

- Do not build all admin consoles in this round.
- Do not implement payout.
- Do not change Pricing v2.
- Do not change AI.

### P1 — M1 Identity verification admin review console

Definition of Done:

- Admin can view identity / phone verification state.
- Uses formal source of truth from `auth.users` and any public mirrored status if required.
- Can review / flag / resolve identity cases if schema supports it.
- Admin actions are audited.
- No direct client access to service_role.
- Stale phone_change handling is documented and gated.

### P2 — M2 Buddy provider application admin review console

Definition of Done:

- Provider applications can be reviewed safely.
- Approved / rejected / needs_info states are explicit.
- Identity gate and support/audit link are clear.
- No payout or public transaction claim unless governance is ready.

### P3 — M3 Buddy dispute admin queue

Definition of Done:

- Disputes link to booking, user, provider, support ticket, refund request if applicable.
- Admin action logs are written.
- Buyer/provider states are clear.
- No automatic payout release in this round unless explicitly scoped.

### P4 — M5 Daily room reconciliation console

Definition of Done:

- Admin can see active/ended/orphan room states.
- Cleanup route result is visible.
- Daily delete success/failure is auditable.
- No accidental mass deletion without confirmation.

### P5 — M7 Public profile page `/u/[handle]`

Definition of Done:

- Brand-consistent public profile.
- No overclaim of Buddies / professional status.
- Privacy visibility rules respected.

### P6 — M8 Buddies service detail page

Definition of Done:

- Service detail UX is clear.
- Booking flow does not overclaim payment / payout readiness.
- Provider state, availability, refund and support boundaries are visible.

### P7 — M4 Buddies payout / commission / escrow

This must be late.

Only proceed after:

- Provider review exists.
- Dispute queue exists.
- Refund events exist.
- Billing ledger exists and is actively used.
- Admin audit exists.
- ECPAY / financial flow is confirmed.

---

## 6. Supabase rules

### 6.1 SQL Editor is not source of truth

SQL Editor may be used for diagnostics only.

Formal schema changes must be committed to:

```text
supabase/migrations/
```

### 6.2 Required Supabase workflow

For any schema / RLS / SQL function task:

```bash
npx supabase migration new <clear_name>
# edit generated SQL migration
npx supabase db push --dry-run
```

Only after explicit user approval:

```bash
npx supabase db push
```

### 6.3 RLS and service_role

Codex must clearly document:

- Which operations run with client anon key and are subject to RLS.
- Which operations run server-side with service_role and bypass RLS.
- Why service_role is necessary.
- How the server route authenticates and authorizes admin users before using service_role.

### 6.4 Migration quality

Migrations must include, when applicable:

- Primary keys.
- Foreign keys.
- Indexes for admin list queries.
- Check constraints for status enums.
- RLS enablement.
- RLS policies when client access is intended.
- Updated timestamp triggers only if already used consistently in the repo.
- Idempotency only when appropriate. Do not hide broken migration history with excessive `IF NOT EXISTS` unless intentionally supporting drift recovery.

---

## 7. Admin and audit standard

### 7.1 Minimum admin model

Before building admin screens, Codex must inspect whether one exists.

If missing, propose a minimal DB-backed model, for example:

- `admin_roles`
- `admin_permissions` or role-level enum
- `admin_audit_logs`

Do not assume this exact schema. Inspect current repo first.

### 7.2 Admin mutation requirements

Every admin mutation must record:

- actor admin user id
- action type
- target type
- target id
- before / after summary if relevant
- metadata
- created_at

### 7.3 No fake admin security

Not acceptable:

- Client-only admin checks.
- Hiding admin pages without server authorization.
- Relying only on button visibility.
- Exposing service_role to the browser.
- Performing admin mutation without audit.

Acceptable short-term MVP:

- Server helper validates session user.
- Server helper checks DB-backed admin role or a clearly documented temporary env allowlist.
- Mutation uses service_role only after validation.
- Mutation writes audit log.

Long-term correct path:

- DB-backed roles and permissions.
- Admin console.
- Audit search.
- Least-privilege route design.

---

## 8. Presence and Daily standard

Presence is not “camera on/off.” It is a cost and trust model.

Supported presence modes:

- `quiet`
- `audio`
- `mosaic`
- `camera`

Never implement rules that equate camera off with absence.

Base duration rules:

- Do not kick users for silence.
- Do not kick users for camera off.
- Do not kick users for mute.
- Do not use gaze / emotion / face recognition as first-version judgment.

Extension / cost-control rules:

- Require explicit confirmation at extension points.
- Support BRB 3 / 5 / 10 minutes.
- Track reliability events.
- Use connected presence, heartbeat, Daily participant state, and manual confirmation.

Daily cleanup must be observable and auditable.

---

## 9. Billing and pricing standard

Do not let UI drift from backend reality.

A paid product is commercially ready only when these align:

- Product catalog.
- Pricing page copy.
- ECPAY checkout amount / item name / trade description.
- Payment order.
- Entitlement grant.
- Billing ledger.
- Invoice event.
- Refund request/event path.
- Admin audit.
- Support flow.

Pricing v2 may be shown only as planned / coming soon unless the full backend path is ready.

---

## 10. Buddies standard

Buddies must not become an ungoverned paid companionship market.

Before public transaction scale:

- Provider verification.
- Service review.
- Booking state machine.
- Dispute flow.
- Refund flow.
- Payout flow.
- Support ticket linking.
- Admin audit.
- Content moderation.

Short-term MVP:

- Controlled listing and detail pages.
- Manual or limited booking review.
- Clear “not yet full marketplace” boundaries.

Long-term correct path:

- Escrow / payout / commission / dispute / refund fully wired and observable.

---

## 11. AI standard

AI should not be used to bypass missing operations infrastructure.

Do not build:

- AI avatar / lip-sync.
- Emotion detection.
- Gaze tracking.
- Face recognition.
- Cloud video upload.
- Full transcript storage.
- Infinite personal AI chat as the main paid product.

Allowed later:

- Global guidance AI.
- Personal room rescue / stuck support / wrap-up.
- Shared Host AI with event-driven policy.

Commercial unlock requirements:

- Host Credit.
- Usage ledger.
- Provider cost cap.
- Admin kill switch.
- Privacy and consent.
- Room lifecycle stable.
- Presence stable.

---

## 12. Required Codex response format before implementation

Before modifying files, Codex must output:

```text
Single goal:
Non-goals:
Current confirmed facts:
Execution path inventory:
Likely files to inspect:
Likely files to modify:
3 competing hypotheses / risks:
Supabase impact:
RLS / service_role boundary:
Validation plan:
Rollback plan:
```

Do not start coding until this is shown.

---

## 13. Required PR description format

Every PR must include:

```md
## Single goal

## Non-goals

## Changed files

## Why each file changed

## Supabase / RLS / service_role notes

## Validation
- npm run lint
- npm run build
- npx supabase db push --dry-run, if SQL changed
- API smoke tests, if routes changed
- UI smoke path, if UI changed

## Observable signals

## Risks and limitations

## Rollback
```

---

## 14. First recommended Codex task prompt

Use this as the first implementation task.

```text
Use $cowork-system-overview-loader, $supabase-migration-safe-runner, and $github-pr-delivery.

Read CODEX_PROJECT_SOURCE_OF_TRUTH_CalmCo_v1_2026-06-23.md first.

This round only handles: M6 Admin role-based permissions.

Non-goals:
- Do not build all admin consoles.
- Do not modify Pricing v2.
- Do not implement Buddies payout / escrow.
- Do not modify AI.
- Do not perform production Supabase db push.

Before coding, output:
1. Single goal.
2. Non-goals.
3. Current admin authorization execution path.
4. Existing admin-related tables / helpers / API routes.
5. Whether admin roles are DB-backed, env-backed, or absent.
6. Three competing risks / root-cause hypotheses.
7. Files likely to inspect and modify.
8. Supabase migration plan if needed.
9. RLS / service_role boundary.
10. Validation plan.

Implementation target:
- Establish or complete a minimal server-side admin role permission foundation.
- Ensure service_role is only used after server-side admin authorization.
- Ensure every admin mutation path can write admin_audit_logs or has a clear audit helper ready.
- Keep the PR small and focused.

Required validation:
- npm run lint
- npm run build
- npx supabase db push --dry-run if SQL changed
- git diff --stat
- changed file list
- API smoke test examples

Do not push to main. Create a branch and PR only after validation.
```

---

## 15. Final reminder for Codex

The goal is not to make the site look more complete.

The goal is to make the platform commercially operable:

- safer admin operations
- auditable support and moderation
- reliable room lifecycle
- billing and entitlement consistency
- controlled Buddies transaction path
- AI only after cost and governance controls

When uncertain, prefer the smaller, auditable, reversible change.
