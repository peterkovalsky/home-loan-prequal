# Implementation plan: overview

Status: **agreed**. Phases 0 and 1 done; Phase 2 next.
Each phase gets its own plan file in this folder (`01-frontend.md`, `02-backend.md`, `03-aws.md`), written and reviewed before code.

## Principles

- **Production patterns, applied pragmatically.** Use the patterns that pay for themselves at this size and that a reviewer would expect in production code. Leave others out with a stated reason, not just "keep it simple".
- **Same rules on both sides.** The client validates for UX; the server validates everything again and is the source of truth.
- **Small, reviewable commits.** Refactors are separate from features, and tests ship with the code they cover.
- **AI-assisted, human-reviewed.** Plan, review, implement, test, then self-review. Real corrections are logged in [`docs/ai-log.md`](../ai-log.md).

## Decisions so far

| Topic | Decision |
|---|---|
| Repo layout | `/frontend`, `/backend`, `/infra`, `/docs`, `README.md`, `NOTES.md` |
| Node | 22 (`frontend/.nvmrc`). Angular 19 does not support Node 24. |
| "More than two" applicants | Start with 3 sections, allow add/remove between 3 and `maxApplicants` (4, from config). Enforced on the server too. |
| Back navigation | Unsaved About you input lives in a signal-based draft store, so Back never loses it. |
| Database | SQL Server 2022 in Docker (Rosetta on Apple Silicon); RDS SQL Server Express in AWS. |
| Data access | Dapper, with DbUp for versioned SQL migrations. |
| IaC | AWS CDK in C# (one language across the back end). |
| Concurrency | `rowversion` exposed as an ETag; `If-Match` on PUT; stale writes get `412`. |

## Phase 0: Repo and guardrails (~30 min)

- [x] `git init`; commit the starter untouched, then move it into `/frontend`
- [x] Pin Node 22; baseline `npm run test:ci` passes (12/12)
- [x] This plan, `CLAUDE.md` (root and frontend), `docs/ai-log.md`
- [x] CI skeleton (GitHub Actions): front-end build and tests, pushed to a private GitHub repo with a green first run. Back-end and E2E jobs are added in their phases.
- [ ] `backend/CLAUDE.md`, written at the start of Phase 2 once the solution exists

## Phase 1: Front end (~2.5 h), detail in `01-frontend.md` (done)

**1a. Refactor first, without changing behaviour** (existing tests must stay green):

- `JourneyService`: current, next and previous step, plus completed state. Removes the hard-coded `'/loan-details'`.
- Runtime config (`config.json` loaded with `provideAppInitializer`): `apiBaseUrl`, `useMockApi`, `maxApplicants`, `termsVersion`. Build once, run against the mock, local or Lambda API.
- Mock interceptor registered only when `useMockApi` is true.
- HTTP error interceptor that normalises server errors (accepts both `string` and `string[]` per field).
- Shared UI: `StepCardComponent` (card, loading state, error summary) and `StepActionsComponent` (Back/Continue footer).
- Shared helpers: `isInvalid`, reusable validators.
- Lazy routes (`loadComponent`), `OnPush` everywhere, angular-eslint.

**1b. About you step:**

- Applicant model, `ApplicantsService`, mock `GET` and `PUT /api/applications/:id/applicants` with full validation.
- `FormArray` sized from Loan details' applicant count; add/remove for "More than two".
- Fields: title, first name, last name, email (required for applicant 1 only), AU mobile, date of birth (18 or older).
- Terms modal with placeholder text; consent sent with `termsVersion`.
- Draft store for Back; functional guard when Loan details has not been saved; ticks on completed steps in the nav.

**1c. Unit tests:** component, validators (mobile formats, 18th birthday boundary with a fixed clock), mock routes, journey service.

**1d. Playwright E2E:** happy path with 2 applicants; Back keeps input; validation messages; "More than two" add/remove. Runs against the mock first, then against the real stack.

## Phase 2: Back end (~4 h), detail in `02-backend.md`

**Solution layout**

```
backend/
  src/HomeLoan.Api             Minimal API endpoint groups, filters, ProblemDetails, Lambda hosting
  src/HomeLoan.Application     Use-case handlers, FluentValidation validators, DTOs, repository interfaces
  src/HomeLoan.Domain          Entities, enums/reference data, business rules (no framework dependencies)
  src/HomeLoan.Infrastructure  Dapper repositories, unit of work, connection factory, options
  src/HomeLoan.Migrations      DbUp runner and versioned SQL scripts
  tests/HomeLoan.UnitTests
  tests/HomeLoan.IntegrationTests   Testcontainers (SQL Server) + WebApplicationFactory
```

**Included:**

- Clean layering, with dependencies pointing inward.
- One handler class per use case, called from the endpoints.
- FluentValidation run through an endpoint filter.
- `IExceptionHandler` and ProblemDetails, with validation errors returned in the `{ errors }` shape the front end already uses.
- One repository per aggregate, with a unit of work (one connection and transaction per request).
- ETag and `If-Match` concurrency.
- `TimeProvider` for date rules.
- Options pattern validated on startup.
- Structured JSON logging with a correlation id.
- Health checks, including a database check.
- OpenAPI.
- `Directory.Build.props` (nullable, warnings as errors, analyzers), Central Package Management.

**Left out, with reasons (recorded in NOTES.md):**

- **MediatR:** commercial licence since 2025; plain handlers plus endpoint filters give the same structure.
- **Generic repository:** hides the SQL that Dapper exists to make explicit, and cannot express the transactional replace-applicants save.
- **API versioning:** a single client, and the brief allows contract changes.
- **Auth:** out of scope; the plan for it goes in NOTES.

**Order of work:**

1. Schema and OpenAPI contract, reviewed first.
2. DbUp migrations and `docker-compose.yml` (SQL Server, migrator, API).
3. Domain rules and validators, with xUnit tests.
4. Repositories, unit of work and concurrency.
5. Endpoints.
6. Integration tests, including two saves racing each other.
7. Front-end proxy and `start:api` script.
8. CI runs Playwright against Compose.

**Schema outline** (finalised in `02-backend.md`):

- **`Application`**: identity key, timestamps, `rowversion`.
- **`LoanDetails`**:
  - Key: 1:1 with `Application` (`ApplicationId` is both PK and FK).
  - Money columns are `decimal(12,2)`.
  - Check constraints: address and state are mutually exclusive; deposit is no more than the property value; codes come from the allowed lists.
- **`Applicant`**:
  - Keys: FK to `Application`; unique `(ApplicationId, Ordinal)`.
  - Check constraints: `Ordinal` between 1 and 4; `Ordinal <> 1 OR Email IS NOT NULL`; title code is valid.
  - `DateOfBirth date`.
- **`ApplicationConsent`**: terms version and accepted-at timestamp, for an audit trail.
- Indexes to match the queries.

## Phase 3: AWS (~2 h), detail in `03-aws.md`

- CDK (C#):
  - VPC with private isolated subnets and no NAT.
  - RDS SQL Server Express (`db.t3.micro`).
  - Secrets Manager secret managed by RDS, plus a Secrets Manager VPC interface endpoint.
  - .NET 8 Lambda on arm64, behind an API Gateway HTTP API with CORS for `localhost:4200`.
  - Log retention set; IAM scoped to `GetSecretValue` on that one secret.
- Migrations run once after deploy, by invoking the same migrator code.
- Proof it works: smoke script (PUT then GET), and the Playwright suite run against the deployed API with the front end running locally.
- Budget alarm; `cdk destroy`; check the teardown is complete.
- Known risk: `Microsoft.Data.SqlClient` on Lambda with `InvariantGlobalization`. Test early.

## Phase 4: Write-up (~45 min)

- `README.md`: how to run, test, deploy and tear down.
- `NOTES.md`:
  - Decisions and assumptions.
  - Database design, transactions and concurrency.
  - AWS design, secrets and IAM.
  - What was left out and why.
  - Improvements, e.g. lender config growing into per-lender field metadata, auth, OpenAPI-generated client types.
  - AI tools and workflow, drawn from `ai-log.md`.

## If time runs short (cut from the bottom)

1. Parts 1 and 2 complete, with tests (must have)
2. Part 3 deployed and torn down (must have)
3. Playwright against the real stack in CI
4. Polish: step-nav ticks, repo skill for adding a step, Swagger polish

## Preparing for the follow-up session

Likely live changes: a new applicant field, a different applicant cap, a third step.
Phase 1 adds an "adding a field" checklist (model, form, mock, DTO, validator, migration, tests) and a repo skill for adding a journey step, so these changes are quick and predictable.
