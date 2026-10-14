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

## Adding a journey step

1. Add an entry to `core/journey/journey-steps.ts`.
2. Add a lazy route in `app.routes.ts`.
3. Create the model in `core/models`, the service in `core/api`, and the mock route in `mock-api/mock-routes.ts`.
4. Create the feature component using `StepLayoutComponent`.
5. Write specs for the component, the service or mock route, and any new validators.

## Testing

- `npm run test:ci` runs Karma and Jasmine headless.
- Date-dependent rules use an injected clock or `jasmine.clock()`, never the real `Date.now()`.
- Mock service dependencies with `jasmine.createSpyObj`, following the pattern in `loan-details.component.spec.ts`.
