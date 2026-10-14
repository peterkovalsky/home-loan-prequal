# Back end (.NET 8, Dapper, SQL Server)

Design and the reasons behind it are in `docs/plans/02-backend.md`. Read it before changing the schema, the contract or the layering.

## Layering (dependencies point inward)

| Project | Holds | May reference |
|---|---|---|
| `HomeLoan.Domain` | Enums (codes shared with the front end), pure rules (`AuMobile`, `Age`, `ApplicantRules`, `ApplicantCountRange`) | nothing |
| `HomeLoan.Application` | Feature folders (`LoanDetails/`, `Applicants/`, `Applications/`): DTOs, FluentValidation validators, handlers, repository interfaces. `Common/`: `Result<T>`, `IUnitOfWork`, options | Domain |
| `HomeLoan.Infrastructure` | Dapper repositories, unit of work, connection factory, health check, DI registration | Application |
| `HomeLoan.Api` | Minimal API endpoint groups, ETag/If-Match, error mapping, CORS, correlation id, Lambda hosting | Application, Infrastructure |
| `HomeLoan.Migrations` | DbUp runner and `Scripts/*.sql` (embedded, run in name order) | nothing in `src` |

## Conventions

- **SQL:**
  - Parameterised SQL lives in the repository that uses it. No string concatenation of values.
  - Schemas: `ref` for lookups, `app` for application data.
- **Migrations:**
  - New migration means a new script `NNNN_description.sql`. **Never edit a script that has been applied.**
  - Scripts in `Scripts/Always/` are idempotent and run every time.
- **Errors:**
  - Handlers return `Result<T>`, and endpoints map its errors to HTTP statuses.
  - Throw only for the unexpected; those become a `500` ProblemDetails.
- **Concurrency:**
  - Each resource carries its own `rowversion`, exposed as a quoted hex ETag.
  - Writes are compare-and-swap (`WHERE RowVersion = @Expected`) inside the unit-of-work transaction.
- **Time:** use the injected `TimeProvider` and the business time zone (`Clock:TimeZone`). Never `DateTime.Now`.
- **Validation:**
  - Request DTO properties are nullable, so missing fields are reported, not defaulted.
  - Rule constants mirror `frontend/src/app/shared/validation/applicant-rules.ts`. Change both together.
- **Build:** warnings are errors, with analyzers at `latest-recommended`. Fix the cause; only suppress in `.editorconfig`, with a comment saying why.
- **Packages:** versions live in `Directory.Packages.props`. Stay on .NET 8-compatible versions (`Microsoft.*` 8.0.x).

## Commands

```bash
cd backend
dotnet build
dotnet test tests/HomeLoan.UnitTests
dotnet test tests/HomeLoan.IntegrationTests   # needs Docker (Testcontainers starts SQL Server)
```
