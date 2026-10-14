# AI log

These are real cases where AI output (Claude Code) was wrong, incomplete, or needed steering, and how each was caught. Entries are added as they happen. A summary goes into `NOTES.md`.

| # | Phase | What the AI proposed | What was wrong | How it was caught | Outcome |
|---|---|---|---|---|---|
| 1 | Planning | Treat "keep it simple" as a virtue: no MediatR, no generic repository, no metadata-driven forms, with little else in their place. | It undershot the brief ("structure it like real production code", "so it can grow"). The reasoning was "less is better", not a cost-benefit case for each pattern. | Reviewing the plan against the brief and the assessment criteria. | Plan revised to name the production patterns that are included (layering, handlers, FluentValidation, ProblemDetails, unit of work, ETags, TimeProvider, runtime config) and to give a specific reason for each one left out. |
