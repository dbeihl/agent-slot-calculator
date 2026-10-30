# Port validation

Local checks on macOS on 2026-10-23 passed against the static Astro build under Node.js 26.10.0 and the CI major version, Node.js 24.22.1. The required default result is 14 agents, limited by memory, $214 hardware per agent, $305 lifetime per agent, and Worth it.

## Acceptance evidence

| Acceptance criterion | Evidence |
| --- | --- |
| 32 supplied parity vectors plus defaults | `npm test` passes 35 tests in `test/model.test.ts`: the 33 parity and default checks, plus multi-CPU and RAM stick checks. |
| Static output without TypeScript errors | `npm run build` passes `astro check` and produces `dist/index.html`. |
| Layout at 400px and 1280px, light and dark | Author inspected all four screenshot pairs below. Section positions and dimensions match with a maximum difference of 0px. |
| Default reference verdict | Browser test pins 14 agents, memory limit, $214, $305 and Worth it. |
| M920q verdict | Browser test pins 0 agents and Can't hold an agent. |
| Duty cycle 15% | Browser test pins 26 agents. |
| Phone overflow | Both 400px theme tests verify page width equals viewport width and the table scrolls internally. |
| Keyboard controls | Browser test reaches every visible control by Tab with a 2px visible focus outline. Row tests activate with Enter and Space. |
| Reload and blocked storage | Browser tests restore custom machine and workload inputs, and exercise a throwing localStorage getter. |
| Same-origin runtime assets | Four layout tests observe all requests and reject other origins. Fonts load from the site's bundled assets. |
| Reduced motion | Four layout tests emulate reduced motion and verify the verdict band has no transition. |

`npm run test:e2e` passes 17 tests in `e2e/calculator.spec.ts`. Additional behavior checks cover paired slider and number controls, number values above slider maxima, custom machine selection, OS reserve, ownership, upgrades, multiple CPUs, the RAM stick comparison, workload chips, advanced assumptions, reset, the phone summary, and the sticky desktop verdict.

## Visual comparison

| Size and theme | Supplied prototype | Astro port |
| --- | --- | --- |
| 400px light | [Prototype](validation/prototype-400-light.png) | [Astro](validation/astro-400-light.png) |
| 400px dark | [Prototype](validation/prototype-400-dark.png) | [Astro](validation/astro-400-dark.png) |
| 1280px light | [Prototype](validation/prototype-1280-light.png) | [Astro](validation/astro-1280-light.png) |
| 1280px dark | [Prototype](validation/prototype-1280-dark.png) | [Astro](validation/astro-1280-dark.png) |

The prototype is an HTML fragment without a doctype or viewport metadata. The comparison wraps it in standards mode and applies the handoff's standalone viewport and reset replacements. Its model, controller, markup and component CSS remain unchanged. The original source is preserved at `docs/source/prototype.html`. Both versions use the same browser and fonts at 100% scale. [Layout measurements](validation/layout-measurements.json) record the viewport and section geometry.

Screenshots and interactive inspection used `chrome-devtools-axi`. These are author checks. Independent exploratory testing by another agent and its PR evidence remain for firstmate's validation stage under the solo-worker contract.

## Red-to-green evidence

Commit `9f48a98` adds only the default browser test. Against the scaffold it fails at `#agents`, expecting 14 and finding no element. After the port, the same test passes.

Commit `642fca6` added a zero-memory test for a UI guard. The guard and its test were later removed to restore prototype behavior, so [the validation log](validation/local-checks.txt), recorded before that removal, lists 14 browser tests. `test/test-vectors.json` remains byte-identical to the supplied seed file. `src/lib/model.ts`, `src/data/presets.ts` and `test/model.test.ts` have since changed on purpose to add multiple CPUs and the RAM stick comparison.

## Known handoff edges

- Memory per build of zero is below the 4 GB slider minimum, but the number box accepts it and the prototype passes it to the model. `ramFitBuilds` divides by zero, so the chart shows "Memory fits 100+". It produces NaN only when usable memory exactly equals shown × residentGB. The port keeps prototype behavior and flags this edge for the user.
- The capacity search stops at 400 agents. This is unchanged.
- The prototype requests Archivo widths 62–125 while DESIGN.md describes 72–112. The self-hosted Archivo file supports 62–125 and the CSS uses its supplied 72% and 112% settings.

## Tooling and release limits

Astro 7.4.2's checker requires TypeScript 6. The checker dependency also needs `@emnapi/runtime`, which its transitive package omits from runtime dependencies. Both are explicit dev dependencies here. Astro detects agent-run preview commands and backgrounds the server, so Playwright passes `--ignore-lock` to keep its own server in the foreground.

GitHub Actions is known to be billing-blocked on the dbeihl account. Hosted checks have not run in this worker stage. No workflow workaround, repository-setting change, push, merge or deployment was performed. Local command output is in [the validation log](validation/local-checks.txt). A deployed URL and a real Pages smoke check remain for the release stage.

The multi-model plan review is deferred under the worker contract in [the plan review record](interrogate-report.md). Mutation testing has not run. The installed mutation workflow excludes personal repositories such as this one.
