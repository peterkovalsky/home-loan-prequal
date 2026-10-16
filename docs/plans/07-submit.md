# Plan: submitting the application

Status: **done.** Asked for after the brief, which ends at About you.

## Goal

Continue on the last step (About you) **submits** the application. Submitting is the existing validated save of the applicants and their consent, with no new server state, as agreed. The customer then sees a completion screen with an animated tick, their reference number, and a button to start a new application.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Server | No change | "Just save it": the applicants `PUT` is already the final, validated save. A finished application is already kept by the purge (`ApplicantSet` exists), so it stays as the lender's record. |
| Where it shows | A `/complete` route outside the step list, so not in the step nav | It's an outcome, not a step to fill in. `JOURNEY_STEPS` stays the list of steps. |
| Getting there | About you navigates to `/complete` when there's no next step. A guard sends anyone else (nothing submitted yet) to the furthest step. | You can't land on "submitted" without having submitted. |
| Coming back later | Opening the app on a submitted application goes to `/complete` | The resume guard already picks the furthest point. |
| Reference | `HL-` plus the application id | Something to quote on the phone. The id isn't a secret; the token is. |
| Animation | An SVG tick drawn with a CSS stroke animation; none with `prefers-reduced-motion` | No library. It respects people who turn motion off. |
| Start a new application | The same as "Not you?": forget this device's application, then a fresh page load | One code path (moved into a small shared service). The submitted application stays on the server. |
| Editing after submitting | Still possible through the step nav | No locking was asked for. Locking is the step after: a status column and read-only routes. |

## Tests

- **Unit:**
  - the completion component (reference, the button starts over, the tick hidden from screen readers);
  - the complete guard;
  - the resume guard sending a submitted application to `/complete`;
  - About you navigating to `/complete` after its save.
- **Playwright:** the happy path ends on the completion screen, and "Start a new application" gives a blank Loan details. A returning customer with a submitted application lands on `/complete`.

## As built

| Planned | Built | Why |
|---|---|---|
| A complete guard | `submittedGuard`, sharing the "furthest point" logic with `resumeGuard` (the store's new `ensureProgress()`) | One definition of where the customer has got to. |
| — | The step nav's host is `display: block` | Its links couldn't be clicked on the completion screen (ai-log #18). |
| — | "Start a new application" and "Not you?" share a `StartOver` service | Previously in the app shell only. |
| — | About you's "Your details have been saved" message removed | The completion screen replaces it. |

**Checked:**
- 160 unit tests.
- 13 Playwright journeys on the mock and on Docker Compose: submit, reload, the nav back to About you, start a new application, a returning submitted customer, and `/complete` refused before submitting.
- Screenshots on desktop and phone width. `document.getAnimations()` shows the tick drawing (circle, then check).
- Not tested: the reduced-motion rule. It's one CSS media query, checked by reading it.
