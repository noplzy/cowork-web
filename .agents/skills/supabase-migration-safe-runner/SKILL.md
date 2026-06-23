---
name: supabase-migration-safe-runner
description: Use this skill for any Supabase schema, RLS, SQL function, admin audit, billing ledger, support, moderation, presence, or migration task in the Calm&Co project.
---

When a task touches Supabase:

1. Never treat Supabase SQL Editor as the formal schema source of truth.

2. Create or update SQL files under:
   - supabase/migrations/

3. Before writing SQL, identify:
   - Existing table names
   - Existing functions
   - Existing RLS policies
   - Foreign key targets
   - Whether the route will use anon/client key or service_role

4. Clearly separate:
   - Client key behavior: RLS applies
   - Service role behavior: RLS is bypassed and must be protected by server-only code

5. For admin or support actions:
   - Every mutation must write admin_audit_logs or an equivalent audit event.
   - Do not expose service_role to client components.

6. Required validation:
   - npx supabase db push --dry-run
   - npm run lint
   - npm run build
   - SQL readback query examples

7. Never run production db push without explicitly asking the user for approval.