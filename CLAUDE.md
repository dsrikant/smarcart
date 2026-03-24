# SmartCart — Claude Code Project Rules

## Git workflow (MANDATORY — never deviate)

- NEVER push directly to main or develop
- Always branch from main using the naming convention: feature/<scope>-<short-description>
  Examples: feature/db-schema, feature/store-management-ui, feature/credential-vault
- One feature branch per Phase 1 task (see task list below)
- Commit format: feat(scope): description | fix(scope): description | chore(scope): description
- After completing work on a branch: git push origin <branch> then open a PR to main
- PRs require human review before merge — agents never merge their own PRs

## Phase 1 task branches (spawn one subagent per branch)

- feature/p1-scaffold → Expo project init, TypeScript, NativeWind, expo-router
- feature/p1-db-schema → WatermelonDB schema, migrations, model files
- feature/p1-credential-vault → expo-secure-store wrapper, biometrics gate
- feature/p1-stores-ui → Stores tab screen + add/edit bottom sheet
- feature/p1-items-ui → Items tab screen + add/edit bottom sheet
- feature/p1-rules-ui → Rules tab screen + rule builder sheet
- feature/p1-lists-ui → Lists tab + manual add flow
- feature/p1-history-ui → History tab screen
- feature/p1-settings-ui → Settings screen
- feature/p1-rules-engine → evaluateRules() dry-run logic

## Allowed bash commands (whitelist — do not run anything not on this list)

npx expo, npx expo prebuild, npm install, npm run, git checkout, git add,
git commit, git push, git status, git diff, git log, git worktree,
node, tsc, jest, yarn

## Disallowed commands (never run these)

rm -rf, curl, wget, docker, chmod 777, anything touching .env files directly

## Before committing

1. Run: npx tsc --noEmit (zero TypeScript errors)
2. Run: npm test (all tests pass)
3. Run: npm run lint (zero lint errors)

## Documentation

- Update ASSUMPTIONS.md when making a non-obvious technical decision
- Update QUESTIONS.md when anything is ambiguous — ask before guessing
