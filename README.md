# Agent Slot Calculator

Compare how many cloud-backed coding agents a machine can carry at once, what each agent slot costs over its life, and whether it beats buying a 128 GB Core Ultra 7 270K Plus desktop.

**Live site:** [dbeihl.github.io/agent-slot-calculator](https://dbeihl.github.io/agent-slot-calculator/) · [cost chart](https://dbeihl.github.io/agent-slot-calculator/costs/)

The site has two pages. The calculator evaluates one machine in detail. The cost chart (`/costs/`) plots every machine's lifetime cost per agent against what one box costs over its life, under the settings last used in the calculator. It covers the report's presets, sourced market listings and machines you add, filters by condition, type, memory and budget, marks the cheapest per-agent option at each budget, and links each machine back to the calculator. [Market data](docs/market-data.md) explains the sources and the weekly eBay price refresh.

## Run locally

Use Node.js 24 or a version that meets `package.json`'s engine requirement.

```sh
npm install
npm run dev
npm test
npm run build
```

Open the dev server's `/agent-slot-calculator/` path. `npm run build` checks TypeScript and writes the static site to `dist/`.

Run the browser acceptance tests with `npm run test:e2e`. They start their own preview server against the built output. Install Chromium with `npx playwright install chromium` if Playwright has no browser installed.

## How the numbers work

1. Agents spend most of their time waiting on the model. The duty cycle is the share they spend building or running tests.
2. With that share, the number of builds running at once follows a binomial distribution. Memory must hold the 99th-percentile count, because running out kills jobs. CPU must cover the 95th, because contention only slows things down.
3. Each agent also holds a little memory all the time, and the system keeps some back.
4. Slower single-thread scores stretch the serial part of every build, which raises that machine's effective duty cycle. Weak multi-thread scores stretch the parallel part.
5. Lifetime per agent is (price + years × yearly power) ÷ agents. Machines you already own count power only. "Worth it" means it beats the 128 GB Core Ultra 7 270K Plus desktop under the same settings; "Close call" is within 25%.

The 23 presets and defaults come from the [research report](docs/research-report.md). Prices are from October 2026. Mac scores, several power figures and some prices are estimates. Used prices vary by listing.

## Design and validation

The [handoff](docs/source/HANDOFF.md), [prototype](docs/source/prototype.html) and [design notes](docs/source/DESIGN.md) define the port. The site uses Astro components, one vanilla TypeScript controller, and self-hosted Archivo and IBM Plex fonts. There is no UI framework, analytics or runtime request to another origin.

The [build plan](docs/build-plan.md), [personas](docs/personas.md), and [validation evidence](docs/validation.md) describe the implementation and checks. `test/test-vectors.json` pins the supplied model outputs. Keep the model, preset data and vectors unchanged unless an intentional model update is authorized.

## GitHub Pages

`astro.config.mjs` sets the project path to `/agent-slot-calculator/` on `https://dbeihl.github.io`. The deploy workflow validates pull requests and uses the [official Astro action](https://github.com/withastro/action) to prepare the Pages artifact after a push to `main`. Its dependent deploy job publishes that artifact to the `github-pages` environment.

The e2e workflow runs model and browser tests on every pull request. Every push to `main` publishes the site at <https://dbeihl.github.io/agent-slot-calculator/>.
