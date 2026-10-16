# Front end (Angular 19)

## Conventions

- **Formatting:** Prettier (`.prettierrc`), with tabs, single quotes, 120-character lines and no trailing commas. Match it exactly.
- **Components:** standalone only, with `ChangeDetectionStrategy.OnPush`. Use `inject()`, not constructor injection.
- **State:** signals for component and store state; RxJS for HTTP and form `valueChanges`. Always `takeUntilDestroyed`.
- **Templates:** use the new control flow (`@if`, `@for` with `track`). Bootstrap 5 classes only (no Bootstrap JS); styles in component SCSS using the `--app-*` tokens from `styles.scss`.
- **Forms:** typed reactive forms. Disabled controls mean "question not shown"; hidden answers are sent as `null`.
- **Structure:**
  - `core/`: app-wide services, models, config, journey.
  - `features/<step>/`: one folder per journey step.
  - `shared/`: reusable components and validators.
  - `mock-api/`: in-browser fake back end.
- **Reference data:** enums and option lists live in `core/models/reference-data.ts`. Numeric codes are shared with the back end, so never renumber them.
- **API errors:** `400 { errors: { field: message } }`. Map them through the shared error helper, not per component.

## Adding a journey step or field

Use the repo skill `.claude/skills/add-journey-step/SKILL.md`. It has the step-by-step guide and the "adding a field" checklist.

## Key building blocks

- **`APP_CONFIG`:** runtime `config.json`, chosen per build configuration from `config/<env>/`.
- **`JourneyService`:** next and previous steps; never hard-code a neighbouring step.
- **`ApplicationStore`:** cached journey data, the About you draft, `requiredApplicantCount`, `completedSteps`.
- **`ApplicationResourceClient`:** GET and PUT on `/applications/{id}/{resource}`, with `ETag` and `If-Match`.
- **`StepCardComponent` and `StepActionsComponent`:** the step frame and the Back/Continue footer.
- **`shared/validation`:** pure rule functions shared by the form validators and the mock.
- **`AddressLookup` and `AddressInputComponent`:** address suggestions (Addressfinder when `config.json` has `addressFinderKey`). E2E journeys block the real service; stub it with `page.route`.

## Testing

- `npm run test:ci` runs Karma and Jasmine headless.
- `npm run e2e` runs the Playwright journeys against the mock (it starts its own dev server on port 4300). `E2E_CONFIGURATION=local-api npm run e2e` runs them against the real API.
- Date-dependent rules use an injected clock or `jasmine.clock()`, never the real `Date.now()`.
- Mock service dependencies with `jasmine.createSpyObj`, following the pattern in `loan-details.component.spec.ts`.
