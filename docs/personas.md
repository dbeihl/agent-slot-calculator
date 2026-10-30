# Personas

## Hardware buyer

Runs cloud-backed coding agents and compares purchase candidates against the 128 GB Core Ultra desktop. Selects presets, edits price and RAM, and reads capacity, lifetime cost, fleet cost and upgrade flags.

Journey: `e2e/calculator.spec.ts`. Confirm the default 14-agent, $214 hardware, $305 lifetime and Worth it result. Try the M920q and reduce duty cycle to 15%.

Journey: `e2e/costs.spec.ts`. Compare every machine on the cost chart, read a dot's tooltip by pointer and keyboard, and open a machine in the calculator from its row.

Journey: `e2e/strategy.spec.ts`. Enter cash on hand and an agent target, compare the four buying strategies, turn on financing to see the loan's cost, and open a recommended machine in the calculator.

## Fleet operator

Models a measured workload and machines already owned. Changes workload chips, electricity and advanced assumptions, saves a custom machine through reload, and resets report defaults.

Journey: `e2e/calculator.spec.ts`. Check persistence, storage failure and power-only ownership. Model API parity uses the supplied fixed vectors in `test/model.test.ts`.

## Phone and keyboard user

Uses a 400px phone or keyboard navigation to compare and load machines. Needs a visible summary, controls with focus rings, table-only horizontal scrolling, and Enter and Space row activation.

Journey: `e2e/calculator.spec.ts`. Exercise both themes, reduced motion, keyboard controls and phone row scrolling.

## Test boundaries

Unit and integration tests call the public model API against fixed prototype vectors. UX tests drive the built static site in Playwright. The site has no database or server API. Each pull request runs the e2e workflow; repository required-check settings are managed by the owner. Account billing currently prevents hosted jobs, so the local output must accompany the delivery.
