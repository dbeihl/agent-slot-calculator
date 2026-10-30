import { planStrategies, fleetCaveats, DEFAULT_SITUATION, MAX_BOXES, type Situation, type Strategy, type StrategyKey } from '../lib/strategy';
import { CATALOG } from '../data/catalog';
import { DEFAULTS } from '../data/presets';
import { readSaved } from '../lib/saved';
import { userEntries } from '../lib/listings';
import { fmt$ } from '../lib/format';

const KEY = 'agent-slot-calc-strategy-v1';
const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);

function readSituation(target: number): Situation {
  let s: Partial<Situation> = {};
  try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ }
  const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  return {
    cash: num(s.cash, DEFAULT_SITUATION.cash), target: num(s.target, target), finance: !!s.finance,
    apr: num(s.apr, DEFAULT_SITUATION.apr), termMonths: num(s.termMonths, DEFAULT_SITUATION.termMonths),
    monthlyCap: typeof s.monthlyCap === 'number' && s.monthlyCap > 0 ? s.monthlyCap : null,
    usedOk: s.usedOk ?? DEFAULT_SITUATION.usedOk, serversOk: s.serversOk ?? DEFAULT_SITUATION.serversOk,
    maxBoxes: num(s.maxBoxes, DEFAULT_SITUATION.maxBoxes),
  };
}
function saveSituation(s: Situation) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}

const A = readSaved()?.A ?? { ...DEFAULTS };
let S = readSituation(A.target);

function syncInputs() {
  input('s-cash').value = String(S.cash);
  input('s-target').value = String(S.target);
  input('s-boxes').value = String(S.maxBoxes);
  input('s-cap').value = S.monthlyCap == null ? '' : String(S.monthlyCap);
  input('s-finance').checked = S.finance;
  input('s-apr').value = String(S.apr);
  $<HTMLSelectElement>('s-term').value = String(S.termMonths);
  input('s-used').checked = S.usedOk;
  input('s-servers').checked = S.serversOk;
  syncFinance();
}
function syncFinance() {
  input('s-apr').disabled = !S.finance;
  $<HTMLSelectElement>('s-term').disabled = !S.finance;
  $('s-cards').closest('section')?.classList.toggle('no-finance', !S.finance);
}

function readInputs() {
  const n = (id: string) => Number(input(id).value);
  const cash = n('s-cash'), target = n('s-target'), boxes = n('s-boxes'), apr = n('s-apr'), cap = input('s-cap').value.trim();
  S = {
    cash: isFinite(cash) && cash >= 0 ? cash : S.cash,
    target: isFinite(target) && target >= 1 ? Math.round(target) : S.target,
    maxBoxes: isFinite(boxes) && boxes >= 1 ? Math.min(MAX_BOXES, Math.round(boxes)) : S.maxBoxes,
    monthlyCap: cap === '' || !(Number(cap) > 0) ? null : Number(cap),
    finance: input('s-finance').checked,
    apr: isFinite(apr) && apr >= 0 ? apr : S.apr,
    termMonths: Number($<HTMLSelectElement>('s-term').value),
    usedOk: input('s-used').checked,
    serversOk: input('s-servers').checked,
  };
}

const TITLES: Record<StrategyKey, string> = { cash: 'Cash only', finance: 'Finance the rest', stages: 'Grow in stages', monthly: 'Lowest monthly bill' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function render() {
  const plan = planStrategies([...CATALOG, ...userEntries()], A, S);
  const order = [...plan.strategies].sort((x, y) => Number(y.key === plan.recommended) - Number(x.key === plan.recommended));
  const maxLife = Math.max(...plan.strategies.map((s) => (s.fleet ? s.fleet.lifetime : 0)), 1);
  $('s-assume').textContent = Math.round(A.p * 100) + '% duty · ' + A.slotGB + ' GB/build · ' + A.years + ' yr · $' + A.rate.toFixed(2) + '/kWh';

  const rec = plan.strategies.find((s) => s.key === plan.recommended);
  const recEl = $('s-rec'); recEl.textContent = '';
  if (rec && rec.fleet) {
    recEl.append(el('strong', '', 'Recommended: ' + rec.title + '. '));
    recEl.append(document.createTextNode(rec.fleet.meetsTarget
      ? `It reaches ${S.target} agents for the least over ${A.years} years: ${fmt$(rec.fleet.lifetime)}, or ${fmt$(rec.fleet.perAgent)} per agent.`
      : `Nothing within these limits reaches ${S.target} agents, so this is the cheapest per agent over ${A.years} years: ${rec.fleet.agents} agents at ${fmt$(rec.fleet.perAgent)} each. Raise your cash, allow financing or more machines to get closer.`));
  } else {
    recEl.textContent = 'No strategy fits these limits. Raise your cash or monthly limit, or allow more kinds of machine.';
  }

  const cards = $('s-cards'); cards.textContent = '';
  order.forEach((s) => cards.appendChild(card(s, s.key === plan.recommended, maxLife)));
  saveSituation(S);
}

function card(s: Strategy, recommended: boolean, maxLife: number) {
  const art = el('article', 'strategy');
  art.dataset.key = s.key;
  if (recommended) art.dataset.recommended = 'true';
  const head = el('div', 'strategy-head');
  const h = el('h3', '', s.title);
  head.append(h);
  const f = s.fleet;
  if (f) {
    const pill = el('span', 'pill', recommended ? 'Recommended' : f.meetsTarget ? 'Reaches ' + S.target : 'Short by ' + (S.target - f.agents));
    pill.dataset.state = recommended ? 'ok' : f.meetsTarget ? 'neutral' : 'warn';
    head.append(pill);
  }
  art.append(head, el('p', 'goal', s.goal));
  if (!f) { art.append(el('p', 'unavailable', s.unavailable || '')); art.dataset.empty = 'true'; return art; }
  if (s.sameAs) {
    art.append(el('p', 'same', s.key === 'finance' && f.financed === 0
      ? 'Same machines as ' + TITLES[s.sameAs] + ': your cash covers them, so there is nothing to borrow.'
      : 'Same machines as ' + TITLES[s.sameAs] + '.'));
  }

  const list = el('ul', 'fleet');
  f.boxes.forEach(({ option, count }) => {
    const li = el('li');
    li.append(el('span', 'count', count + ' ×'));
    const a = el('a', '', option.entry.machine.name);
    a.setAttribute('href', BASE + '?preset=' + encodeURIComponent(option.id));
    li.append(a);
    if (option.later > 0) li.append(el('span', 'later', ` then ${option.upGB} GB for +${fmt$(option.later * count)}`));
    list.append(li);
  });
  art.append(list);

  const metrics = el('div', 'metrics');
  const metric = (label: string, value: string, sub: string) => {
    const m = el('div', 'metric');
    m.append(el('span', 'eyebrow', label), el('span', 'v', value), el('span', 's', sub));
    metrics.append(m);
  };
  metric('Agents', f.later > 0 ? f.agentsNow + ' → ' + f.agents : String(f.agents), f.later > 0 ? 'now, then after the upgrade' : f.boxCount + (f.boxCount === 1 ? ' machine' : ' machines'));
  metric('Up front', fmt$(f.purchase), f.financed > 0 ? fmt$(f.financed) + ' financed' : f.later > 0 ? '+' + fmt$(f.later) + ' later' : 'from cash');
  metric('Monthly', fmt$(f.monthly), f.payment > 0 ? fmt$(f.powerYr / 12) + ' power + ' + fmt$(f.payment) + ' loan for ' + S.termMonths + ' mo' : 'power');
  metric('Per agent, ' + A.years + ' yr', fmt$(f.perAgent), fmt$(f.lifetime) + ' in total');
  art.append(metrics);

  const bar = el('div', 'costbar');
  bar.setAttribute('aria-hidden', 'true');
  const seg = (cls: string, v: number) => { if (v <= 0) return; const d = el('span', cls); d.style.width = (100 * v / maxLife).toFixed(2) + '%'; bar.append(d); };
  seg('seg-buy', f.purchase); seg('seg-later', f.later); seg('seg-power', A.years * f.powerYr); seg('seg-interest', f.interest);
  art.append(bar);

  const notes = fleetCaveats(f);
  if (notes.length) {
    const ul = el('ul', 'flags');
    notes.forEach((t) => { const li = el('li', '', t); li.dataset.state = 'warn'; ul.append(li); });
    art.append(ul);
  }
  return art;
}

let queued = false;
function update() {
  readInputs();
  syncFinance();
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

syncInputs();
['s-cash', 's-target', 's-boxes', 's-cap', 's-apr'].forEach((id) => input(id).addEventListener('input', update));
['s-finance', 's-used', 's-servers', 's-term'].forEach((id) => $(id).addEventListener('change', update));
render();
