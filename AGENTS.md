# Agent Slot Calculator

A static Astro site with three pages. The calculator works out how many concurrent AI coding agents a machine can carry, what each agent slot costs over its life, and whether it beats buying a 128 GB Core Ultra 7 270K Plus desktop. The defaults and presets come from `docs/research-report.md` (October 2026 prices).

## Commands

- `npm run dev`: local dev server
- `npm test`: model parity tests (Vitest)
- `npm run build`: static build to `dist/`

## Architecture

- `src/lib/model.ts`: pure capacity and cost model, with no DOM. Binomial builds-at-once, memory sized to the 99th percentile, CPU to the 95th (5% overshoot allowed), and slow cores raise the effective duty cycle.
- `src/data/presets.ts`: the report's preset machines, `DEFAULTS` and `REFERENCE_ID`.
- `src/data/catalog.ts`: joins the presets with market data (`cpus.json`, `listings.json`, and `market-prices.json` from `scripts/refresh-prices.mjs`). Sources, rules and gaps are in `docs/market-data.md`; `test/catalog.test.ts` enforces them.
- `src/scripts/calculator.ts`: the DOM controller. It builds the slider fields, renders the verdict, chart and table, and saves to localStorage through `src/lib/saved.ts` (key `agent-slot-calc-v1`). `?preset=<id>` loads a preset and keeps the saved workload.
- `src/pages/costs/`, `src/scripts/costs.ts` and `src/lib/costs.ts`: the cost chart page. It plots each machine's lifetime total against its lifetime cost per agent on log axes, with filters and bands relative to the cheapest machine shown. `src/lib/listings.ts` holds machines the user adds (localStorage, exportable).
- `src/pages/strategy/`, `src/scripts/strategy.ts` and `src/lib/strategy.ts`: the buying-strategy page. It searches small fleets of catalog machines under the user's cash, financing, monthly and tolerance limits and compares four strategies; the search and recommendation rules are documented in `src/lib/strategy.ts`.
- `src/components/*.astro`: static markup. Element ids are used by the controller, so don't rename them.
- `src/styles/global.css`: design tokens (light plus two dark blocks) and component styles. See `docs/source/DESIGN.md`.

## Rules

- The model and presets are the product. Don't change the math, presets or defaults unless asked. `test/test-vectors.json` pins the expected outputs. Regenerate it only for an intentional data change, and note the date and source in the commit.
- Keep copy word for word unless asked to change it.
- No UI framework, no analytics, no runtime network calls.
- Every color comes from a token, and both themes must stay legible.
- No horizontal page scroll at 400px. Wide content scrolls inside its own container.
- Wrap all localStorage access in try/catch.
- Every score in `cpus.json` and price in `listings.json` needs a source link. Never fill one in from memory; a sourced estimate (the report's Apple figures) is marked `estimated`.

## Port contract

- `docs/source/HANDOFF.md` and `docs/source/prototype.html` preserve the handoff used for the port.
- `docs/validation.md` records acceptance checks, local evidence and supplied model edges.
- `docs/personas.md` and `e2e/*.spec.ts` define browser journeys. Run `npm run test:e2e` against the built site.
- GitHub Actions billing can prevent jobs from running. Report those jobs as not run.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
