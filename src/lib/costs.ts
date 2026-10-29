/**
 * Data for the cost chart: what one box costs over its life against what each
 * agent slot on it costs. Pure functions over the model, no DOM.
 */
import { evaluate, type Assumptions, type Machine, type Result } from './model';
import type { CatalogEntry } from '../data/catalog';

export interface CostPoint {
  id: string;
  entry: CatalogEntry;
  machine: Machine;
  result: Result;
  /** One box over its life: purchase (0 when owned) plus `years` of power. */
  total: number;
  /** Lifetime cost per agent, total ÷ agents. Infinity when the box holds none. */
  perAgent: number;
}

export function costPoints(entries: CatalogEntry[], a: Assumptions): CostPoint[] {
  return entries.map((entry) => {
    const r = evaluate(entry.machine, a);
    return { id: entry.machine.id || 'custom', entry, machine: entry.machine, result: r, total: r.cost + a.years * r.powerYr, perAgent: r.lifePer };
  });
}

export type ConditionFilter = 'all' | 'new' | 'used';
export type FormFilter = 'all' | 'mini' | 'desktop' | 'big' | 'mac';

export interface Filters {
  condition: ConditionFilter;
  form: FormFilter;
  /** Highest total for one box over its life; null for no limit. */
  maxTotal: number | null;
  minRam: number;
  /** Show machines already owned (power only). */
  owned: boolean;
}

export const NO_FILTERS: Filters = { condition: 'all', form: 'all', maxTotal: null, minRam: 0, owned: true };

const FORM_GROUPS: Record<Exclude<FormFilter, 'all'>, string[]> = {
  mini: ['mini'], desktop: ['sff', 'tower'], big: ['workstation', 'server'], mac: ['mac'],
};

export function applyFilters(points: CostPoint[], f: Filters): CostPoint[] {
  return points.filter(({ entry, total, machine }) => {
    if (entry.condition === 'owned') { if (!f.owned) return false; }
    else if (f.condition === 'new' && entry.condition !== 'new') return false;
    else if (f.condition === 'used' && entry.condition === 'new') return false;
    if (f.form !== 'all' && !FORM_GROUPS[f.form].includes(entry.form)) return false;
    if (f.maxTotal != null && total > f.maxTotal) return false;
    return machine.ram >= f.minRam;
  });
}

/**
 * Ids of the purchases no cheaper purchase beats per agent: the lowest
 * per-agent cost available at or below each total. Owned machines never qualify.
 */
export function frontier(points: CostPoint[]): Set<string> {
  const out = new Set<string>();
  let best = Infinity;
  points
    .filter((p) => p.entry.condition !== 'owned' && p.result.n > 0)
    .sort((x, y) => x.total - y.total || x.perAgent - y.perAgent)
    .forEach((p) => { if (p.perAgent < best) { out.add(p.id); best = p.perAgent; } });
  return out;
}

/** The lowest per-agent cost among the purchases shown; Infinity when none holds an agent. */
export const cheapestPerAgent = (points: CostPoint[]) =>
  Math.min(...points.filter((p) => p.entry.condition !== 'owned' && p.result.n > 0).map((p) => p.perAgent), Infinity);

/** Log-scale domain padded by a quarter on each side and snapped outward to 1-2-3-5 steps. */
export function logDomain(lo: number, hi: number): [number, number] {
  const down = (v: number) => { const e = 10 ** Math.floor(Math.log10(v)); return [5, 3, 2, 1].map((s) => s * e).find((t) => t <= v)!; };
  const up = (v: number) => { const e = 10 ** Math.floor(Math.log10(v)); return [1, 2, 3, 5, 10].map((s) => s * e).find((t) => t >= v)!; };
  return [down(lo / 1.25), up(hi * 1.25)];
}

/** Candidate ticks at 1, 2, 3 and 5 times each power of ten inside the domain. */
export function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const s of [1, 2, 3, 5]) { const v = s * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); }
  }
  return out;
}
