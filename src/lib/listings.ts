/**
 * Machines the user adds by hand from listings they find. Kept in localStorage
 * (every access wrapped in try/catch) and exportable as JSON, so a list can be
 * shared or committed to `src/data/listings.json` later.
 */
import type { Machine } from './model';
import { CPUS, estimatePower, type CatalogEntry, type Condition, type Cpu, type Form } from '../data/catalog';

export const LISTINGS_KEY = 'agent-slot-calc-listings-v1';

export interface UserListing {
  id: string;
  name: string;
  cpuName: string;
  /** PassMark single-thread rating and CPU Mark, filled from the processor list or typed in. */
  st: number;
  mt: number;
  ram: number;
  price: number;
  condition: Condition;
  form: Form;
  link?: string;
  added: string;
}

const CONDITIONS: Condition[] = ['new', 'used', 'refurbished', 'owned'];
const FORMS: Form[] = ['mini', 'sff', 'tower', 'workstation', 'server', 'mac'];
const pos = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && v > 0;

/** A clean listing, or null when a field is missing or out of range. */
export function validListing(x: unknown): UserListing | null {
  if (!x || typeof x !== 'object') return null;
  const l = x as Record<string, unknown>;
  if (typeof l.id !== 'string' || !l.id || typeof l.cpuName !== 'string' || !l.cpuName.trim()) return null;
  if (!pos(l.st) || !pos(l.mt) || !pos(l.ram) || typeof l.price !== 'number' || !isFinite(l.price) || l.price < 0) return null;
  if (!CONDITIONS.includes(l.condition as Condition) || !FORMS.includes(l.form as Form)) return null;
  const link = typeof l.link === 'string' && /^https?:\/\//.test(l.link) ? l.link : undefined;
  return {
    id: l.id, name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : String(l.cpuName).trim() + ' · ' + l.ram + ' GB',
    cpuName: l.cpuName.trim(), st: l.st, mt: l.mt, ram: l.ram, price: l.price,
    condition: l.condition as Condition, form: l.form as Form, link, added: typeof l.added === 'string' ? l.added : '',
  };
}

export function readUserListings(): UserListing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(validListing).filter((l): l is UserListing => l != null) : [];
  } catch (e) { return []; }
}

export function writeUserListings(list: UserListing[]) {
  try { localStorage.setItem(LISTINGS_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
}

/** Parse an exported file: an array of listings, or an object with a `listings` array. Invalid rows are dropped. */
export function parseImport(text: string): { listings: UserListing[]; dropped: number } {
  const data = JSON.parse(text);
  const arr: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.listings) ? data.listings : [];
  const listings = arr.map(validListing).filter((l): l is UserListing => l != null);
  return { listings, dropped: arr.length - listings.length };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** The processor whose name matches what the user typed, ignoring case and punctuation. */
export const matchCpu = (name: string): Cpu | undefined => { const n = norm(name); return CPUS.find((c) => norm(c.name) === n); };

export function userEntry(l: UserListing): CatalogEntry {
  const cpu: Cpu = matchCpu(l.cpuName) ?? {
    id: '', name: l.cpuName, vendor: l.form === 'mac' ? 'Apple' : 'Intel', segment: l.form === 'mini' ? 'mobile' : 'desktop',
    cores: null, threads: null, tdpW: null, st: l.st, mt: l.mt, source: '', seen: '',
  };
  const power = estimatePower(cpu, l.form);
  const machine: Machine = {
    id: l.id, group: 'Yours', name: l.name, price: l.condition === 'owned' ? 0 : l.price, owned: l.condition === 'owned',
    ram: l.ram, st: l.st, mt: l.mt, idle: power.idle, load: power.load, reserve: l.form === 'mac' ? 8 : 6, upGB: 0, upCost: 0,
    note: 'Added by you' + (l.link ? ' from ' + l.link : '') + '. Power is estimated from the processor and form factor.',
  };
  return {
    machine, condition: l.condition, form: l.form, origin: 'yours', priceKind: l.condition === 'owned' ? 'owned' : 'yours',
    powerEstimated: true, scoreEstimated: false, source: l.link, seen: l.added,
  };
}

export const userEntries = () => readUserListings().map(userEntry);
