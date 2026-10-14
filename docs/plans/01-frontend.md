# Phase 1: Front end ("About you" step)

Status: **draft, for review.** Parent plan: [00-overview.md](00-overview.md).

## Goals

1. Add **About you** as step 2, meeting every rule in the brief.
2. Remove the duplication that a second step would otherwise create, without changing Loan details' behaviour.
3. Make the API configurable (mock, local or Lambda) without rebuilding.
4. Give it unit and E2E coverage, and run both in CI.

## Changes from the overview

| Overview said | Now | Why |
|---|---|---|
| HTTP error interceptor | A pure `toErrorMessages(error)` helper in `core/api` | An interceptor that rewrites `HttpErrorResponse` into a custom type hides the status from callers and makes error typing messier. A pure function is simpler and trivially testable. |
| Config loaded with `provideAppInitializer` | Loaded with `fetch` in `main.ts` before bootstrap | The config is then a plain synchronous `APP_CONFIG` value. Interceptors can be chosen at bootstrap, and nothing has to wait on an async token. |

## Design

### 1. Runtime config

```ts
// core/config/app-config.ts
export interface AppConfig {
	apiBaseUrl: string; // '/api' (mock or proxy) or 'https://xxx.execute-api...amazonaws.com/api'
	useMockApi: boolean;
	maxApplicants: number; // 4
	termsVersion: string; // '2026-10'
}
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
```

- `frontend/config/mock.json`, `local-api.json` and `aws.json` hold the settings for each environment.
- `angular.json` copies the right file to `/config.json` per build configuration, using an asset `input`/`output` mapping. New scripts: `start` (mock, the default), `start:api` (local API through `proxy.conf.json`) and `start:aws`.
- `main.ts` does `fetch('/config.json')`, then `bootstrapApplication(AppComponent, createAppConfig(config))`. A deployed build can have `config.json` swapped without a rebuild.
- `createAppConfig(config)` provides `APP_CONFIG` and registers `mockApiInterceptor` only when `useMockApi` is true.
- `API_BASE_URL` (a constant) is replaced by `APP_CONFIG.apiBaseUrl`. `CURRENT_APPLICATION_ID` stays as is, since auth and multiple applications are out of scope.

### 2. Journey

- **`JourneyService`** (root):
  - `steps` comes from `JOURNEY_STEPS`.
  - `next(path)` and `previous(path)` return the neighbouring step, or `null` at either end.
  - `goNext(path)` and `goBack(path)` navigate there.
  - Loan details' `goToNextStep()` and its hard-coded path are removed.
- **`JOURNEY_STEPS`** gains `{ path: '/about-you', title: 'About you' }`.
- **Routes** become lazy (`loadComponent`). `about-you` has a `canActivate: [loanDetailsSavedGuard]`.
- **Completed state** (ticks in the step nav): a step is complete when its data is saved and valid for the current loan details. Applicants count only if their number fits the applicant choice on Loan details. This is computed from the application store (below); the nav doesn't track it separately.

### 3. Application store (single source of truth for journey data)

`core/state/application.store.ts` is a root service with signals:

| Member | Purpose |
|---|---|
| `loanDetails` | signal, saved loan details or `null` |
| `applicants` | signal, saved applicants response or `null` |
| `applicantsDraft` | signal, unsaved About you form value or `null` |
| `ensureLoanDetails()` / `ensureApplicants()` | load once, then reuse the cached value; used by the guard and the components |
| `saveLoanDetails(d)` / `saveApplicants(r)` | call the API and update the cache; a successful applicants save clears the draft |
| `requiredApplicantCount` | computed from `loanDetails.numberOfApplicants`: `{ min: 1, max: 1 }`, `{ 2, 2 }` or `{ 3, maxApplicants }` |
| `completedSteps` | computed, used by the step nav |

- **Why a store:**
  - About you, the guard and the step nav all need the loan details. Without a store each would fetch them separately.
  - The Back requirement needs somewhere to keep unsaved input.
- **Draft lifetime:** the draft is kept in memory only. It is not written to `localStorage` or `sessionStorage`, because it holds personal details (names, dates of birth, mobile numbers). A page refresh therefore loses unsaved About you input. This is a deliberate trade-off, recorded in NOTES.

### 4. Shared resource client and concurrency

Loan details and applicants are both "one document per application" resources. The shared client is `core/api/application-resource.client.ts`:

```ts
get<T>(resource: string): Observable<T | null>                 // remembers the ETag from the response
put<TReq, TRes>(resource: string, body: TReq): Observable<TRes> // sends If-Match when it has an ETag
```

- `LoanDetailsService` and `ApplicantsService` become thin, typed wrappers over it. Today's URL-building duplication goes away.
- **Optimistic concurrency** uses an HTTP `ETag` on GET and PUT responses and `If-Match` on PUT. A stale PUT gets `412`, and the user sees "This application was updated somewhere else. Reload to see the latest details." The mock emulates this with a version counter per key, so the front end is built and tested against the same contract the .NET API will implement.

### 5. Shared UI and helpers

| Piece | Replaces |
|---|---|
| `StepCardComponent`: inputs for title, subtitle, `loading`, `errorMessages`; projects the form | The card, heading, spinner and error alert markup in every step |
| `StepActionsComponent`: inputs for `saving` and `showBack`; output `back` | The footer with Back/Continue and the saving spinner |
| `isInvalid(control)` in `shared/forms` | The per-component method |
| `toErrorMessages(error)` in `core/api` | The per-component method. Handles `{ errors: { f: string } }`, `{ errors: { f: string[] } }` (ASP.NET ValidationProblemDetails), `412`, and network errors (status `0`) |

Loan details is moved onto these pieces in a refactor commit, and its existing specs must still pass.

### 6. Validation rules, shared by the form and the mock

All in `shared/validation/applicant-rules.ts`, as pure functions and constants with no Angular dependencies:

- `normaliseAuMobile(raw)`:
  - Strips spaces, dashes and brackets.
  - Turns `+614…` or `614…` into `04…`.
  - Returns `04XXXXXXXX` or `null`.
- `isValidAuMobile(raw)` is `normaliseAuMobile(raw) !== null`.
- `ageOn(dateOfBirth: string, today: Date)`:
  - Parses `yyyy-MM-dd` as a **local** date. `new Date('1990-01-01')` is UTC and would shift a day in some time zones.
  - Returns whole years.
- `MIN_APPLICANT_AGE = 18`, `MAX_APPLICANT_AGE = 120`.
- `NAME_MAX_LENGTH = 50`, `EMAIL_MAX_LENGTH = 254`.

**Form validators** in `shared/validators` wrap these rules. `minimumAgeValidator(18, today)` takes a `today` function so tests are deterministic. The mock routes call the same functions, so the mock and the form cannot disagree. The .NET validators in Phase 2 copy the same constants, and their tests use the same boundary cases.

### 7. Models and contract

```ts
export enum Title { Mr = 1, Mrs = 2, Ms = 3, Miss = 4, Dr = 5 } // + TITLE_OPTIONS, in reference-data.ts

export interface Applicant {
	title: Title;
	firstName: string;
	lastName: string;
	email: string | null; // required for ordinal 1
	mobile: string;       // normalised 04XXXXXXXX
	dateOfBirth: string;  // ISO yyyy-MM-dd
}

export interface SaveApplicantsRequest {
	applicants: Applicant[]; // order = ordinal (index 0 is the primary applicant)
	consent: { accepted: boolean; termsVersion: string };
}

export interface ApplicantsResponse {
	applicationId: number;
	applicants: (Applicant & { id: number; ordinal: number })[];
	consent: { termsVersion: string; acceptedAt: string };
}
```

- `GET` returns `null` when nothing has been saved, matching loan details.
- `PUT` replaces the whole set. Applicants the customer removed are deleted on the server.
- **Server-side (mock) rules:**
  - Every field rule above.
  - The number of applicants must fit the saved Loan details. If Loan details hasn't been saved, return `409`.
  - `consent.accepted` must be `true`, and `termsVersion` must be the current one.
- **Error keys** take the form `applicants[1].mobile` and `consent`.

### 8. About you component (`features/about-you`)

- **Form:** `FormGroup<{ applicants: FormArray<ApplicantForm>; termsAccepted: FormControl<boolean> }>`.
- **Initial values** come from the draft if there is one, otherwise from the saved applicants, otherwise blank. The array is then trimmed or padded to `requiredApplicantCount.min`, keeping existing entries in order.
- **Email** is required at index 0. For the others it is optional, but validated when filled in.
- **Mobile** uses `type="tel"` and `inputmode="tel"`. The value is normalised when the request is built.
- **Date of birth** is a native `type="date"` input, with `max` set to today.
- **"More than two":**
  - Starts with 3 sections.
  - "Add another applicant" appears while there are fewer than `maxApplicants`.
  - "Remove" appears on non-primary applicants while there are more than 3.
- **Applicant headings:** "Applicant 1" gets a "Primary" badge. Others get the subtitle "Shown because you said two of you are applying" or "…more than two…", as in the mockup.
- **Terms:**
  - A checkbox using `Validators.requiredTrue`.
  - The link opens a native `<dialog>` with placeholder text. A native dialog gives focus trapping and Esc to close without Bootstrap JS.
  - The checkbox is pre-ticked only if the saved consent's `termsVersion` matches the current one; otherwise the customer must agree again.
- **Back** calls `journey.goBack()`. The draft is written to the store in `DestroyRef.onDestroy`, so input survives Back, step-nav clicks, and any other way of leaving.
- **Continue:** `markAllAsTouched`, then build the request (trim names, normalise the mobile, turn an empty email into `null`), then `store.saveApplicants`, then `journey.goNext()`. There is no step 3, so this shows the "saved" alert, the same as Loan details does today.
- **Accessibility:** a `fieldset` and `legend` for each applicant, label `for` and `id` pairs indexed per applicant, and `autocomplete` hints (`given-name`, `family-name`, `email`, `tel`, `bday`).

### 9. Guard

`loanDetailsSavedGuard` calls `store.ensureLoanDetails()`. If nothing is saved it returns a `UrlTree` to `/loan-details`. If the load fails, it lets the customer through; the step then shows its own load error instead of looping the redirect.

## Edge cases (each has a test)

| Case | Behaviour |
|---|---|
| Applicant count changed 2 → 1 on Loan details after applicants were saved | About you shows 1 section. Applicant 2 stays in memory but isn't submitted, and the server replaces the set. The step-nav tick disappears until About you is saved again. |
| Count changed 1 → 2 | The second section is blank; applicant 1 keeps their data. |
| Turns 18 today | Allowed. One day short of 18 is rejected. |
| Date of birth in the future, or age over 120 | Rejected. |
| Mobile formats: `0412 345 678`, `+61 412 345 678`, `61412345678`, `(04) 1234-5678` | All accepted and normalised to `0412345678`. Landlines (`02…`), 9 digits and letters are rejected. |
| Email left blank for applicant 2 | Allowed, and sent as `null`. Invalid when filled with a bad address. |
| Terms not accepted | Continue is blocked, with an inline message. |
| Saved consent on an older terms version | The checkbox starts unticked. |
| About you opened directly, before Loan details is saved | Redirected to Loan details. |
| Stale save (`412`) | The friendly reload message is shown and the form keeps its input. |
| Server returns field errors | Listed in the alert (the existing pattern). |

## Tests

**Unit tests (Karma and Jasmine):**

- `applicant-rules.spec.ts`: the mobile and age boundary tables above.
- `validators.spec.ts`: the form wrappers, using a fixed `today`.
- `journey.service.spec.ts`: next and previous, including both ends.
- `application.store.spec.ts`: caching, the draft being cleared on save, `requiredApplicantCount`, `completedSteps`.
- `application-resource.client.spec.ts`: the ETag is captured and sent back as `If-Match`.
- `error-messages.spec.ts`: each error shape.
- `about-you.component.spec.ts`:
  - 1, 2 and 3 sections for each applicant choice; add and remove limits.
  - Email required only for applicant 1.
  - Terms required.
  - The draft is restored after leaving the step.
  - The request is normalised.
  - Server and `412` errors are shown.
- `loan-details-saved.guard.spec.ts`.
- `mock-api.interceptor.spec.ts`: the applicants routes (persisting, field errors, count mismatch, missing loan details, `412`).
- The existing Loan details specs keep passing, updated only for its new collaborators.

**Playwright E2E (`frontend/e2e`, against the mock via `webServer: npm start`):**

1. Happy path with two applicants, ending on the saved state.
2. Back to Loan details and forward again keeps the unsaved About you input.
3. Inline validation for the mobile, the date of birth (under 18) and the terms.
4. "More than two": add up to 4 and remove down to 3.
5. Direct navigation to `/about-you` redirects to Loan details.

## Tooling

- angular-eslint (v19) and a `lint` script; lint runs in CI.
- `@playwright/test` (Chromium only) and an `e2e` script. CI gets an `e2e` job that uploads the report when it fails.

## Commit sequence

1. `chore(frontend)`: add angular-eslint and fix findings.
2. `refactor`: runtime config and configurable API base URL; mock interceptor registered only when enabled.
3. `refactor`: `JourneyService`, lazy routes, `OnPush`.
4. `refactor`: shared resource client and `toErrorMessages`; the services move onto them.
5. `refactor`: `StepCard`, `StepActions`, `isInvalid` and the application store; Loan details moves onto them.
6. `feat`: ETag and `If-Match` concurrency in the client and the mock.
7. `feat`: applicant model, title reference data, validation rules and validators, with tests.
8. `feat`: mock applicants endpoints, with tests.
9. `feat`: About you step (form, terms dialog, draft, guard), with tests.
10. `feat`: completed state in the step nav.
11. `test`: Playwright E2E suite and CI job.
12. `docs`: "adding a field" checklist and a repo skill for adding a journey step.

## Left out, and why

- **Saving drafts to the server.** This would need a separate draft endpoint with relaxed validation. An in-memory draft meets "Back keeps input" without weakening server validation.
- **Mapping server field errors onto individual controls.** It is worth doing, but the alert list is the existing pattern. Listed in NOTES under improvements.
- **Rejecting duplicate emails across applicants.** Couples often share an inbox, so this is a lender policy decision. Listed in NOTES.
- **A metadata-driven form engine.** The config seam (`maxApplicants`, `termsVersion`, the title list) is the first step towards one. NOTES describes how this would grow into per-lender field metadata.
