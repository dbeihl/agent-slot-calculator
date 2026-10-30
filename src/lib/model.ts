/**
 * Agent Slot Calculator: the capacity and cost model.
 *
 * Pure functions, no DOM. Ported 1:1 from the MODEL block in
 * prototype/agent-slot-calculator.html. Results must match
 * test/test-vectors.json exactly (to 2 decimal places).
 *
 * Idea in one paragraph: an agent spends most of its time waiting on the model
 * and only a share `p` (the duty cycle) building or running tests. For n agents
 * the number of builds running at once is Binomial(n, pEff). Memory must hold the
 * 99th-percentile count (running out kills jobs); CPU must cover the 95th
 * (contention only slows things, so a 5% overshoot is allowed). Slow cores
 * stretch each build, which raises the machine's effective duty cycle pEff.
 */

/** Ryzen 9 9950X PassMark scores: the yardstick every machine is measured against. */
export const REF = { st: 4726, mt: 65693 } as const;
/** Share of one CPU's multi-thread score that each CPU beyond the first adds. */
export const EXTRA_CPU_SHARE = 0.8;

export type Limit = 'ram' | 'cpu' | 'cap';
export type VerdictKey = 'ok' | 'warn' | 'bad';

export interface Machine {
  id?: string;
  group?: string;
  name: string;
  /** Purchase price in USD, all in. Ignored for cost when `owned` is true. */
  price: number;
  /** Installed RAM in GB. */
  ram: number;
  /** PassMark single-thread rating. */
  st: number;
  /** PassMark CPU Mark (multi-thread) of one CPU. */
  mt: number;
  /** CPUs (sockets) in the system, all the same model. Default 1. Each one beyond the first adds EXTRA_CPU_SHARE of mt. */
  cpus?: number;
  /** Wall watts at idle and at full load. */
  idle: number;
  load: number;
  /** GB kept back for the OS: 6 on Linux, 8 on macOS (includes Docker's VM). */
  reserve: number;
  /** Already owned: only electricity counts toward cost. */
  owned?: boolean;
  /** Optional RAM upgrade: target GB and its cost in USD (0 = none). */
  upGB?: number;
  upCost?: number;
  /** One-line provenance shown under the machine form. */
  note?: string;
}

export interface Assumptions {
  /** Duty cycle: share of each agent's time spent building or testing (0–1). */
  p: number;
  /** Peak GB of one running build plus its test database. */
  slotGB: number;
  /** Threads per running build, in 9950X-class threads (4 = 1/8 of a 9950X). */
  threads: number;
  /** GB each agent holds all the time (CLI, language servers, watchers). */
  residentGB: number;
  /** Share of a build that is serial and scales with single-thread speed (0–1). */
  serial: number;
  /** Electricity price in USD per kWh. */
  rate: number;
  /** Share of the day at full load; the rest counts as idle. Boxes run 24/7. */
  loadShare: number;
  /** Years the purchase is spread over. */
  years: number;
  /** Agents wanted in total (fleet line only). */
  target: number;
  /** Price of the reference box (Core Ultra 7 270K Plus, 128 GB). */
  refPrice: number;
}

export interface Result {
  /** Agents the box carries at once. */
  n: number;
  /** What stopped n from going higher. */
  limit: Limit;
  pEff: number;
  stretch: number;
  stStretch: number;
  mtStretch: number;
  /** PassMark points one running build needs. */
  slotMT: number;
  powerYr: number;
  watts: number;
  /** Cost counted (0 when owned). */
  cost: number;
  price: number;
  ram: number;
  /** Purchase per agent; Infinity when n = 0. */
  hwPer: number;
  /** (cost + years × powerYr) / n; Infinity when n = 0. */
  lifePer: number;
  /** Binomial pmf at max(n, 1), for the chart. */
  pmf: number[];
  shown: number;
  q95: number;
  q99: number;
  /** Builds that fit in memory / CPU at `shown` agents (for the chart lines). */
  ramFitBuilds: number;
  cpuFitBuilds: number;
  /** Share of RAM used at p99 and of CPU used at p95 (0 when n = 0). */
  ramUsedP99: number;
  cpuUsedP95: number;
}

export interface Verdict {
  key: VerdictKey;
  label: string;
  /** lifePer ÷ reference lifePer. */
  ratio: number;
}

const LF: number[] = [0];
function logFact(n: number): number {
  while (LF.length <= n) {
    const i = LF.length;
    LF.push(LF[i - 1] + Math.log(i));
  }
  return LF[n];
}

/** Binomial probability mass function, computed in log space to avoid underflow. */
export function binomPmf(n: number, p: number): number[] {
  const out: number[] = new Array(n + 1).fill(0);
  if (p <= 0) { out[0] = 1; return out; }
  if (p >= 1) { out[n] = 1; return out; }
  const lp = Math.log(p), lq = Math.log(1 - p), lfn = logFact(n);
  for (let k = 0; k <= n; k++) {
    out[k] = Math.exp(lfn - logFact(k) - logFact(n - k) + k * lp + (n - k) * lq);
  }
  return out;
}

/** Smallest k whose cumulative probability reaches q. */
export function quantile(pmf: number[], q: number): number {
  let c = 0;
  for (let k = 0; k < pmf.length; k++) {
    c += pmf[k];
    if (c >= q - 1e-12) return k;
  }
  return pmf.length - 1;
}

/**
 * How many agents a machine carries and what each costs.
 * `ramOverride` / `priceOverride` evaluate an upgrade scenario without mutating `m`.
 */
export function evaluate(m: Machine, a: Assumptions, ramOverride?: number | null, priceOverride?: number | null): Result {
  const ram = ramOverride != null ? ramOverride : m.ram;
  const price = priceOverride != null ? priceOverride : m.price;
  const mt = m.mt * (1 + EXTRA_CPU_SHARE * ((m.cpus || 1) - 1));
  const slotMT = (a.threads * REF.mt) / 32;
  const stStretch = REF.st / Math.max(1, m.st);
  const mtStretch = Math.max(1, slotMT / Math.max(1, mt));
  const stretch = a.serial * stStretch + (1 - a.serial) * mtStretch;
  const pEff = Math.min(0.95, a.p * stretch);
  const usable = ram - m.reserve;

  let n = 0;
  let limit: Limit = 'ram';
  for (let k = 1; k <= 400; k++) {
    const pmf = binomPmf(k, pEff);
    const q99 = quantile(pmf, 0.99);
    const q95 = quantile(pmf, 0.95);
    const ramOk = k * a.residentGB + q99 * a.slotGB <= usable;
    // CPU contention only slows builds, so allow a 5% overshoot.
    const cpuOk = q95 <= 1 || q95 * slotMT <= mt * 1.05;
    if (!ramOk || !cpuOk) { limit = !ramOk ? 'ram' : 'cpu'; break; }
    n = k;
    if (k === 400) limit = 'cap';
  }

  const shown = Math.max(n, 1);
  const pmf = binomPmf(shown, pEff);
  const q95 = quantile(pmf, 0.95);
  const q99 = quantile(pmf, 0.99);
  const watts = m.idle * (1 - a.loadShare) + m.load * a.loadShare;
  const powerYr = watts * 8.76 * a.rate; // 8,760 h/yr ÷ 1,000 W/kW
  const cost = m.owned ? 0 : price;
  const hwPer = n ? cost / n : Infinity;
  const lifePer = n ? (cost + a.years * powerYr) / n : Infinity;
  const ramFitBuilds = Math.max(0, (usable - shown * a.residentGB) / a.slotGB);
  const cpuFitBuilds = mt / slotMT;
  const ramUsedP99 = n ? (m.reserve + n * a.residentGB + q99 * a.slotGB) / ram : 0;
  const cpuUsedP95 = n ? (q95 * slotMT) / mt : 0;

  return {
    n, limit, pEff, stretch, stStretch, mtStretch, slotMT, powerYr, watts, cost, price, ram, hwPer, lifePer,
    pmf, shown, q95, q99, ramFitBuilds, cpuFitBuilds, ramUsedP99, cpuUsedP95,
  };
}

/** Compare a result with the reference box's result under the same assumptions. */
export function judge(r: Result, ref: Result, m: Machine): Verdict {
  if (r.n === 0) return { key: 'bad', label: "Can't hold an agent", ratio: Infinity };
  const ratio = r.lifePer / ref.lifePer;
  let key: VerdictKey = ratio <= 1.0001 ? 'ok' : ratio <= 1.25 ? 'warn' : 'bad';
  let label =
    key === 'ok' ? (m.owned ? 'Use it' : 'Worth it')
    : key === 'warn' ? 'Close call'
    : (m.owned ? 'Not worth the power' : 'Skip');
  if (m.st < 2500 && key !== 'bad') { key = 'warn'; label = 'Cheap but slow'; }
  return { key, label, ratio };
}

/** Evaluate the reference machine at the user's reference price (never treated as owned). */
export function evaluateReference(refMachine: Machine, a: Assumptions): Result {
  return evaluate({ ...refMachine, owned: false }, a, null, a.refPrice);
}

export interface StickOption {
  gb: number;
  /** Sticks bought in total, the same number on every CPU. */
  sticks: number;
  /** Whether that many sticks fit in each CPU's slots. */
  fits: boolean;
  cost: number;
}

/** What it costs to reach `ram` GB with each stick size, filling every CPU evenly. */
export function stickOptions(ram: number, cpus: number, slotsPerCpu: number, prices: Record<number, number>): StickOption[] {
  return Object.entries(prices).map(([g, price]) => {
    const gb = Number(g);
    const perCpu = Math.ceil(ram / cpus / gb);
    return { gb, sticks: perCpu * cpus, fits: perCpu <= slotsPerCpu, cost: perCpu * cpus * price };
  });
}
