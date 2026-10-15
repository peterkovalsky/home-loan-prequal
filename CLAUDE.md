# Home Loan Pre-Qualification

Take-home exercise: an Angular front end, a .NET 8 API with SQL Server (Dapper), deployed to AWS Lambda.

## Layout

- `frontend/`: Angular 19 app. See `frontend/CLAUDE.md`.
- `backend/`: .NET 8 solution (Phase 2). See `backend/CLAUDE.md` once it exists.
- `infra/`: AWS CDK in C# (Phase 3).
- `docs/plans/`: one plan per phase. `00-overview.md` is the source of truth for scope and decisions.
- `docs/ai-log.md`: real cases where AI output was wrong or needed steering, and how it was caught.

## How we work

1. **Plan before code.** Each phase has a plan in `docs/plans/`. Changes to scope or design update the plan first.
2. **Refactors are separate commits from features.** Existing tests must stay green through a refactor.
3. **Tests ship with the code.** Unit tests for rules and components; integration tests against real SQL Server; Playwright for user journeys.
4. **Validate on both sides.** Client rules are for UX; the server re-validates everything. Keep rule constants (mobile pattern, minimum age, applicant cap) in step between `frontend` and `backend`.
5. **Production patterns, pragmatically.** Follow the included and left-out lists in `00-overview.md`. Don't add libraries or layers outside them without updating the plan.
6. **Log real AI corrections** in `docs/ai-log.md` when they happen. Never invent entries.

## Commands

| Area | Command |
|---|---|
| Front end install | `cd frontend && nvm use && npm ci` |
| Front end dev server (mock API) | `cd frontend && npm start` (http://localhost:4200) |
| Front end dev server (local API) | `cd frontend && npm run start:api` (proxies `/api` to :5080) |
| Front end checks | `cd frontend && npm run format:check && npm run lint && npm run test:ci` |
| Front end E2E (mock) | `cd frontend && npm run e2e` |
| Full local stack | `cp .env.example .env && docker compose up -d --build` (API on :5080) |
| Front end E2E (real API) | `cd frontend && E2E_CONFIGURATION=local-api npm run e2e` (stack must be up) |
| Back end build and tests | `cd backend && dotnet build && dotnet test` (integration tests need Docker) |
| Infra tests | `cd infra && dotnet test` |
| Infra synth / diff / deploy (local) | `infra/cdk.sh synth` etc. Always use this wrapper: it pins `AWS_PROFILE=huskystudio` and refuses any other account. |
| Lambda images, locally | `backend/scripts/lambda-local-check.sh` (Runtime Interface Emulator against the compose SQL Server) |

**AWS safety:** never run `aws` or `cdk` without `--profile huskystudio` (or `infra/cdk.sh`). The default profile on this machine is a different account.

## Definition of done

- Lint and tests pass locally and in CI.
- New behaviour has tests, including edge cases.
- The plan and the README are updated if behaviour, commands or decisions changed.
- Commit messages explain *why*, not just *what*.
