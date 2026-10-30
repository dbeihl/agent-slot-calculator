/**
 * Strategy selection: loan math, pruning, each strategy's constraints and
 * objective on a small synthetic catalog, and a run over the real catalog.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITUATION, buyOptions, fleetCaveats, loanPayment, planStrategies, prune, stagedOptions, type FleetOption, type Situation } from '../src/lib/strategy';
import { CATALOG, type CatalogEntry } from '../src/data/catalog';
import { DEFAULTS } from '../src/data/presets';
import { evaluate, type Machine } from '../src/lib/model';

const machine = (id: string, over: Partial<Machine>): Machine => ({
  id, name: id, price: 1000, ram: 64, st: 4500, mt: 60000, idle: 50, load: 200, reserve: 6, upGB: 0, upCost: 0, ...over,
});
const entry = (m: Machine, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  machine: m, condition: 'new', form: 'tower', origin: 'market', priceKind: 'list', powerEstimated: false, scoreEstimated: false, ...over,
});
const situation = (over: Partial<Situation>): Situation => ({ ...DEFAULT_SITUATION, ...over });
const agentsOf = (m: Machine) => evaluate(m, DEFAULTS).n;

// A cheap, power-hungry server; an efficient desktop; a small mini PC; an upgradeable desktop.
const server = entry(machine('server', { price: 1200, ram: 128, st: 2200, mt: 50000, idle: 160, load: 500 }), { condition: 'used', form: 'server' });
const desktop = entry(machine('desktop', { price: 3000, ram: 128, st: 5000, mt: 68000, idle: 77, load: 252 }));
const mini = entry(machine('mini', { price: 500, ram: 32, st: 3400, mt: 16000, idle: 10, load: 65 }), { condition: 'used', form: 'mini' });
const upgradeable = entry(machine('upgradeable', { price: 2000, ram: 64, st: 5000, mt: 68000, idle: 77, load: 252, upGB: 128, upCost: 930 }));
const catalog = [server, desktop, mini, upgradeable];

describe('loan payment', () => {
  it('amortizes principal and interest, and divides evenly at 0%', () => {
    expect(loanPayment(6000, 8, 36)).toBeCloseTo(188.02, 2);
    expect(loanPayment(3600, 0, 36)).toBe(100);
    expect(loanPayment(0, 12, 36)).toBe(0);
  });
});

describe('options', () => {
  it('drops owned machines and honours the used and server limits', () => {
    const owned = entry(machine('owned', { owned: true, price: 0 }), { condition: 'owned' });
    expect(buyOptions([...catalog, owned], DEFAULTS, situation({})).map((o) => o.id)).toEqual(['server', 'desktop', 'mini', 'upgradeable']);
    expect(buyOptions(catalog, DEFAULTS, situation({ usedOk: false })).map((o) => o.id)).toEqual(['desktop', 'upgradeable']);
    expect(buyOptions(catalog, DEFAULTS, situation({ serversOk: false })).map((o) => o.id)).toEqual(['desktop', 'mini', 'upgradeable']);
  });

  it('stages only machines that hold an agent now and more after their upgrade', () => {
    const [o] = stagedOptions(catalog, DEFAULTS, situation({}));
    expect(o).toMatchObject({ id: 'upgradeable', price: 2000, later: 930, upGB: 128 });
    expect(o.agents).toBeGreaterThan(o.agentsNow);
  });

  it('prunes options beaten on price, agents and power, keeping one of identical twins', () => {
    const o = (id: string, price: number, agents: number, powerYr: number): FleetOption =>
      ({ id, entry: desktop, price, later: 0, agentsNow: agents, agents, powerYr, st: 5000 });
    expect(prune([o('a', 100, 2, 50), o('b', 120, 2, 60), o('c', 120, 3, 60), o('d', 100, 2, 50)]).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('strategies', () => {
  const target = agentsOf(desktop.machine) * 2;

  it('cash only stays within cash and reports the shortfall', () => {
    const { strategies } = planStrategies(catalog, DEFAULTS, situation({ cash: 2500, target }));
    const f = strategies.find((s) => s.key === 'cash')!.fleet!;
    expect(f.purchase).toBeLessThanOrEqual(2500);
    expect(f.meetsTarget).toBe(false);
    expect(f.financed).toBe(0);
  });

  it('financing reaches the target and counts interest in the lifetime cost', () => {
    const { strategies } = planStrategies(catalog, DEFAULTS, situation({ cash: 2500, target, finance: true, apr: 10, termMonths: 36 }));
    const f = strategies.find((s) => s.key === 'finance')!.fleet!;
    expect(f.meetsTarget).toBe(true);
    expect(f.financed).toBeCloseTo(f.purchase - 2500, 6);
    expect(f.interest).toBeGreaterThan(0);
    expect(f.lifetime).toBeCloseTo(f.purchase + DEFAULTS.years * f.powerYr + f.interest, 6);
  });

  it('finance is unavailable until it is turned on', () => {
    const s = planStrategies(catalog, DEFAULTS, situation({})).strategies.find((x) => x.key === 'finance')!;
    expect(s.fleet).toBeNull();
    expect(s.unavailable).toMatch(/Turn on financing/);
  });

  it('the monthly strategy picks the low-power fleet and respects the monthly cap', () => {
    const { strategies } = planStrategies(catalog, DEFAULTS, situation({ cash: 20000, target: agentsOf(server.machine) }));
    const monthly = strategies.find((s) => s.key === 'monthly')!.fleet!;
    expect(monthly.boxes.every((b) => b.option.id !== 'server')).toBe(true);
    const capped = planStrategies(catalog, DEFAULTS, situation({ cash: 20000, target, monthlyCap: 1 })).strategies;
    expect(capped.every((s) => s.fleet === null)).toBe(true);
  });

  it('grow in stages buys within cash now and adds the upgrade later', () => {
    const f = planStrategies(catalog, DEFAULTS, situation({ cash: 2000, target: 1 })).strategies.find((s) => s.key === 'stages')!.fleet!;
    expect(f.purchase).toBe(2000);
    expect(f.later).toBe(930);
    expect(f.agents).toBeGreaterThan(f.agentsNow);
  });

  it('never exceeds the box limit and marks strategies that chose the same fleet', () => {
    const { strategies } = planStrategies(catalog, DEFAULTS, situation({ cash: 100000, target: 500, maxBoxes: 3 }));
    for (const s of strategies) if (s.fleet) expect(s.fleet.boxCount).toBeLessThanOrEqual(3);
    const plan = planStrategies([desktop], DEFAULTS, situation({ cash: 10000, target: 1, usedOk: false }));
    expect(plan.strategies.find((s) => s.key === 'monthly')!.sameAs).toBe('cash');
  });

  it('recommends a strategy that reaches the target over one that does not', () => {
    const plan = planStrategies(catalog, DEFAULTS, situation({ cash: 2500, target, finance: true }));
    expect(plan.strategies.find((s) => s.key === plan.recommended)!.fleet!.meetsTarget).toBe(true);
  });

  it('lists caveats from the data behind each machine', () => {
    const f = planStrategies([server], DEFAULTS, situation({ cash: 1200, target: 1 })).strategies[0].fleet!;
    const text = fleetCaveats(f).join(' ');
    expect(text).toMatch(/Rack servers/);
    expect(text).toMatch(/Slow cores/);
    expect(text).toMatch(/Used machines/);
  });
});

describe('real catalog', () => {
  it('plans every strategy at the defaults quickly', () => {
    const t = performance.now();
    const plan = planStrategies(CATALOG, DEFAULTS, situation({ finance: true }));
    expect(performance.now() - t).toBeLessThan(2000);
    for (const s of plan.strategies) expect(s.fleet, s.key).not.toBeNull();
    expect(plan.recommended).not.toBeNull();
  });
});

describe('short of the target', () => {
  it('lets the monthly strategy favour low running cost per agent, and recommends the cheapest per agent', () => {
    const plan = planStrategies(catalog, DEFAULTS, situation({ cash: 2500, target: 500 }));
    const cash = plan.strategies.find((s) => s.key === 'cash')!.fleet!;
    const monthly = plan.strategies.find((s) => s.key === 'monthly')!.fleet!;
    expect(monthly.monthly / monthly.agents).toBeLessThanOrEqual(cash.monthly / cash.agents);
    const withFleet = plan.strategies.filter((s) => s.fleet);
    const rec = plan.strategies.find((s) => s.key === plan.recommended)!.fleet!;
    expect(rec.perAgent).toBe(Math.min(...withFleet.map((s) => s.fleet!.perAgent)));
  });
});
