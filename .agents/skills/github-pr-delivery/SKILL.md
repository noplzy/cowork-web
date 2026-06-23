---
name: github-pr-delivery
description: Use this skill when delivering code changes for the Calm&Co / Cowork repo. It enforces branch, PR, validation, and rollback discipline.
---

For every code delivery:

1. Do not push directly to main.

2. Start from latest main:
   - git checkout main
   - git pull origin main

3. Create a task branch:
   - codex/<single-goal-name>

4. Make only changes directly related to the user's requested task.

5. Do not reformat unrelated files.

6. Run validation:
   - npm run lint
   - npm run build
   - npx supabase db push --dry-run when SQL changed

7. Before commit, show:
   - git status
   - git diff --stat
   - changed file list
   - validation result

8. Commit with a clear message.

9. Push branch and create PR.

10. PR description must include:
   - Single goal
   - Non-goals
   - Changed files
   - Why each file changed
   - Validation commands and results
   - Risks and rollback notes