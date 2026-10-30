/**
 * Strategy selection: what to buy given where you are, not just what is
 * cheapest per agent. Pure functions over the model and the catalog, no DOM.
 *
 * Each strategy searches small fleets (multisets of catalog machines, up to
 * `maxBoxes`) under its own constraints and objective:
 * - cash: only the cash you have; fewest dollars over the machines' life.
 * - finance: borrow what cash doesn't cover; lifetime cost including interest.
 * - stages: buy upgradeable machines now, add memory later.
 * - monthly: smallest monthly bill (power plus any loan payment).
 * A fleet that reaches the target agent count always beats one that doesn't.
 * When none can, cash-only and staged buying take the most agents, and the
 * monthly strategy the lowest monthly cost per agent. Boxes don't pool their
 * capacity, so a fleet's agents are the sum of each box's.
 */
import { evaluate, type Assumptions } from './model';
import type { CatalogEntry } from '../data/catalog';
import { fmt$ } from './format';

export interface Situation {
  /** Cash available up front, USD. */
  cash: number;
  /** Agents wanted in total. */
  target: number;
  /** Willing to borrow what cash doesn't cover. */
  finance: boolean;
  /** Annual percentage rate, in percent. */
  apr: number;
  termMonths: number;
  /** Ceiling on power plus loan payments per month; null for none. */
  monthlyCap: number | null;
  usedOk: boolean;
  serversOk: boolean;
  maxBoxes: number;
}

export const DEFAULT_SITUATION: Situation = {
  cash: 3000, target: 20, finance: false, apr: 12, termMonths: 36, monthlyCap: null, usedOk: true, serversOk: true, maxBoxes: 6,
};
export const MAX_BOXES = 8;

/** One machine as a fleet building block. For a staged option, `price` is today's spend and `later` the memory upgrade. */
export interface FleetOption {
  id: string;
  entry: CatalogEntry;
  price: number;
  later: number;
  agentsNow: number;
  agents: number;
  powerYr: number;
  st: number;
  /** RAM after the staged upgrade, when there is one. */
  upGB?: number;
}

export interface Fleet {
  boxes: { option: FleetOption; count: number }[];
  boxCount: number;
  purchase: number;
  later: number;
  agentsNow: number;
  agents: number;
  powerYr: number;
  financed: number;
  payment: number;
  interest: number;
  /** Power per month plus the loan payment while it runs. */
  monthly: number;
  /** Purchase + later upgrades + years of power + interest. */
  lifetime: number;
  perAgent: number;
  meetsTarget: boolean;
}

export type StrategyKey = 'cash' | 'finance' | 'stages' | 'monthly';

export interface Strategy {
  key: StrategyKey;
  title: string;
  goal: string;
  fleet: Fleet | null;
  /** Why there is no fleet, when there isn't one. */
  unavailable?: string;
  /** Another strategy that picked the same fleet. */
  sameAs?: StrategyKey;
}

/** Fixed monthly payment for an amortized loan. */
export function loanPayment(principal: number, aprPercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPercent / 100 / 12;
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
}

function eligible(e: CatalogEntry, s: Situation) {
  if (e.condition === 'owned') return false;
  if (!s.usedOk && (e.condition === 'used' || e.condition === 'refurbished')) return false;
  return s.serversOk || e.form !== 'server';
}

export function buyOptions(entries: CatalogEntry[], a: Assumptions, s: Situation): FleetOption[] {
  return entries.filter((e) => eligible(e, s)).flatMap((e) => {
    const r = evaluate(e.machine, a);
    if (r.n === 0) return [];
    return [{ id: e.machine.id || 'custom', entry: e, price: e.machine.price, later: 0, agentsNow: r.n, agents: r.n, powerYr: r.powerYr, st: e.machine.st }];
  });
}

/** Machines that hold at least one agent now and more after their listed memory upgrade. */
export function stagedOptions(entries: CatalogEntry[], a: Assumptions, s: Situation): FleetOption[] {
  return entries.filter((e) => eligible(e, s)).flatMap((e) => {
    const m = e.machine;
    if (!m.upGB || m.upGB <= m.ram || !m.upCost || m.upCost <= 0) return [];
    const now = evaluate(m, a);
    const after = evaluate(m, a, m.upGB, m.price + m.upCost);
    if (now.n === 0 || after.n <= now.n) return [];
    return [{ id: m.id || 'custom', entry: e, price: m.price, later: m.upCost, agentsNow: now.n, agents: after.n, powerYr: after.powerYr, st: m.st, upGB: m.upGB }];
  });
}

/** Drop options another option beats or ties on every count: price, later spend, agents now and after, power. */
export function prune(options: FleetOption[]): FleetOption[] {
  const better = (b: FleetOption, x: FleetOption) =>
    b.price <= x.price && b.later <= x.later && b.agents >= x.agents && b.agentsNow >= x.agentsNow && b.powerYr <= x.powerYr;
  return options.filter((x, i) => !options.some((b, j) => j !== i && better(b, x) && (!better(x, b) || j < i)));
}

interface Constraints { cash: number; finance: boolean; apr: number; termMonths: number; monthlyCap: number | null; target: number; years: number; maxBoxes: number }

function summarize(picks: number[], options: FleetOption[], c: Constraints): Fleet {
  const counts = new Map<number, number>();
  picks.forEach((i) => counts.set(i, (counts.get(i) || 0) + 1));
  const boxes = [...counts].map(([i, count]) => ({ option: options[i], count }));
  const sum = (f: (o: FleetOption) => number) => boxes.reduce((t, b) => t + f(b.option) * b.count, 0);
  const purchase = sum((o) => o.price), later = sum((o) => o.later), powerYr = sum((o) => o.powerYr);
  const agents = sum((o) => o.agents), agentsNow = sum((o) => o.agentsNow);
  const financed = c.finance ? Math.max(0, purchase - c.cash) : 0;
  const payment = loanPayment(financed, c.apr, c.termMonths);
  const interest = payment * c.termMonths - financed;
  const lifetime = purchase + later + c.years * powerYr + interest;
  return {
    boxes, boxCount: picks.length, purchase, later, agentsNow, agents, powerYr, financed, payment, interest,
    monthly: powerYr / 12 + payment, lifetime, perAgent: lifetime / agents, meetsTarget: agents >= c.target,
  };
}

/**
 * Search fleets of up to `maxBoxes` boxes and keep the best by `cost`, among
 * those within cash (or financed) and the monthly cap. Reaching the target
 * comes first. Short of it, `whenShort` decides: more agents, or lower cost
 * per agent. Ties go to lower cost, then fewer boxes.
 */
function bestFleet(options: FleetOption[], c: Constraints, cost: (f: Fleet) => number, whenShort: 'agents' | 'per-agent' = 'agents'): Fleet | null {
  const sorted = [...options].sort((x, y) => x.price - y.price);
  const limit = c.finance ? Infinity : c.cash;
  let best: Fleet | null = null;
  const beats = (f: Fleet, b: Fleet) => {
    if (f.meetsTarget !== b.meetsTarget) return f.meetsTarget;
    if (!f.meetsTarget && whenShort === 'agents' && f.agents !== b.agents) return f.agents > b.agents;
    const cf = !f.meetsTarget && whenShort === 'per-agent' ? cost(f) / f.agents : cost(f);
    const cb = !b.meetsTarget && whenShort === 'per-agent' ? cost(b) / b.agents : cost(b);
    return cf !== cb ? cf < cb : f.boxCount < b.boxCount;
  };
  const picks: number[] = [];
  const walk = (from: number, price: number, agents: number) => {
    for (let i = from; i < sorted.length; i++) {
      const p = price + sorted[i].price;
      if (p > limit) break; // sorted by price, so every later option is over too
      picks.push(i);
      const f = summarize(picks, sorted, c);
      if (c.monthlyCap == null || f.monthly <= c.monthlyCap + 1e-9) {
        if (!best || beats(f, best)) best = f;
      }
      // Past the target, another box only adds cost.
      if (agents + sorted[i].agents < c.target && picks.length < c.maxBoxes) walk(i, p, agents + sorted[i].agents);
      picks.pop();
    }
  };
  walk(0, 0, 0);
  return best;
}

const signature = (f: Fleet) => f.boxes.map((b) => b.option.id + '×' + b.count).sort().join(',');

export function planStrategies(entries: CatalogEntry[], a: Assumptions, s: Situation): { strategies: Strategy[]; recommended: StrategyKey | null } {
  const base = prune(buyOptions(entries, a, s));
  const staged = prune(stagedOptions(entries, a, s));
  const maxBoxes = Math.max(1, Math.min(MAX_BOXES, Math.round(s.maxBoxes)));
  const c: Constraints = { cash: Math.max(0, s.cash), finance: false, apr: s.apr, termMonths: s.termMonths, monthlyCap: s.monthlyCap, target: Math.max(1, Math.round(s.target)), years: a.years, maxBoxes };
  const lifetime = (f: Fleet) => f.lifetime;
  const noFleet = 'Nothing in the catalog fits these limits.';

  const strategies: Strategy[] = [
    { key: 'cash', title: 'Cash only', goal: 'The most you can do with the cash you have, at the lowest cost over its life.', fleet: bestFleet(base, c, lifetime) },
    s.finance
      ? { key: 'finance', title: 'Finance the rest', goal: 'Borrow what your cash doesn’t cover and pay the least over the machines’ life, interest included.', fleet: bestFleet(base, { ...c, finance: true }, lifetime) }
      : { key: 'finance', title: 'Finance the rest', goal: 'Borrow what your cash doesn’t cover and pay the least over the machines’ life, interest included.', fleet: null, unavailable: 'Turn on financing above to compare it.' },
    staged.length
      ? { key: 'stages', title: 'Grow in stages', goal: 'Buy machines you can add memory to, run what they hold now, and upgrade later.', fleet: bestFleet(staged, c, lifetime) }
      : { key: 'stages', title: 'Grow in stages', goal: 'Buy machines you can add memory to, run what they hold now, and upgrade later.', fleet: null, unavailable: 'No machine with a listed memory upgrade fits these limits.' },
    { key: 'monthly', title: 'Lowest monthly bill', goal: 'The smallest monthly cost for power plus any loan payment.', fleet: bestFleet(base, { ...c, finance: s.finance }, (f) => f.monthly, 'per-agent') },
  ];
  strategies.forEach((st) => { if (!st.fleet && !st.unavailable) st.unavailable = noFleet; });

  const seen = new Map<string, StrategyKey>();
  strategies.forEach((st) => {
    if (!st.fleet) return;
    const sig = signature(st.fleet) + (st.fleet.financed > 0 ? '+loan' : '');
    if (seen.has(sig)) st.sameAs = seen.get(sig); else seen.set(sig, st.key);
  });

  // Recommend the lowest lifetime cost among strategies that reach the target; when none
  // does, the lowest lifetime cost per agent, rather than more agents bought on running costs.
  const withFleet = strategies.filter((st) => st.fleet);
  const rank = (x: Strategy, y: Strategy) => {
    const f = x.fleet!, g = y.fleet!;
    if (f.meetsTarget !== g.meetsTarget) return f.meetsTarget ? -1 : 1;
    return f.meetsTarget ? f.lifetime - g.lifetime : f.perAgent - g.perAgent;
  };
  const recommended = withFleet.length ? [...withFleet].sort(rank)[0].key : null;
  return { strategies, recommended };
}

/** Plain-language caveats for a fleet, from the data behind each machine. */
export function fleetCaveats(f: Fleet): string[] {
  const out: string[] = [];
  const any = (p: (o: FleetOption) => boolean) => f.boxes.some((b) => p(b.option));
  if (any((o) => o.entry.form === 'server')) out.push('Rack servers are loud and power-hungry; plan for a garage, closet or rack.');
  if (any((o) => o.st < 2500)) out.push('Slow cores: builds run noticeably slower than on a current desktop.');
  if (any((o) => o.entry.condition === 'used' || o.entry.condition === 'refurbished')) out.push('Used machines: check condition and warranty; listed prices are asking prices.');
  if (any((o) => o.entry.powerEstimated)) out.push('Some power figures are estimates, so the power share of the cost is approximate.');
  if (f.boxCount === 1 && f.agents > 1) out.push('One box: if it fails, every agent stops.');
  if (f.later > 0) out.push('Reaches its full count only after the memory upgrade.');
  if (f.financed > 0 && f.interest > 0) out.push(`The loan adds ${fmt$(f.interest)} of interest, about ${fmt$(f.interest / f.agents)} per agent.`);
  return out;
}
