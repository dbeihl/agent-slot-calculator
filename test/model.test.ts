/**
 * Parity tests: the TypeScript model must reproduce the prototype's numbers.
 * Expected values in test-vectors.json were generated from the MODEL block of
 * prototype/agent-slot-calculator.html. Do not regenerate them to make a failing
 * test pass; fix the port instead.
 */
import { describe, expect, it } from 'vitest';
import { evaluate, evaluateReference, judge, stickOptions, type Assumptions, type Machine } from '../src/lib/model';
import { DEFAULTS, PRESETS, REFERENCE_ID } from '../src/data/presets';
import vectors from './test-vectors.json';

const r2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const refMachine = PRESETS.find((p) => p.id === REFERENCE_ID)!;

describe('defaults', () => {
  it('match the prototype', () => {
    expect(DEFAULTS).toEqual(vectors.defaults);
  });
});

describe('model parity with the prototype', () => {
  for (const c of vectors.cases) {
    it(c.label, () => {
      const base = PRESETS.find((p) => p.id === c.machineId)!;
      const machine: Machine = { ...base, owned: c.overrides.owned };
      const a = c.assumptions as Assumptions;
      const r = evaluate(machine, a, c.overrides.ramOverride, c.overrides.priceOverride);
      const v = judge(r, evaluateReference(refMachine, a), machine);
      expect({
        n: r.n, limit: r.limit, pEff: r2(r.pEff), q95: r.q95, q99: r.q99,
        hwPer: r2(r.hwPer), lifePer: r2(r.lifePer), powerYr: r2(r.powerYr),
        verdictKey: v.key, verdictLabel: v.label, ratio: r2(v.ratio),
      }).toEqual(c.expected);
    });
  }
});

describe('multiple CPUs', () => {
  it('add 80% of the multi-thread score for each CPU beyond the first', () => {
    const base = PRESETS.find((p) => p.id === 'ser9')!;
    const two = evaluate({ ...base, cpus: 2 }, DEFAULTS);
    expect(two).toEqual(evaluate({ ...base, mt: base.mt * 1.8 }, DEFAULTS));
    expect(two.cpuFitBuilds).toBeCloseTo(evaluate(base, DEFAULTS).cpuFitBuilds * 1.8);
  });
});

describe('RAM stick options', () => {
  it('price each stick size and check it fits the slots', () => {
    // 128 GB on 2 CPUs with 4 slots each: 16 GB sticks need 4 per CPU, 64 GB sticks need 1.
    expect(stickOptions(128, 2, 4, { 16: 100, 64: 500 })).toEqual([
      { gb: 16, sticks: 8, fits: true, cost: 800 },
      { gb: 64, sticks: 2, fits: true, cost: 1000 },
    ]);
    // 2 slots per CPU: 16 GB sticks don't fit; odd splits round up per CPU.
    expect(stickOptions(96, 2, 2, { 16: 100, 32: 200 })).toEqual([
      { gb: 16, sticks: 6, fits: false, cost: 600 },
      { gb: 32, sticks: 4, fits: true, cost: 800 },
    ]);
  });
});
