import { describe, expect, it } from 'vitest';
import { checkFit, layout } from '../src/lib/build/layout';
import { buildTotal, buildWarnings, BUNDLE_PRICE, chosen, DEFAULT_CONFIG, partPrice, SLOTS, withChassis, type Config } from '../src/data/build';
import { defaultSettings } from '../src/lib/settings';
import listings from '../src/data/listings.json' with { type: 'json' };

const rosewill: Config = withChassis(DEFAULT_CONFIG, 'rosewill');

describe('build layout', () => {
  for (const [name, config] of [['RackChoice', DEFAULT_CONFIG], ['Rosewill', rosewill]] as const) {
    const boxes = layout(config);
    const fit = checkFit(boxes, config);

    it(`${name}: draws every chosen part`, () => {
      const drawn = new Set(boxes.map((b) => b.part));
      for (const { slot } of chosen(config)) expect(drawn, slot.id).toContain(slot.id);
    });

    it(`${name}: keeps solid parts inside the chassis and apart from each other`, () => {
      expect(fit.outside).toEqual([]);
      expect(fit.overlaps).toEqual([]);
    });

    it(`${name}: leaves room between the GPU and the fans ahead of it`, () => {
      const gap = fit.gaps.find((g) => g.label.startsWith('GPU end'))!;
      expect(gap.mm).toBeGreaterThan(0);
    });
  }

  it('Rosewill leaves room for its listed 330 mm card limit', () => {
    const longest = checkFit(layout(rosewill), rosewill).gaps.find((g) => g.label.startsWith('Longest card'))!;
    expect(longest.mm).toBeGreaterThanOrEqual(330);
  });

  it('RackChoice is the default, and a chassis sets its parts and leaves the rest alone', () => {
    expect(DEFAULT_CONFIG).toMatchObject({ chassis: 'rackchoice', psu: 'sf1000', 'fans-rear': 'nf-a6x25', 'fans-bracket': null });
    expect(rosewill).toEqual({ ...DEFAULT_CONFIG, chassis: 'rosewill', psu: 'gx750', 'fans-rear': 'p8', 'fans-bracket': 'p12-bracket' });
    expect(withChassis(rosewill, 'rackchoice')).toEqual(DEFAULT_CONFIG);
  });

  it('draws the Rosewill’s 80 mm rear fans, either brand, clear of everything', () => {
    for (const fan of ['p8', 'nf-r8']) {
      const c = { ...rosewill, 'fans-rear': fan };
      const boxes = layout(c);
      const rear = boxes.filter((b) => b.part === 'fans-rear');
      expect(rear).toHaveLength(2);
      expect(rear[0].max[0] - rear[0].min[0]).toBe(80);
      expect(rear[1].min[0]).toBeGreaterThanOrEqual(rear[0].max[0]);
      expect(checkFit(boxes, c).overlaps).toEqual([]);
      expect(checkFit(boxes, c).outside).toEqual([]);
    }
  });

  it('Rosewill runs its crossbars between the walls, so their ends stay off the outer face', () => {
    const boxes = layout(rosewill);
    const byId = (id: string) => boxes.find((b) => b.id === id)!;
    for (const id of ['bar-mid', 'bar-wall']) {
      const bar = byId(id);
      expect(bar.min[0], id).toBe(byId('wall-l').max[0]);
      expect(bar.max[0], id).toBe(byId('wall-r').min[0]);
    }
  });

  it('Rosewill stacks fans, radiator and fans at the front, then the bracket fans, then the board', () => {
    const boxes = layout(rosewill);
    const z = (id: string) => boxes.find((b) => b.id === id)!;
    expect(z('push-0').max[2]).toBeGreaterThan(z('radiator').max[2]);
    expect(z('radiator').min[2]).toBeGreaterThanOrEqual(z('pull-0').max[2]);
    expect(z('pull-0').min[2]).toBeGreaterThan(z('bracket-0').max[2]);
    expect(z('bracket-0').min[2]).toBeGreaterThan(z('gpu').max[2]);
    expect(layout(DEFAULT_CONFIG).some((b) => b.part === 'fans-bracket')).toBe(false);
  });

  it('warns only when there is no GPU and the CPU has no integrated graphics', () => {
    const kf = { ...DEFAULT_CONFIG, cpu: '250kf-plus' };
    expect(buildWarnings(DEFAULT_CONFIG)).toEqual([]);
    expect(buildWarnings({ ...DEFAULT_CONFIG, gpu: null })).toEqual([]);
    expect(buildWarnings(kf)).toEqual([]);
    expect(buildWarnings({ ...kf, gpu: null })[0]).toContain('no integrated graphics');
  });

  it('draws the shroud clear of everything but its card, and only with the card', () => {
    for (const config of [DEFAULT_CONFIG, rosewill]) {
      const shroud = layout(config).find((b) => b.part === 'nic-shroud')!;
      expect(shroud.max[2] - shroud.min[2]).toBe(190);
      const noCheck = layout(config).map((b) => (b.part === 'nic-shroud' ? { ...b, on: undefined } : b));
      expect(checkFit(noCheck, config).overlaps.filter((p) => p.includes('nic-shroud'))).toEqual([['nic', 'nic-shroud']]);
    }
    const noCard = { ...DEFAULT_CONFIG, nic: null };
    expect(layout(noCard).some((b) => b.part === 'nic-shroud')).toBe(false);
    expect(chosen(noCard).some((c) => c.slot.id === 'nic-shroud')).toBe(false);
  });

  it('fits every empty optional slot, and keeps its gaps honest with no GPU', () => {
    const bare = { ...DEFAULT_CONFIG, ...Object.fromEntries(SLOTS.filter((s) => s.optional).map((s) => [s.id, null])) };
    const boxes = layout(bare);
    const fit = checkFit(boxes, bare);
    expect(fit.outside).toEqual([]);
    expect(fit.overlaps).toEqual([]);
    expect(fit.gaps.some((g) => g.label.includes('GPU'))).toBe(false);
    for (const s of SLOTS.filter((x) => x.optional)) expect(boxes.some((b) => b.part === s.id), s.id).toBe(false);
    expect(boxes.filter((b) => b.id.startsWith('cover-'))).toHaveLength(8);
  });

  it('catches the ATX PSU that the 3U case can’t take, and fits it in the 4U', () => {
    const in3u = { ...DEFAULT_CONFIG, psu: 'gx750' };
    expect(checkFit(layout(in3u), in3u).outside).toEqual(['psu']);
    expect(checkFit(layout(rosewill), rosewill).outside).toEqual([]);
    expect(checkFit(layout(rosewill), rosewill).overlaps).toEqual([]);
  });
});

describe('build prices', () => {
  const s = defaultSettings();

  it('gives every part a link and a priced or explained line', () => {
    for (const slot of SLOTS) for (const p of slot.parts) {
      expect(p.url, p.id).toMatch(/^https:/);
      expect(p.priceNote, p.id).toBeTruthy();
      expect(partPrice(p, s), p.id).not.toBeNull();
      if (partPrice(p, s) === 0) expect(p.priceLabel, p.id).toBeTruthy();
    }
  });

  it('uses the listed Micro Center bundle price', () => {
    expect(listings.find((l) => l.id === 'mk-microcenter-270k-plus')!.build!.bundle).toBe(BUNDLE_PRICE);
  });

  it('totals the bundle and the 128 GB kit once, and follows the Settings prices', () => {
    const kit128 = buildTotal(DEFAULT_CONFIG, s).total;
    const stock = buildTotal({ ...DEFAULT_CONFIG, ram: 'bundle-kit' }, s).total;
    expect(kit128 - stock).toBeCloseTo(1852);
    const dearer = { ...s, ram: { ...s.ram, ddr5: { ...s.ram.ddr5, 64: 1000 } } };
    expect(buildTotal(DEFAULT_CONFIG, dearer).total - stock).toBeCloseTo(2000);
    const unpriced = { ...s, ram: { ...s.ram, ddr5: { ...s.ram.ddr5, 64: null } } };
    expect(buildTotal(DEFAULT_CONFIG, unpriced).total).toBeCloseTo(stock);
    expect(buildTotal(DEFAULT_CONFIG, unpriced).unpriced).toBe(1);
  });
});
