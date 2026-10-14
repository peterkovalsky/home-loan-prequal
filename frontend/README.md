# Home Loan Pre-Qualification: Front-End Exercise

A small Angular app for the first steps of a home-loan pre-qualification journey. A customer answers a few questions about the loan they want. Later steps (about the applicants, their income and expenses, and so on) have not been built yet.

It is intentionally small. There is no real back end: all HTTP calls under `/api` are answered by an in-browser mock API that saves data to `localStorage`.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm start          # http://localhost:4200
npm test           # Karma + Jasmine, watch mode
npm run test:ci    # single headless run
```

To reset saved data, clear the site's local storage in your browser dev tools.

## Tech stack

- Angular 19: standalone components, signals, new control flow (`@if` / `@for`)
- Typed reactive forms
- Bootstrap 5 (CSS only)
- Karma + Jasmine

## Project structure

```
src/app
├── core
│   ├── api/            HTTP services, one per resource
│   ├── journey/        The ordered list of steps shown in the side navigation
│   └── models/         Domain models and reference data (enums + option lists)
├── features
│   └── loan-details/   Step 1: the only page built so far
├── mock-api
│   ├── mock-routes.ts  Fake endpoints; add new ones here
│   ├── mock-db.ts      localStorage-backed key/value store
│   └── mock-api.interceptor.ts
└── shared
    ├── components/     Reusable UI (step navigation)
    └── validators/     Custom form validators
```

## How the pieces fit

1. **Routes** are declared in `app.routes.ts`.
2. **Steps** in the side navigation come from `core/journey/journey-steps.ts`. When a step is saved, the app moves to the next entry in that list.
3. **API services** in `core/api` call `/api/...` with `HttpClient`. The mock interceptor matches the request against `MOCK_ROUTES`. A matched request gets a response after a short simulated delay. An unmatched request returns a `404`.
4. **Validation errors** come back from the mock API as `400 { errors: { field: message } }`.

### Existing endpoints

| Method | URL | Notes |
|---|---|---|
| `GET` | `/api/applications/:id/loan-details` | Returns `null` if nothing has been saved yet |
| `PUT` | `/api/applications/:id/loan-details` | Validates and saves; returns the saved object |

The current application id is fixed at `1` (`core/api/api.config.ts`).

## Your task

The task is described in the instructions you received with this repository.
