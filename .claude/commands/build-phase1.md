# SmartCart Phase 1 — Agent Launcher

## Variables

STARTING_AGENT: $ARGUMENTS

## Context to read first

READ: CLAUDE.md
READ: QUESTIONS.md
RUN: git status
RUN: git log --oneline -5

## Instructions

You are the Phase 1 orchestrator for SmartCart. Your job is to spawn
subagents in dependency order and track their completion. You do not write
code yourself — you delegate everything to the specialist agents below.

Before spawning any agent:

1. Confirm main is clean (`git status` shows no uncommitted changes)
2. Confirm the dependency agents for that agent have already pushed their
   branches (check with `git branch -r | grep feature/p1-`)
3. If a dependency is missing, report it and wait — do not spawn out of order

### Dependency order

```
TIER 1 — no dependencies (spawn immediately, in parallel)
  p1-scaffold              → feature/p1-scaffold

TIER 2 — requires p1-scaffold merged to main
  p1-db-schema             → feature/p1-db-schema
  p1-credential-vault      → feature/p1-credential-vault

TIER 3 — requires p1-db-schema AND p1-credential-vault merged to main
  p1-stores-ui             → feature/p1-stores-ui
  p1-items-ui              → feature/p1-items-ui
  p1-rules-engine          → feature/p1-rules-engine

TIER 4 — requires p1-db-schema merged to main
  p1-lists-ui              → feature/p1-lists-ui
  p1-history-ui            → feature/p1-history-ui
  p1-settings-ui           → feature/p1-settings-ui
  p1-rules-ui              → feature/p1-rules-ui
```

### If STARTING_AGENT is provided

Spawn only that agent. Confirm its dependencies are met first. Example:
`/build-phase1 p1-credential-vault` → spawn only p1-credential-vault
after confirming p1-scaffold is merged.

### If STARTING_AGENT is not provided

Report the current state of all feature/p1-\* branches and tell the user
which tier is ready to spawn next. Do not auto-spawn without confirmation.

### After each agent completes

Report:

- Branch name and commit SHA
- Files created
- Test results (pass/fail counts)
- Items added to QUESTIONS.md
- Whether a PR has been opened

Remind the user: "Review and merge feature/<branch> to main before I
can spawn the next tier."
