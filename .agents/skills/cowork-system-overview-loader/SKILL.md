---
name: cowork-system-overview-loader
description: Use this skill before modifying the Calm&Co / Cowork web platform. It loads project architecture rules, milestones, production facts, and next-spec boundaries before implementation.
---

Before making any code or SQL changes in this repository, follow these rules:

1. Read the latest project overview documents if present:
   - docs/cowork_system_overview.detailed*
   - docs/cowork_system_overview_milestones*
   - docs/CALMCO_FORMAL_COMMERCIAL_READINESS_GAPS*
   - docs/ROOMS_mobile_rtc_presence_operations*
   - docs/ANGANDAO_presence_policy*
   - docs/AI_COMPANION_ARCHITECTURE*
   - docs/sms_relay*

2. Separate confirmed production facts from next-spec goals.

3. Do not treat UI existence as backend completion.

4. For every task, identify:
   - Actual execution path
   - Direct imports
   - API routes
   - Supabase tables / migrations
   - RLS and service_role boundaries
   - Validation commands

5. Do not modify unrelated modules.

6. If the task touches Supabase, do not use SQL Editor as the source of truth. Create or update migration files under supabase/migrations.

7. Output before coding:
   - Single goal for this round
   - Non-goals
   - 3 competing root-cause or implementation-risk hypotheses
   - Files likely to change
   - Verification plan