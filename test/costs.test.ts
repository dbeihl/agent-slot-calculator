/**
 * The cost chart's data: totals, the per-agent identity the diagonals rely on,
 * filters, the best-at-this-budget frontier, and the log-axis helpers.
 */
import { describe, expect, it } from 'vitest';
import { applyFilters, cheapestPerAgent, costPoints, frontier, logDomain, logTicks, NO_FILTERS } from '../src/lib/costs';
import { CATALOG } from '../src/data/catalog';
import { DEFAULTS, REFERENCE_ID } from '../src/data/presets';

const report = CATALOG.filter((e) => e.origin === 'report');
const points = costPoints(report, DEFAULTS);
const byId = (id: string) => points.find((p) => p.id === id)!;

describe('cost points', () => {
  it('total is purchase plus years of power, and per agent is total ÷ agents', () => {
    for (const p of points) {
      expect(p.total).toBeCloseTo(p.result.cost + DEFAULTS.years * p.result.powerYr, 9);
      if (p.result.n > 0) expect(p.perAgent).toBeCloseTo(p.total / p.result.n, 9);
      else expect(p.perAgent).toBe(Infinity);
    }
  });

  it('matches the calculator for the reference box', () => {
    expect(Math.round(byId(REFERENCE_ID).total)).toBe(4272);
    expect(Math.round(byId(REFERENCE_ID).perAgent)).toBe(305);
  });

  it('counts power only for owned machines', () => {
    expect(byId('mbp').result.cost).toBe(0);
    expect(byId('mbp').total).toBeCloseTo(DEFAULTS.years * byId('mbp').result.powerYr, 9);
  });
});

describe('frontier', () => {
  it('marks the purchases nothing cheaper beats per agent, and never owned or empty boxes', () => {
    const f = frontier(points);
    expect([...f]).toEqual(['m720q', 'ser8', '5950x', '270k128']);
    const buyable = points.filter((p) => p.entry.condition !== 'owned' && p.result.n > 0);
    for (const p of points.filter((q) => f.has(q.id))) {
      expect(buyable.some((q) => q.total < p.total && q.perAgent <= p.perAgent)).toBe(false);
    }
  });

  it('finds the cheapest per agent among purchases only', () => {
    expect(Math.round(cheapestPerAgent(points))).toBe(305);
    expect(cheapestPerAgent([])).toBe(Infinity);
  });
});

describe('filters', () => {
  it('keeps everything with no filters', () => {
    expect(applyFilters(points, NO_FILTERS)).toHaveLength(points.length);
  });

  it('filters by condition, type, memory, budget and ownership', () => {
    const ids = (f: Partial<typeof NO_FILTERS>) => applyFilters(points, { ...NO_FILTERS, ...f }).map((p) => p.id);
    expect(ids({ condition: 'used', owned: false })).toEqual(['m920q', 'm720q', 't10500', 't12500', '5950x', 'epyc']);
    expect(ids({ form: 'mac', owned: false })).toEqual(['m6', 'm5pro', 'm5max']);
    expect(ids({ minRam: 192 })).toEqual(['9950x192', 'epyc', 'tr9980b']);
    expect(ids({ maxTotal: 1000 })).toEqual(['m920q', 'm720q', 't10500', 't12500', 'ab-pve-shop', 'ab-shop-desk', 'ab-hp640', 'ab-yoga9', 'ab-pve-tiny', 'mbp', 'imac']);
    expect(ids({ owned: false })).not.toContain('mbp');
  });
});

describe('log axis helpers', () => {
  it('pads the domain and snaps outward to 1-2-3-5 steps', () => {
    expect(logDomain(436, 17156)).toEqual([300, 30000]);
    expect(logDomain(305, 1548)).toEqual([200, 2000]);
  });

  it('lists ticks inside the domain only', () => {
    expect(logTicks(300, 3000)).toEqual([300, 500, 1000, 2000, 3000]);
  });
});
