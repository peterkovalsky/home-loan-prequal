# Plan: server-side drafts and resuming an application

Status: **done.** Expiry set to 7 days in review.

## Goal

- A customer's answers are saved to the server **as they type**, even halfway through a step and even when the step isn't valid yet.
- They can close the browser, come back later, and pick up where they left off.

Today:
- Only a valid step is saved, on Continue.
- Unsaved input lives in memory and is lost on refresh.
- Every customer shares application `1`, which is fixed in `config.json`.

## The core change: each customer gets their own application, and a resume token

Drafts are personal data (names, date of birth, mobile). As soon as they're kept on the server and can be reopened, two things become necessary:

1. **Each visitor gets their own application.** `POST /api/applications` creates one when they first start typing, not when they merely open the page.
2. **Only the holder of the application can read or change it.** The create call returns a random **resume token** (256-bit). Every request for that application must present it.
   - The server stores only the token's SHA-256 hash, never the token.
   - A wrong or missing token returns `404`, the same as a missing application, so ids can't be probed.

This replaces the fixed application id. It also closes today's gap where anyone can read application `1` by id.

## Where the token lives: header now, cookie once there is one domain

| Option | Verdict |
|---|---|
| **`localStorage` plus an `X-Application-Token` header** ✅ now | Works for every setup we have, including the front end on `localhost` calling the API on `execute-api.amazonaws.com`. It survives closing the browser. |
| An API-set cookie, today | The front end and the API are on **different sites**, so the cookie would need `SameSite=None; Secure`. That makes it a third-party cookie, which Safari and Firefox block by default (and Chrome increasingly). It would silently fail to resume for many people. |
| **`HttpOnly; Secure; SameSite=Lax` cookie** ✅ production | Best once the front end and `/api` are served from one domain (CloudFront in front of both, already in Improvements). JavaScript can't read it, so XSS can't steal it. |

- **The API accepts the token from either the header or the cookie from day one.** The production switch is then a front-end and hosting change only.
- **The trade-off of `localStorage` is stated plainly:** an XSS bug could read the token. It's an anonymous resume token for one application, not an account. Accounts (Cognito) are the step after, and the draft is linked to the account at sign-up.

## Drafts are stored separately from the validated data

**New table `app.ApplicationDraft` (migration `0004`):**

| Column | Type | Notes |
|---|---|---|
| `ApplicationId` | int | Part of the PK; FK to `Application`, cascade delete |
| `Step` | `varchar(30)` | Part of the PK; checked against `loan-details` and `about-you` |
| `Data` | `nvarchar(max)` | Checked with `ISJSON`; 32 KB cap |
| `RowVersion` | rowversion | |
| `UpdatedAt` | datetime2 | |

- **The real tables and their constraints stay as they are.** Continue still does the validated `PUT` into `LoanDetails` or `Applicant`. A half-filled form can't weaken the schema.
- **A draft is loosely checked:** it must be a JSON object, within the size cap, for a known step. Its contents aren't validated, because by definition they can be incomplete.
- **A successful Continue deletes that step's draft** in the same transaction, so the validated data is the only copy.

**`app.Application` also gets:**
- `ResumeTokenHash binary(32)` (unique) and `LastActivityAt`.
- New ids from a `SEQUENCE` default. SQL Server can't turn an existing column into `IDENTITY` without rebuilding the table, and existing ids keep working.
- **`PUT` no longer creates an application implicitly.** Only `POST` does, because only `POST` can hand out a token. The smoke test and the integration tests change to create first.

## API

| Endpoint | What |
|---|---|
| `POST /api/applications` | Creates an application. Returns `201` with `{ id, resumeToken }`, the only time the token is ever sent. |
| `GET /api/applications/current` | With the token: the id, each step's saved data and draft, and the completed steps. This is the resume call. |
| `PUT /api/applications/{id}/drafts/{step}` | Saves a draft: last write wins (see below), returns `204`. |
| Existing `GET`/`PUT`/`DELETE` | Unchanged contract, but now require the token |

- **Last write wins** for drafts, instead of `If-Match`. An autosave conflict between two tabs shouldn't interrupt the customer. The validated save still uses `If-Match` and keeps its `412` protection.
- **Throttling:** the existing API Gateway limits apply. Autosave is debounced, so it sends about one request per pause in typing, not one per keystroke.

## Front end

- **`ApplicationSession`** holds the token in `localStorage`. At start-up it calls `GET /current`, routes to the furthest step, and restores each step's saved data or draft (a newer draft wins).
- **Autosave** on both steps:
  - It sends the raw form value 1 s after typing stops, and immediately when the tab is hidden or closed (`fetch` with `keepalive`).
  - A small status line says "Saving…" or "Saved", and "Couldn't save, we'll retry" on failure, with a retry and back-off.
- **"Not you? Start a new application"** forgets the token on this device. This matters on shared computers.
- The in-memory About you draft is replaced by the server draft, so Back and refresh behave the same way.
- **The mock API gets the same endpoints**, so `npm start` still runs with no back end.

## Retention and privacy

- **Drafts and unfinished applications expire after 7 days of inactivity.**
  - Reads ignore expired ones.
  - A daily scheduled Lambda (EventBridge) deletes them, so personal data isn't kept indefinitely.
- The token is never logged: it travels in a header, and the access log doesn't log headers.

## Tests

- **Unit:** token hashing and comparison, draft size and step rules, the session service (resume, start new), autosave (debounce, flush on hide, retry), and the step restore order.
- **Integration (real SQL Server):**
  - create, then resume;
  - a wrong token returns `404` on every route;
  - draft save and resume;
  - Continue deletes the draft;
  - expiry;
  - the new constraints.
- **Playwright:** fill half of Loan details, then **close the browser context and open a new one with the same storage**. The answers come back. Also "Start a new application" clears them.
  - The journeys no longer need application `900100`: each test creates its own application.
- **Infra:** CORS allows `X-Application-Token`; the cleanup schedule exists.

## Order of work

1. Migration `0004`, and the token in the domain and repositories.
2. The create and resume endpoints, the token check on every route, and integration tests.
3. The draft endpoint and table, with integration tests.
4. Front end: the session service, then autosave, then the restore order, plus mock routes and unit tests.
5. Playwright: the resume journey; drop the fixed-id E2E set-up.
6. Infra: the CORS header and the cleanup Lambda schedule; then the docs and NOTES.

## Left out, with reasons

- **Accounts or sign-in:** a separate step; drafts link to the account later.
- **Real-time sync between tabs:** last write wins is enough for one person.
- **Field-level server validation of drafts:** drafts are allowed to be incomplete; validation happens on Continue.

## As built

| Planned | Built | Why |
|---|---|---|
| `GET /api/applications/current` to resume | The browser keeps the id with the token and calls `GET /drafts` (plus the existing `GET`s) | One endpoint fewer. A `404` from `/drafts` means the application has expired or gone, and the front end starts afresh. |
| `RowVersion` on `ApplicationDraft` | No row version | Drafts are last write wins, so it would never be read. |
| The token check inside the request's transaction | One autocommit `UPDATE` (check and touch) before the handler runs | No lock outlives the statement, so a failed save can't hold the application row until after the response (ai-log #7). |
| `IDENTITY` ids | A `SEQUENCE` default, starting at 1,000,000 | SQL Server can't make an existing column `IDENTITY` in place, and it stays clear of ids used before. |
| Existing applications | Kept, but unreachable (no token hash), and purged with other inactive ones | A destructive migration wasn't needed. |
| Restore: draft *or* saved | Saved answers first, then the draft on top | A unit test showed a partial draft blanking saved fields. Layering is safer. |
| `beforeSave()` before the real save | Plus "last sent" that can only move forwards | The race test failed first (ai-log #17). |
| A daily cleanup Lambda | The migrator Lambda with `{"task":"purge-expired"}`, from an EventBridge rule | It already has the admin login and runs in the VPC, so there's no new function, image or secret. |
| "Start a new application" resets in place | A full page load after forgetting the session | Every step and cache starts empty, with no half-reset state. |

**Checked:**
- 103 unit and 59 integration tests on the back end, including mutation checks of the token filter.
- 156 unit tests on the front end, including a mutation check of the Continue race.
- 10 Playwright journeys on the mock and on Docker Compose; one of them closes the browser and comes back.
- The smoke test against Compose, and both Lambda images under the Runtime Interface Emulator.
