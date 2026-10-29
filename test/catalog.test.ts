/**
 * The machine catalog: processor and listing data must be complete and sourced,
 * report presets must pass through unchanged, and the power estimate used for
 * market listings must stay close to the report's own figures.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG, CPUS, LISTINGS, estimatePower, findCpu, resolveListing, type Cpu, type Form } from '../src/data/catalog';
import { PRESETS } from '../src/data/presets';

describe('processor data', () => {
  it('has unique ids and both PassMark scores with a source for every row', () => {
    expect(new Set(CPUS.map((c) => c.id)).size).toBe(CPUS.length);
    for (const c of CPUS) {
      expect(c.st, c.name).toBeGreaterThan(500);
      expect(c.mt, c.name).toBeGreaterThan(c.st);
      // PassMark's own figures, or the report's labelled estimate for chips PassMark under-rates.
      if (c.estimated) expect(c.source, c.name).toBe('docs/research-report.md');
      else expect(c.source, c.name).toMatch(/cpubenchmark\.net/);
      expect(c.seen, c.name).toMatch(/^20\d\d-\d\d/);
    }
  });
});

describe('listing data', () => {
  it('names a known processor, a positive price and a source for every listing', () => {
    expect(new Set(LISTINGS.map((l) => l.id)).size).toBe(LISTINGS.length);
    for (const l of LISTINGS) {
      expect(findCpu(l.cpu), l.id + ' cpu ' + l.cpu).toBeDefined();
      expect(l.price, l.id).toBeGreaterThan(0);
      expect(l.ram, l.id).toBeGreaterThan(0);
      expect(l.source, l.id).toMatch(/^https:\/\//);
    }
  });

  it('never collides with a report preset id', () => {
    const presetIds = new Set(PRESETS.map((p) => p.id));
    for (const l of LISTINGS) expect(presetIds.has(l.id), l.id).toBe(false);
  });
});

describe('catalog', () => {
  it('carries every report preset through unchanged', () => {
    for (const p of PRESETS) {
      const e = CATALOG.find((x) => x.machine.id === p.id)!;
      expect(e.origin).toBe('report');
      expect(e.machine).toEqual({ ...p, owned: !!p.owned });
    }
  });

  it('resolves a listing from its processor, with measured power winning over the estimate', () => {
    const cpu = CPUS.find((c) => c.vendor === 'Intel')!;
    const base = { id: 't', name: 'Test box', cpu: cpu.id, ram: 64, price: 900, condition: 'used' as const, form: 'tower' as const, source: 'https://example.com', seen: '2026-10' };
    const est = resolveListing(base)!;
    expect(est.machine).toMatchObject({ st: cpu.st, mt: cpu.mt, ram: 64, price: 900, reserve: 6 });
    expect(est.powerEstimated).toBe(true);
    const measured = resolveListing({ ...base, idleW: 20, loadW: 150 })!;
    expect(measured.machine).toMatchObject({ idle: 20, load: 150 });
    expect(measured.powerEstimated).toBe(false);
    expect(resolveListing({ ...base, cpu: 'no-such-cpu' })).toBeNull();
  });
});

describe('power estimate', () => {
  // Report presets with a known processor TDP: [form, tdp, segment, report load watts].
  const cases: [string, Form, number, Cpu['segment'], number][] = [
    ['i5-8500T mini', 'mini', 35, 'desktop-T', 65],
    ['8845HS mini', 'mini', 45, 'mobile', 78],
    ['5950X desktop', 'tower', 105, 'desktop', 225],
    ['270K Plus desktop', 'tower', 125, 'desktop', 252],
    ['9950X desktop', 'tower', 170, 'desktop', 300],
    ['EPYC 7B13 server', 'server', 225, 'server', 350],
    ['Threadripper 9980X', 'workstation', 350, 'hedt', 534],
  ];
  for (const [label, form, tdpW, segment, load] of cases) {
    it(`stays within 15% of the report's load watts for ${label}`, () => {
      const cpu: Cpu = { id: 'x', name: label, vendor: 'AMD', segment, cores: null, threads: null, tdpW, st: 1, mt: 2, source: '', seen: '' };
      expect(Math.abs(estimatePower(cpu, form).load - load) / load).toBeLessThan(0.15);
    });
  }
});
