/**
 * The calculator's saved state in localStorage. Both pages read it, so the cost
 * chart shows the same workload and machine the calculator last showed.
 * Every access is wrapped in try/catch: storage can be blocked.
 */
import type { Assumptions, Machine } from './model';
import { DEFAULTS } from '../data/presets';

export const STORE_KEY = 'agent-slot-calc-v1';

export type EditableMachine = Machine & { owned: boolean; upGB: number; upCost: number; cpus: number; slots: number; stick: Record<number, number> };

export interface Saved {
  A: Assumptions;
  M: EditableMachine;
  /** A preset id, or 'custom' once the machine has been edited. */
  presetId: string;
}

export function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { A?: Partial<Assumptions>; M?: EditableMachine; presetId?: string };
    if (s && s.A && s.M) return { A: { ...DEFAULTS, ...s.A }, M: s.M, presetId: s.presetId || 'custom' };
  } catch (e) { /* ignore */ }
  return null;
}

export function writeSaved(s: Saved) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
