# Phase 2: .NET API and SQL Server

Status: **done.** Parent plan: [00-overview.md](00-overview.md). See "As built" at the end for where the code differs from this plan.

## Goals

1. An ASP.NET Core (.NET 8) API that implements the contract the front end uses, and validates everything again on the server.
2. A SQL Server schema with real integrity: keys, foreign keys, unique and check constraints, and indexes that suit the queries. Accessed with Dapper; no ORM.
3. Correct transactions and concurrent saves.
4. One codebase that runs in Docker Compose locally and on AWS Lambda (Phase 3) with no code changes.
5. xUnit unit tests for the rules, integration tests against a real SQL Server, and the Playwright suite run against the real stack.

## Changes from the overview (need your OK)

| Overview said | Proposed | Why |
|---|---|---|
| `rowversion` on `Application` as the ETag | A `rowversion` **per resource**: on `LoanDetails`, and on a new `ApplicantSet` row that owns the applicants | With one version per application, saving Loan details would make the applicants ETag the client holds stale. Back, then Continue, then saving About you would wrongly get `412`. Each resource needs its own version. |
| `ApplicationConsent` table | `ConsentRecord`, insert-only, unique per `(ApplicationId, TermsVersion)` | An audit trail is a log of acceptances, not one row that gets overwritten. |
| `GET` returns `200 null` when nothing is saved | `GET` returns **`404` ProblemDetails**. The front-end client maps `404` to `null`, and the mock does the same | `200 null` is unusual for REST. A `404` for "not saved yet" is the standard reading, and the brief invites contract improvements. It is a small client change. |
| (not planned) | **`DELETE /api/applications/{id}`**, cascading | It is a legitimate operation (withdrawal, or the right to erasure). It also lets the Playwright suite reset application `1` between tests when it runs against the real API. Without it, state leaks between tests. |
| Check constraints on the reference codes | **Lookup tables** in a `ref` schema, with foreign keys | Data-driven reference data is how their metadata-driven product works. Adding a title or state becomes an insert, not a constraint change. |
| FluentAssertions (implied) | **xUnit `Assert` only** | FluentAssertions v8 moved to a commercial licence (2025), the same reasoning as MediatR. |

## API contract

Base: `/api`. JSON is camelCase, and enums are their numeric codes (as the front end sends them).

| Method | URL | Success | Errors |
|---|---|---|---|
| `GET` | `/applications/{id}/loan-details` | `200` body, `ETag` | `404` not saved yet |
| `PUT` | `/applications/{id}/loan-details` | `201` when created, `200` when updated; body and new `ETag` | `400` validation, `412` stale, `428` `If-Match` missing |
| `GET` | `/applications/{id}/applicants` | `200` body, `ETag` | `404` not saved yet |
| `PUT` | `/applications/{id}/applicants` | `201`/`200`, body and `ETag` | `400`, `409` loan details not saved, `412`, `428` |
| `DELETE` | `/applications/{id}` | `204` (also when it didn't exist, so the call is idempotent) | — |
| `GET` | `/health/live`, `/health/ready` | `200`; ready also checks the database | `503` |

- **Bodies** are exactly the front-end models: `LoanDetails`, `SaveApplicantsRequest` and `ApplicantsResponse`, as in `frontend/src/app/core/models`.
- **ETag** is the `rowversion` as hex, quoted, e.g. `"00000000000007D3"`.
- **Concurrency rules on `PUT`:**
  - When the resource exists, `If-Match` is required (`428` if missing) and must match (`412` if not).
  - When the resource doesn't exist and `If-Match` is sent, the server returns `412` (RFC 9110).
- **Application creation:** `PUT` creates the `Application` row if it doesn't exist. HTTP allows `PUT` to create at a client-chosen URI, and the front end's application id is fixed at `1`. NOTES will say that in production, applications would be created with `POST`, have opaque ids and be scoped to the authenticated user.
- **`applicationId` in the loan-details body** must be missing or equal to the route id; otherwise `400`.
- **Errors** are ProblemDetails. Validation errors use `ValidationProblemDetails`: `errors: { "applicants[1].mobile": ["Applicant 2: enter a valid Australian mobile number."] }`. Keys are camelCase paths, and messages match the mock's wording.
- **CORS** is done in the app (allowed origins from config), and exposes `ETag` and allows the `If-Match` header. Doing it in the app means it behaves the same behind API Gateway.

## Solution layout

```
backend/
  HomeLoan.sln
  Directory.Build.props        net8.0, nullable, implicit usings, TreatWarningsAsErrors, analyzers (latest-recommended)
  Directory.Packages.props     Central Package Management
  .editorconfig
  CLAUDE.md
  Dockerfile                   multi-stage: targets `api` and `migrator`
  src/
    HomeLoan.Domain/           Enums (codes), ApplicantRules, AuMobile, Age, ApplicantCountRange, LoanPurposes. No dependencies.
    HomeLoan.Application/      Feature folders: LoanDetails/, Applicants/, Applications/
                                 each has Dto, Validator (FluentValidation), Get/Save handler, repository interface
                               Common/: Result<T>, Error, IUnitOfWork, ConcurrencyToken, options (ApplicantOptions, ConsentOptions, ClockOptions)
    HomeLoan.Infrastructure/   SqlConnectionFactory, UnitOfWork, Dapper repositories, DatabaseHealthCheck, DI registration
    HomeLoan.Migrations/       DbUp runner (library + console entry point), Scripts/*.sql (embedded)
    HomeLoan.Api/              Program.cs, endpoint groups, ValidationFilter<T>, ETag/If-Match helpers,
                               correlation-id middleware, error mapping, CORS, health, OpenAPI, AddAWSLambdaHosting
  tests/
    HomeLoan.UnitTests/        Domain rules, validators, handlers (fake repositories), ETag helpers
    HomeLoan.IntegrationTests/ Testcontainers.MsSql + WebApplicationFactory: HTTP end to end plus schema constraint tests
```

**Dependencies:**

- `Api` depends on `Application` and `Infrastructure`.
- `Infrastructure` depends on `Application`.
- `Application` depends on `Domain`.
- `Migrations` stands alone.

## Database design

All timestamps are `datetime2(3)` in UTC, defaulting to `SYSUTCDATETIME()`. Two schemas: `ref` for lookups and `app` for application data.

### Reference data (`ref`), seeded by migration

| Table | Key | Columns |
|---|---|---|
| `ref.LendingPurpose` | `Code smallint` | `Name nvarchar(50)`, `IsPurchase bit` |
| `ref.PropertyUsage` | `Code smallint` | `Name` |
| `ref.ApplicantCount` | `Code tinyint` (1, 2, 3) | `Name`, `MinApplicants`, `MaxApplicants` (nullable means "configured") |
| `ref.AuState` | `Code smallint` | `Abbreviation char(3)` (unique) |
| `ref.Title` | `Code tinyint` | `Name nvarchar(10)` (unique) |

The codes are exactly the front-end enum values. A migration test checks the seeds against the C# enums.

### Application data (`app`)

**`app.Application`**
- `Id int PK`, not an identity, because the client chooses it in the URL; `CHECK (Id > 0)`.
- `CreatedAt`.

**`app.LoanDetails`** (one per application)
- **Key:** `ApplicationId int PK`, FK to `Application` `ON DELETE CASCADE`.
- **Columns:**
  - `PurposeCode` FK, `PropertyUsageCode` FK, `ApplicantCountCode` FK, `StateCode` FK (nullable).
  - `IsSameHousehold bit NULL`, `NumberOfDependants tinyint`.
  - `LoanAmount`, `Deposit` (nullable) and `EstimatedPropertyValue`, all `decimal(12,2)`.
  - `IsAddressKnown bit`, `Address nvarchar(200) NULL`.
  - `RowVersion rowversion`, `CreatedAt`, `UpdatedAt`.
- **Checks:**
  - `NumberOfDependants BETWEEN 0 AND 20`.
  - `LoanAmount > 0`, `EstimatedPropertyValue > 0`.
  - `Deposit IS NULL OR (Deposit >= 0 AND Deposit <= EstimatedPropertyValue)`.
  - Household: `(ApplicantCountCode = 1 AND IsSameHousehold IS NULL) OR (ApplicantCountCode > 1 AND IsSameHousehold IS NOT NULL)`.
  - Address or state, exactly one: `(IsAddressKnown = 1 AND Address IS NOT NULL AND StateCode IS NULL) OR (IsAddressKnown = 0 AND Address IS NULL AND StateCode IS NOT NULL)`.

**`app.ApplicantSet`** (one per application; owns the applicants and carries their concurrency version)
- `ApplicationId int PK`, FK to `Application` `ON DELETE CASCADE`.
- `RowVersion rowversion`, `CreatedAt`, `UpdatedAt`.

**`app.Applicant`**
- **Keys and index:**
  - `Id int IDENTITY`, as a **non-clustered** PK.
  - **Clustered unique index** on `(ApplicationId, Ordinal)`. The only read is "all applicants for an application, in order", so each set is stored together and read with one seek.
  - FK on `ApplicationId` to `ApplicantSet` `ON DELETE CASCADE`.
- **Columns:**
  - `Ordinal tinyint`.
  - `TitleCode` FK.
  - `FirstName nvarchar(50)`, `LastName nvarchar(50)`.
  - `Email nvarchar(254) NULL`.
  - `Mobile char(10)`.
  - `DateOfBirth date`.
  - `CreatedAt`, `UpdatedAt`.
- **Checks:**
  - `Ordinal BETWEEN 1 AND 10`. This is a structural ceiling. The business limit (4) lives in config and is enforced by the validator, so changing the applicant cap is a config change, not a migration.
  - `Ordinal <> 1 OR Email IS NOT NULL` (the primary applicant must have an email).
  - `LEN(TRIM(FirstName)) > 0`, and the same for `LastName`.
  - `Mobile LIKE '04[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'` (stored normalised).
  - `DateOfBirth >= '1900-01-01'`. The age rule needs "today", so it lives in the application layer.

**`app.ConsentRecord`** (insert-only audit)
- `Id int IDENTITY PK`.
- `ApplicationId` FK to `Application` `ON DELETE CASCADE`.
- `TermsVersion varchar(20)`, `AcceptedAt`.
- Unique `(ApplicationId, TermsVersion)`, which is also the lookup index.
- The current consent is the latest row.

**Indexes:**
- The foreign keys into `ref` get no indexes. Those tables are tiny and rows are never deleted.
- Every query is by `ApplicationId`, which is the PK or the leading key in each table.

**Deliberately not in the database:**
- **"Deposit only when buying."** It would hard-code purpose codes into a constraint, while `ref.LendingPurpose.IsPurchase` is the real source of that fact. The validator enforces it.
- **The minimum age.** It needs today's date.

Both are noted in NOTES.

## Transactions and concurrency

**Unit of work.** `IUnitOfWork` opens one connection and one `READ COMMITTED` transaction per write request. It is created lazily, and reads don't use it. Repositories take the current transaction, and the handler commits.

**Save loan details:**
1. `INSERT app.Application` if it doesn't exist.
2. If the client sent a version: `UPDATE app.LoanDetails ... OUTPUT inserted.RowVersion WHERE ApplicationId = @Id AND RowVersion = @Expected`. Zero rows means a stale version, so roll back and return `412`.
3. If there was no version: `INSERT`. A PK violation (2627) means someone else created it first, which is also `412`.

**Save applicants:**
1. Check that loan details exist (`409` if not) and validate the count against them.
2. Compare-and-swap on `app.ApplicantSet`, the same way as loan details. The `UPDATE` takes a row lock, so concurrent writers for one application are serialised for the rest of the transaction.
3. `MERGE` into `app.Applicant` on `(ApplicationId, Ordinal)`: update the matching rows, insert new ones, delete ordinals beyond the new count. Ids stay stable per position.
4. Insert a `ConsentRecord` if this terms version hasn't been accepted yet.
5. Commit, and return the new `RowVersion` as the ETag.

**Race test.** Two `PUT`s with the same `If-Match` fired in parallel: exactly one gets `200`, the other `412`, and the database holds exactly one of the two versions.

**Isolation level.** I'd enable `READ_COMMITTED_SNAPSHOT` on the database so reads never block behind writes. It is set in the first migration. With the version checks in the `WHERE` clauses, it doesn't weaken the concurrency guarantees.

## Validation (server)

The rule constants are the same as `frontend/src/app/shared/validation/applicant-rules.ts`, and the unit tests use the same boundary cases.

**Loan details:**
- Codes must be valid.
- `isSameHousehold`: required when there is more than one applicant; must be `null` for a single applicant.
- Dependants between 0 and 20.
- `loanAmount` and `estimatedPropertyValue` greater than 0 and at most 100,000,000. The cap is a sanity limit that fits `decimal(12,2)`. The front end gets the same `max` validators.
- `deposit`: required for purchase purposes and `null` otherwise; at least 0; no more than the property value.
- `address`: required, up to 200 characters, when the address is known; `null` otherwise.
- `state`: required when the address isn't known; `null` otherwise.

**Answers to hidden questions must be `null`.** The server rejects them instead of silently dropping them ("never trust the client").

**Applicants:**
- Title must be a valid code.
- Names: trimmed, non-empty, up to 50 characters.
- Email: required for the primary applicant, valid when present, up to 254 characters.
- Mobile: normalised as on the front end (`+61` and spaces).
- Date of birth: ISO `yyyy-MM-dd`, a real date, not in the future, age between 18 and 120.
- Count: within the range for the loan details answer (`maxApplicants` from `Applicants:MaxApplicants`).
- Consent: `accepted == true`, and `termsVersion` equal to `Consent:CurrentTermsVersion`.

**Request DTOs use nullable properties,** so a missing field is reported as "required" instead of silently becoming `0` or `false`. Malformed JSON gets a `400` ProblemDetails.

**"Today" uses the business time zone** (`Clock:TimeZone = Australia/Sydney`) through `TimeProvider`. Otherwise someone turning 18 today would be rejected on a Sydney morning while UTC is still on yesterday's date. Risk: the Lambda image may not include tzdata. Phase 3 checks this; the fallback is `TZ` plus bundling tzdata.

**Handlers return `Result<T>`.** The errors are `Validation`, `NotFound`, `PreconditionRequired`, `PreconditionFailed` and `Conflict`, and the endpoint maps each to `TypedResults`. Exceptions are only for the unexpected: they go through `IExceptionHandler` as a `500` ProblemDetails with the correlation id and no stack trace.

## Running in Docker and on Lambda

- **Hosting:** `AddAWSLambdaHosting(LambdaEventSource.HttpApi)`. It does nothing under Kestrel, so the same binary runs locally (port 5080) and on Lambda.
- **Configuration:** `appsettings.json`, then environment variables. The connection string is `ConnectionStrings:HomeLoan`. Phase 3 adds an optional `Database:SecretId`; when it is set, a configuration source builds the connection string from Secrets Manager. That is configuration only, not a code change.
- **Least-privilege database login:**
  - The migrator connects as admin, runs the scripts, then runs an idempotent "always" script that creates the `homeloan_app` login and user if missing.
  - That user gets `SELECT`, `INSERT`, `UPDATE` and `DELETE` on the `app` schema and `SELECT` on `ref`, and no DDL rights.
  - The API connects as that user. Its password comes from an environment variable, or in AWS, from Secrets Manager.
- **`docker-compose.yml`** (at the repo root):
  - `sqlserver`: `mcr.microsoft.com/mssql/server:2022-latest` with `platform: linux/amd64` (Rosetta on Apple Silicon), and a healthcheck using `sqlcmd -C`.
  - `migrator`: starts when `sqlserver` is healthy, then exits.
  - `api`: starts when the `migrator` has completed successfully, on `5080:8080`.
  - Secrets come from `.env`, which is gitignored; `.env.example` is committed.
- **Logging:** JSON to the console (CloudWatch picks it up on Lambda). The correlation id comes from the `X-Correlation-Id` header or the trace id, goes into every log scope, and is echoed back in the response.
- **OpenAPI:** Swashbuckle, in Development only.

## Tests

**Unit tests (xUnit):**
- `AuMobile`: the same accept and reject table as the front end.
- `Age`: today's birthday; tomorrow's birthday; 29 Feb in a non-leap year; the time-zone boundary using `FakeTimeProvider`.
- `LoanDetailsValidator`: every conditional rule, including hidden answers being rejected.
- `SaveApplicantsValidator`: fields and consent.
- Handlers with in-memory fake repositories: count mismatch; `409` when loan details are missing; the `428` and `412` paths; `201` vs `200`.
- ETag formatting and parsing.

**Integration tests** (one SQL Server container per test run, migrations applied, data reset between tests):
- Loan details round trip: `201` then `200`; the ETag changes; `428`; `412`.
- Applicants:
  - `409` before loan details are saved.
  - Saving 2 applicants, then 1, deletes the second row.
  - Ids stay stable for the same ordinal.
  - Re-agreeing to the same terms keeps the original `AcceptedAt`.
  - New terms add a second `ConsentRecord`.
- **The race test** (above).
- **Schema tests:** raw SQL inserts that break each check, unique and foreign key constraint fail. This proves integrity doesn't depend on the API alone.
- `DELETE` cascades; `/health/ready` reports `200`.
- Seeds match the C# enums.

**E2E:** the existing Playwright suite runs with `E2E_CONFIGURATION=local-api` against Compose, calling `DELETE /api/applications/1` in `beforeEach`. Only one worker runs in this mode, because the application id is shared.

**CI:**
- A `backend` job: `dotnet build`, then unit and integration tests. GitHub's runners have Docker for Testcontainers.
- An `e2e-api` job: `docker compose up -d --wait`, then Playwright, then compose down.

## Front-end changes in this phase

- `ApplicationResourceClient.get` maps `404` to `null`; the mock returns `404` for unsaved resources. Specs are updated.
- `max` validators for the loan amount and property value (100,000,000), with messages.
- Playwright: a `beforeEach` reset in `local-api` mode; one worker.
- Check `npm run start:api` against Compose by hand once.

## Commit sequence

1. `chore(backend)`: solution skeleton, `Directory.Build.props`, CPM, `.editorconfig`, `backend/CLAUDE.md`, CI build job.
2. `feat(db)`: migrations project, schema and reference seeds, app login script; Compose with `sqlserver` and `migrator`.
3. `feat(domain)`: rules, with unit tests.
4. `feat(application)`: DTOs, validators, `Result`, handlers, repository interfaces, with unit tests.
5. `feat(infrastructure)`: connection factory, unit of work, Dapper repositories, health check.
6. `feat(api)`: endpoints (including `DELETE`), ETag and `If-Match`, error mapping, CORS, correlation id, logging, health, OpenAPI, Lambda hosting, Dockerfile, Compose `api`.
7. `test(backend)`: integration tests, including the race and the schema constraints.
8. `feat(frontend)`: `404` mapped to `null`, amount caps, E2E reset for the real API.
9. `ci`: backend tests, and E2E against Compose.
10. `docs`: as-built notes, README commands, CLAUDE.md commands.

**Estimate:** about 4–5 hours. Integration tests on Apple Silicon run SQL Server under emulation, so a container takes about 30–60 seconds to start; one shared container per run keeps that bearable.

## Left out, and why

- **Stored procedures.** Dapper with parameterised SQL in the repositories keeps the SQL next to the code that uses it, and is just as safe from injection. NOTES records the trade-off.
- **Outbox and domain events.** Nothing else reacts to saves yet.
- **Encrypting columns with personal data (Always Encrypted).** RDS encryption at rest and TLS in transit cover this exercise. NOTES lists column-level encryption as next for dates of birth and mobile numbers.
- **Serving the applicant cap and terms version to the front end** (e.g. `GET /api/config`). For now the front end's `config.json` and the API settings must agree; NOTES flags the drift risk and this fix.

## As built

Delivered in 11 commits (`0f5c93c` to the docs commit). Tests: 77 unit, 47 integration (real SQL Server via Testcontainers) and 6 Playwright journeys, run against both the mock and Docker Compose. All four CI jobs pass.

| Planned | Built | Why |
|---|---|---|
| Repositories work with DTOs | **Domain records** (`LoanDetails`, `Applicant`, `ApplicantSet`, `Consent`) in `HomeLoan.Domain` | The persistence layer shouldn't depend on the HTTP contract. Mapping validated DTOs (nullable) to domain records (non-null) also removes the `!` from repository code. |
| FluentValidation in an endpoint filter | **Validation inside each handler** | The handler is the use-case boundary, so no entry point (an endpoint, a future Lambda trigger, a test) can skip validation. One less piece of framework plumbing. |
| A `Result<T>` with an `Error` type | `AppError` | CA1716: `Error` is a reserved word in VB. Static factories moved to a non-generic `Result` class (CA1000). |
| `IExceptionHandler` for bad requests | **`BadRequestMiddleware`**, inside `UseExceptionHandler` | ai-log #5 and #6. Malformed JSON returned `500` in Development, and the first fix logged every client mistake at Error level with a stack trace. |
| One transaction per request, rolled back on dispose | Plus **`IUnitOfWork.RollbackAsync`**, called as soon as a save fails | ai-log #7, found on CI. Locks are released before the client can send its next request, and dispose tolerates a transaction the server has already ended. |
| A table-valued parameter for the `MERGE` | `OPENJSON(@applicants)` as the `MERGE` source | No user-defined table type to create, grant and migrate. The validator caps lengths before `OPENJSON` could truncate. |
| — | Deadlocks and timeouts give **`503` + `Retry-After`** (`DatabaseExceptionHandler`) | A transient failure should tell the client to retry, not return a generic 500. |
| — | `homeloan_app` login checked by tests: data access works, `CREATE TABLE` is denied | Proves least privilege, rather than just stating it. |
| 5 race rounds | 20 by default; `RACE_ROUNDS` overrides | CI exposed a rare interleaving that 5 rounds and local emulation didn't. |

**Notes for NOTES.md:**

- **Applicant ids are stable per position, not per person.** Removing applicant 2 of 4 shifts applicant 3 into position 2, and it keeps position 2's id. Ids per person would need the client to send ids back; that is listed as an improvement.
- **Loan details are read outside the applicants transaction.** If loan details change between that read and the applicants save, the count check uses the earlier answer. The window is milliseconds, and the step nav's "completed" rule re-checks the count. Locking loan details too was judged not worth the contention.
- **.NET 8 exception logging.** `ExceptionHandlerMiddleware` logs at Error before any `IExceptionHandler` runs (.NET 9+ can suppress this). That's why bad requests are handled in middleware.
