/**
 * The machine catalog: the report's 23 presets, Aaron's own machines (_AB) and market listings.
 *
 * Market data is split in two so a new machine is one short record:
 * - `cpus.json`: one row per processor with its PassMark scores and source.
 * - `listings.json`: one row per priced machine: processor, memory, price, source.
 * `market-prices.json` is written by `scripts/refresh-prices.mjs` and, when it
 * has a fresh eBay median for a listing, replaces that listing's price.
 *
 * The report's presets in `presets.ts` stay exactly as the report gave them
 * (the _AB entries are Aaron's own machines with PassMark sources); the
 * catalog only adds metadata (condition, form, provenance) around them.
 */
import type { Machine } from '../lib/model';
import { PRESETS } from './presets';
import cpuRows from './cpus.json' with { type: 'json' };
import listingRows from './listings.json' with { type: 'json' };
import marketPrices from './market-prices.json' with { type: 'json' };

export type Condition = 'new' | 'used' | 'refurbished' | 'owned';
export type Form = 'mini' | 'sff' | 'tower' | 'workstation' | 'server' | 'mac';
export type Origin = 'report' | 'market' | 'yours';
/** How the price was set: a report estimate, a store's list price, a used asking price, or eBay's median ask. */
export type PriceKind = 'report' | 'list' | 'asking' | 'ebay' | 'yours' | 'owned';

export interface Cpu {
  id: string;
  name: string;
  vendor: 'Intel' | 'AMD' | 'Apple';
  segment: 'desktop' | 'desktop-T' | 'mobile' | 'server' | 'hedt' | 'apple';
  cores: number | null;
  threads: number | null;
  tdpW: number | null;
  /** PassMark single-thread rating. */
  st: number;
  /** PassMark CPU Mark. */
  mt: number;
  /** PassMark CPU Mark for a dual-socket system, when PassMark lists one. */
  mtDual?: number | null;
  /** Scores are the report's estimate in PassMark terms (Apple chips), not PassMark's own figures. */
  estimated?: boolean;
  source: string;
  seen: string;
}

export interface Listing {
  id: string;
  name: string;
  /** A `Cpu.id`. */
  cpu: string;
  sockets?: 1 | 2;
  ram: number;
  maxRam?: number | null;
  ramSoldered?: boolean;
  price: number;
  condition: Exclude<Condition, 'owned'>;
  form: Form;
  /** Measured wall watts, when a cited review measured them. */
  idleW?: number | null;
  loadW?: number | null;
  powerSource?: string | null;
  source: string;
  seen: string;
  notes?: string;
  /** eBay search the price refresh runs for this listing. */
  ebayQuery?: string;
}

export interface CatalogEntry {
  machine: Machine;
  condition: Condition;
  form: Form;
  origin: Origin;
  priceKind: PriceKind;
  /** Power figures are an estimate rather than a measurement. */
  powerEstimated: boolean;
  /** A score is estimated (a dual-socket CPU Mark without PassMark's own figure). */
  scoreEstimated: boolean;
  source?: string;
  seen?: string;
}

export interface MarketPrice {
  median: number;
  count: number;
  low: number;
  high: number;
  fetched: string;
  sample?: string;
}

export const CPUS = cpuRows as Cpu[];
export const LISTINGS = listingRows as Listing[];
const MARKET = (marketPrices as { prices: Record<string, MarketPrice> }).prices;

const cpuById = new Map(CPUS.map((c) => [c.id, c]));
export const findCpu = (id: string) => cpuById.get(id);

/** Report presets: condition and form from the report's scorecard; power marked estimated where the report says so. The _AB entries are Aaron's own machines, sourced per entry through `source`. */
const REPORT_META: Record<string, { condition: Condition; form: Form; powerEstimated?: boolean; source?: string }> = {
  m920q: { condition: 'used', form: 'mini', powerEstimated: true },
  m720q: { condition: 'used', form: 'mini', powerEstimated: true },
  t10500: { condition: 'used', form: 'mini' },
  t12500: { condition: 'used', form: 'mini', powerEstimated: true },
  ser8: { condition: 'new', form: 'mini' },
  ser9: { condition: 'new', form: 'mini' },
  evox2: { condition: 'new', form: 'mini' },
  '5950x': { condition: 'used', form: 'tower', powerEstimated: true },
  '270k64': { condition: 'new', form: 'tower' },
  '270k128': { condition: 'new', form: 'tower' },
  '9950x64': { condition: 'new', form: 'tower', powerEstimated: true },
  '9950x128': { condition: 'new', form: 'tower', powerEstimated: true },
  '9950x192': { condition: 'new', form: 'tower', powerEstimated: true },
  epyc: { condition: 'used', form: 'server', powerEstimated: true },
  tr9970: { condition: 'new', form: 'workstation' },
  tr9980: { condition: 'new', form: 'workstation' },
  tr9980b: { condition: 'new', form: 'workstation' },
  m6: { condition: 'new', form: 'mac' },
  m5pro: { condition: 'new', form: 'mac' },
  m5max: { condition: 'new', form: 'mac' },
  mbp: { condition: 'owned', form: 'mac', powerEstimated: true },
  imac: { condition: 'owned', form: 'mac' },
  xeon: { condition: 'owned', form: 'server', powerEstimated: true },
  // Aaron's own machines (_AB): specs from his fleet roster, scores from PassMark, power from estimatePower.
  'ab-pve': { condition: 'owned', form: 'tower', powerEstimated: true, source: 'https://www.cpubenchmark.net/cpu.php?id=6296' },
  'ab-base-desk': { condition: 'owned', form: 'tower', powerEstimated: true, source: 'https://www.cpubenchmark.net/cpu.php?id=3869' },
  'ab-pve-shop': { condition: 'owned', form: 'tower', powerEstimated: true, source: 'https://www.cpubenchmark.net/cpu.php?id=4325' },
  'ab-shop-desk': { condition: 'owned', form: 'mini', powerEstimated: true, source: 'https://www.cpubenchmark.net/compare/3995vs3922/Intel-Core-i3-1125G4-vs-Intel-Core-i5-1145G7' },
  'ab-hp640': { condition: 'owned', form: 'mini', powerEstimated: true, source: 'https://cpubenchmark.net/compare/5825vs4794/Intel-Core-Ultra-7-165U-vs-Intel-Core-i7-1255U' },
  'ab-yoga9': { condition: 'owned', form: 'mini', powerEstimated: true, source: 'https://www.cpubenchmark.net/compare/Intel-i7-7500U-vs-Intel-i7-8550U/2863vs3064' },
  'ab-pve-tiny': { condition: 'owned', form: 'mini', powerEstimated: true, source: 'https://www.cpubenchmark.net/cpu.php?id=2041' },
};

/**
 * Wall-power estimate when no review measured the machine: idle by form, and
 * load = base + 1.3 × the processor's TDP. Calibrated on the report's presets,
 * whose load figures it reproduces within about 15% (see test/catalog.test.ts).
 */
export function estimatePower(cpu: Cpu, form: Form, sockets: 1 | 2 = 1): { idle: number; load: number } {
  if (cpu.vendor === 'Apple') {
    // The report's Apple figures by tier: base 4/70, Pro 6/145, Max 7/200, Ultra about 10/295.
    const tier = /Ultra/.test(cpu.name) ? [10, 295] : /Max/.test(cpu.name) ? [7, 200] : /Pro/.test(cpu.name) ? [6, 145] : [4, 70];
    return { idle: tier[0], load: tier[1] };
  }
  let tdp = cpu.tdpW ?? (cpu.segment === 'mobile' || cpu.segment === 'desktop-T' ? 35 : 125);
  // Mini PCs run mobile chips above their nominal TDP; Ryzen AI Max boxes ship at about 120 W.
  if (cpu.segment === 'mobile') tdp = /AI Max/.test(cpu.name) ? Math.max(tdp, 120) : Math.max(tdp, 45);
  tdp *= sockets;
  const idle = { mini: 10, sff: 25, tower: 70, workstation: 90, server: 110, mac: 6 }[form] * (sockets === 2 ? 1.5 : 1);
  const base = form === 'mini' ? 20 : 90;
  return { idle: Math.round(idle), load: Math.round(base + 1.3 * tdp) };
}

export function resolveListing(l: Listing): CatalogEntry | null {
  const cpu = findCpu(l.cpu);
  if (!cpu) return null;
  const sockets = l.sockets ?? 1;
  const measured = l.idleW != null && l.loadW != null;
  const est = estimatePower(cpu, l.form, sockets);
  const dualMt = sockets === 2 ? (cpu.mtDual ?? null) : null;
  const market = MARKET[l.id];
  const machine: Machine = {
    id: l.id,
    group: 'Market',
    name: l.name,
    price: market ? market.median : l.price,
    ram: l.ram,
    st: cpu.st,
    // Without PassMark's own dual-socket figure, assume the second socket adds 80%.
    mt: sockets === 2 ? Math.round(dualMt ?? cpu.mt * 1.8) : cpu.mt,
    idle: measured ? l.idleW! : est.idle,
    load: measured ? l.loadW! : est.load,
    reserve: l.form === 'mac' ? 8 : 6,
    upGB: 0,
    upCost: 0,
    note: l.notes,
  };
  return {
    machine,
    condition: l.condition,
    form: l.form,
    origin: 'market',
    priceKind: market ? 'ebay' : l.condition === 'new' ? 'list' : 'asking',
    powerEstimated: !measured,
    scoreEstimated: !!cpu.estimated || (sockets === 2 && dualMt == null),
    source: market?.sample || l.source,
    seen: market ? market.fetched.slice(0, 10) : l.seen,
  };
}

const reportEntries: CatalogEntry[] = PRESETS.map((p) => {
  const meta = REPORT_META[p.id!] ?? { condition: p.owned ? 'owned' : 'new', form: 'tower' };
  return {
    machine: { ...p, owned: !!p.owned },
    condition: meta.condition,
    form: meta.form,
    origin: 'report',
    priceKind: p.owned ? 'owned' : 'report',
    powerEstimated: !!meta.powerEstimated,
    scoreEstimated: meta.form === 'mac',
    source: meta.source ?? 'docs/research-report.md',
    seen: '2026-10',
  };
});

/** Every built-in machine: the report's presets first, then market listings. */
export const CATALOG: CatalogEntry[] = [
  ...reportEntries,
  ...LISTINGS.map(resolveListing).filter((e): e is CatalogEntry => e != null),
];

export const findEntry = (id: string, extra: CatalogEntry[] = []) => [...CATALOG, ...extra].find((e) => e.machine.id === id);

export const FORM_LABEL: Record<Form, string> = {
  mini: 'Mini PC', sff: 'Small desktop', tower: 'Desktop', workstation: 'Workstation', server: 'Server', mac: 'Mac',
};
