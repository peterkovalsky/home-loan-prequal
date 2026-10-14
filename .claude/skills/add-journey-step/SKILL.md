---
name: add-journey-step
description: Add a new step to the home-loan pre-qualification journey (front end, mock API and, once Phase 2 exists, the .NET API and database). Use when asked to add a step such as "Income", "Expenses" or "Property", or to add a field to an existing step.
---

# Add a journey step

Follow the existing steps (`features/loan-details`, `features/about-you`) as the reference. Don't invent new patterns.

## 1. Plan first

Write a short note in `docs/plans/` covering:
- the fields and their rules;
- which earlier answers the step depends on;
- the request and response shapes;
- the edge cases.

Get it reviewed before writing code.

## 2. Front end (`frontend/src/app`)

1. **Path and order:** add `STEP_PATHS.<step>` and an entry in `JOURNEY_STEPS` (`core/journey/journey-steps.ts`). Order there is the journey order. `JourneyService` handles Back and Continue.
2. **Route:** add a lazy route in `app.routes.ts`. Add `canActivate: [loanDetailsSavedGuard]` (or a new guard) if the step depends on earlier answers.
3. **Model:** add it in `core/models`. Numeric reference codes go in `reference-data.ts` and must never be renumbered, because they are shared with the API.
4. **Service:** add it in `core/api`, as a thin wrapper over `ApplicationResourceClient`. That gives ETag concurrency and error handling for free.
5. **Store:** in `core/state/application.store.ts`, add a `CachedResource`, `ensureX()`, `saveX()`, and the step's rule in `completedSteps`.
6. **Rules:** pure functions go in `shared/validation`; form validators that wrap them go in `shared/validators`.
7. **Mock:** add routes in `mock-api/mock-routes.ts`. Use `readResource`, `checkPrecondition` and `writeResource`, and validate with the same rule functions.
8. **Component:** add it in `features/<step>/`, inside `<app-step-card>` with `<app-step-actions [showBack]="true">` inside the form. Use `OnPush`, `inject()`, typed reactive forms, `isInvalid()`, and `toErrorMessages()`.
9. **Tests:**
   - a spec for each new rule, validator, mock route and the component;
   - a Playwright journey in `frontend/e2e`.

## 3. Back end (`backend/`, see `backend/CLAUDE.md`)

1. **Migration:** a new `Scripts/Migrations/NNNN_*.sql`. The resource gets its own table, or a parent row with its own `rowversion` (one version per resource, never shared). Name every constraint.
2. **Domain:** a record in `Models.cs`, plus rules and constants (mirror the front end).
3. **Application:** a feature folder with a DTO (nullable properties), a validator, a repository interface, and Get/Save handlers using `OptimisticSave`, `IUnitOfWork` and `Result<T>`. Register them in `DependencyInjection.cs`.
4. **Infrastructure:** a Dapper repository with compare-and-swap on `RowVersion`. Register it.
5. **API:** routes in `Endpoints/ApplicationEndpoints.cs` using `ToGetResult`/`ToPutResult`.
6. **Tests:**
   - validator and handler unit tests, using the fakes in `UnitTests/Application/Fakes.cs`;
   - integration tests for the contract and a schema test for each new constraint;
   - extend the E2E journey.

## 4. Check

```bash
cd frontend && npm run format:check && npm run lint && npm run test:ci && npm run e2e
```

## Adding a field to an existing step: checklist

| Layer | File(s) |
|---|---|
| Model | `core/models/<step>.model.ts` |
| Reference data (if it's a choice) | `core/models/reference-data.ts` |
| Rule and validator | `shared/validation/*`, `shared/validators/*` |
| Form control and template | `features/<step>/<step>.component.{ts,html}` |
| Draft (About you only) | `ApplicantDraft` in `applicant.model.ts`, `EMPTY_APPLICANT`, `toDraft`, `toRequest` |
| Mock validation | `mock-api/*.mock.ts` or `mock-routes.ts` |
| API contract and validation (Phase 2) | DTO, FluentValidation validator |
| Database (Phase 2) | new migration script (never edit an applied one), plus constraints |
| Tests | rule spec, component spec, mock spec, E2E if user-visible, xUnit (Phase 2) |
