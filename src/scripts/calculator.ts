import { evaluate, evaluateReference, judge, stickOptions, type Assumptions, type Machine, type Result, type VerdictKey } from '../lib/model';
import { DEFAULTS, PRESETS, REFERENCE_ID } from '../data/presets';
import { readSaved, writeSaved, type EditableMachine } from '../lib/saved';
import { CATALOG, FORM_LABEL } from '../data/catalog';
import { userEntries } from '../lib/listings';
import { fmt$ } from '../lib/format';


type MachineField = 'price' | 'ram' | 'st' | 'mt' | 'cpus' | 'idle' | 'load';
const STICK_GB = [16, 32, 64];
type FieldDef<K extends string> = {
  k: K;
  label: string;
  min: number;
  max: number;
  step: number;
  pre?: string;
  unit?: string;
  hint?: string;
  scale?: number;
  dec?: number;
  chips?: [string, number][];
  _seg?: HTMLDivElement;
  sync?: () => void;
};
type ElementMap = {
  preset: HTMLSelectElement;
  mname: HTMLInputElement;
  owned: HTMLInputElement;
  upgb: HTMLInputElement;
  upcost: HTMLInputElement;
  slots: HTMLInputElement;
  stick16: HTMLInputElement;
  stick32: HTMLInputElement;
  stick64: HTMLInputElement;
  chart: SVGSVGElement;
} & Record<'vband' | 'vpill' | 'bar-pill' | 'vname' | 'res-assume' | 'agents' | 'bar-agents' |
  'limit' | 'm-hw' | 'm-hw-s' | 'm-tco' | 'bar-tco' | 'm-tco-s' | 'm-pwr' | 'm-pwr-s' |
  'm-ref' | 'm-ref-s' | 'fleet' | 'flags' | 'chart-title' | 'tbody' | 'machine-fields' |
  'work-fields' | 'adv-fields' | 'os-seg' | 'verdict-seg' | 'source-seg' | 'h-table' | 'mnote' | 'sticks-box' | 'sticks-out' | 'h-machine' | 'reset', HTMLElement>;

const $ = <K extends keyof ElementMap>(id: K): ElementMap[K] => document.getElementById(id) as ElementMap[K];

let A: Assumptions = { ...DEFAULTS };
let M: EditableMachine;
let presetId = '270k128';

const MACHINE_FIELDS: FieldDef<MachineField>[] = [
  { k: 'price', label: 'Price', min: 0, max: 15000, step: 25, pre: '$', hint: 'What you would pay, all in.' },
  { k: 'ram', label: 'Memory', min: 8, max: 512, step: 4, unit: 'GB', hint: 'Installed RAM.' },
  { k: 'st', label: 'Single-thread', min: 800, max: 6000, step: 10, unit: 'pts', hint: 'PassMark single-thread rating. Ryzen 9 9950X = 4,726.' },
  { k: 'mt', label: 'Multi-thread', min: 2000, max: 160000, step: 100, unit: 'pts', hint: 'PassMark CPU Mark. Ryzen 9 9950X = 65,693.' },
  { k: 'cpus', label: 'CPUs', min: 1, max: 8, step: 1, unit: '', hint: 'Sockets in the system, all the same CPU. Each extra CPU adds 80% of the multi-thread score; power is for the whole system.' },
  { k: 'idle', label: 'Idle power', min: 1, max: 250, step: 1, unit: 'W', hint: 'Watts at the wall when idle.' },
  { k: 'load', label: 'Full-load power', min: 10, max: 700, step: 5, unit: 'W', hint: 'Watts at the wall with every core busy.' }
];
const WORK_FIELDS: FieldDef<keyof Assumptions>[] = [
  { k: 'p', label: 'Duty cycle', min: 5, max: 70, step: 5, unit: '%', scale: 100, hint: 'Share of each agent’s time spent building or testing; the rest is waiting on the model. 30% is the planning case. Measure yours.' },
  { k: 'slotGB', label: 'Memory per running build', min: 4, max: 32, step: 1, unit: 'GB', hint: 'Peak of one build plus its test database.', chips: [['Python', 6], ['TS / Ruby', 8], ['Mixed', 12], ['Rust / C++ / Java', 16]] },
  { k: 'target', label: 'Agents you want', min: 1, max: 60, step: 1, unit: '', hint: 'Used for the fleet line: how many of this box you’d need.' },
  { k: 'rate', label: 'Electricity', min: 0.05, max: 0.6, step: 0.01, unit: '$/kWh', dec: 2, hint: 'California is about $0.33–0.39.' }
];
const ADV_FIELDS: FieldDef<keyof Assumptions>[] = [
  { k: 'threads', label: 'Threads per running build', min: 2, max: 16, step: 1, unit: '', hint: '4 threads is an eighth of a 16-core Ryzen 9 9950X.' },
  { k: 'residentGB', label: 'Memory per idle agent', min: 0.5, max: 4, step: 0.5, unit: 'GB', dec: 1, hint: 'Held all the time: the agent CLI, language servers, file watchers.' },
  { k: 'serial', label: 'Serial share of a build', min: 0, max: 90, step: 10, unit: '%', scale: 100, hint: 'Linking, type checks, single big crates. Stretched by slow single-thread scores.' },
  { k: 'loadShare', label: 'Time at full load', min: 5, max: 100, step: 5, unit: '%', scale: 100, hint: 'The rest of the day counts as idle. Boxes run 24/7.' },
  { k: 'years', label: 'Years of use', min: 1, max: 5, step: 1, unit: 'yr', hint: 'How long the purchase is spread over.' },
  { k: 'refPrice', label: '128 GB desktop price', min: 1500, max: 6000, step: 50, pre: '$', hint: 'The Core Ultra 7 270K Plus box everything is compared with.' }
];

function buildField<K extends string>(def: FieldDef<K>, container: HTMLElement, getObj: () => Record<K, number>, onChange: () => void) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const top = document.createElement('div'); top.className = 'field-top';
  const lab = document.createElement('label'); lab.htmlFor = 'f-' + def.k + '-n'; lab.textContent = def.label;
  const num = document.createElement('span'); num.className = 'num';
  if (def.pre) { const pre = document.createElement('span'); pre.className = 'pre'; pre.textContent = def.pre; num.appendChild(pre); }
  const ni = document.createElement('input'); ni.type = 'number'; ni.id = 'f-' + def.k + '-n'; ni.min = String(def.min); ni.step = String(def.step); ni.inputMode = 'decimal';
  num.appendChild(ni);
  if (def.unit) { const u = document.createElement('span'); u.className = 'unit'; u.textContent = def.unit; num.appendChild(u); }
  top.append(lab, num);
  const r = document.createElement('input'); r.type = 'range'; r.id = 'f-' + def.k; r.min = String(def.min); r.max = String(def.max); r.step = String(def.step); r.setAttribute('aria-label', def.label);
  wrap.append(top, r);
  if (def.chips) {
    const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', def.label + ' presets');
    def.chips.forEach(([t, v]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t + ' ' + v; b.dataset.v = String(v); seg.appendChild(b); });
    seg.addEventListener('click', (e) => { const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return; set(Number(b.dataset.v)); });
    wrap.appendChild(seg);
    def._seg = seg;
  }
  if (def.hint) { const h = document.createElement('p'); h.className = 'hint'; h.textContent = def.hint; wrap.appendChild(h); }
  container.appendChild(wrap);
  const scale = def.scale || 1;
  function set(uiVal: number, from?: 'n' | 'r') {
    if (!isFinite(uiVal)) return;
    getObj()[def.k] = uiVal / scale;
    if (from !== 'n') ni.value = def.dec ? uiVal.toFixed(def.dec) : String(uiVal);
    if (from !== 'r') r.value = String(uiVal);
    if (def._seg) def._seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === uiVal)));
    onChange();
  }
  r.addEventListener('input', () => set(Number(r.value), 'r'));
  ni.addEventListener('input', () => { const v = Number(ni.value); if (ni.value !== '' && isFinite(v) && v >= 0) set(v, 'n'); });
  def.sync = () => {
    const v = getObj()[def.k] * scale;
    const uiVal = Math.round(v * 1000) / 1000;
    ni.value = def.dec ? uiVal.toFixed(def.dec) : String(uiVal);
    r.value = String(uiVal);
    if (def._seg) def._seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === uiVal)));
  };
}

/** Every machine the dropdown can load: the report's presets, market listings and the user's own listings. */
const allMachines = (): Machine[] => [...CATALOG, ...userEntries()].map((e) => e.machine);

function loadPreset(id: string) {
  const all = allMachines();
  const p = all.find((x) => x.id === id) || PRESETS.find((x) => x.id === REFERENCE_ID)!;
  presetId = p.id || 'custom';
  M = { name: p.name, price: p.price, ram: p.ram, st: p.st, mt: p.mt, cpus: p.cpus || 1, idle: p.idle, load: p.load, reserve: p.reserve, owned: !!p.owned, upGB: p.upGB || 0, upCost: p.upCost || 0, slots: 0, stick: M?.stick || {}, note: p.note };
  syncMachine();
}
function syncMachine() {
  $('preset').value = presetId;
  $('mname').value = M.name;
  $('owned').checked = M.owned;
  MACHINE_FIELDS.forEach((d) => d.sync?.());
  document.querySelectorAll<HTMLButtonElement>('#os-seg button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === M.reserve)));
  $('upgb').value = M.upGB ? String(M.upGB) : '';
  $('upcost').value = M.upCost ? String(M.upCost) : '';
  $('slots').value = M.slots ? String(M.slots) : '';
  STICK_GB.forEach((g) => { $(`stick${g}` as 'stick16').value = M.stick[g] ? String(M.stick[g]) : ''; });
  $('mnote').textContent = M.note || '';
}
function syncWork() { [...WORK_FIELDS, ...ADV_FIELDS].forEach((d) => d.sync?.()); }

function save() { writeSaved({ A, M, presetId }); }
const savedSticks = (stick?: Record<number, number>) => Object.fromEntries(STICK_GB.map((g) => [g, Number(stick?.[g]) || 0]));
const MACHINE_NUMBERS = ['price', 'ram', 'st', 'mt', 'idle', 'load', 'reserve'] as const;
function restore() {
  const s = readSaved();
  if (!s) return false;
  A = s.A;
  // A machine still in the catalog reloads from current data, so price and spec updates reach returning
  // visitors; only the upgrade and RAM stick inputs, which don't mark the machine as edited, carry over.
  if (s.presetId !== 'custom' && allMachines().some((x) => x.id === s.presetId)) {
    loadPreset(s.presetId);
    M.upGB = Number(s.M.upGB) || 0; M.upCost = Number(s.M.upCost) || 0;
    M.slots = Number(s.M.slots) || 0; M.stick = savedSticks(s.M.stick);
    return true;
  }
  // An edited machine, or one no longer in the catalog, is kept only if it is complete.
  if (MACHINE_NUMBERS.every((k) => typeof s.M[k] === 'number' && isFinite(s.M[k]))) {
    M = { ...s.M, name: typeof s.M.name === 'string' ? s.M.name : 'Custom machine', owned: !!s.M.owned, upGB: Number(s.M.upGB) || 0, upCost: Number(s.M.upCost) || 0, cpus: Number(s.M.cpus) || 1, slots: Number(s.M.slots) || 0, stick: savedSticks(s.M.stick) };
    presetId = 'custom';
  } else {
    loadPreset(REFERENCE_ID);
  }
  return true;
}

function refResult() {
  const ref = PRESETS.find((x) => x.id === REFERENCE_ID)!;
  return evaluateReference(ref, A);
}

function render() {
  const ref = refResult();
  const r = evaluate(M, A);
  const v = judge(r, ref, M);

  $('vband').dataset.state = v.key;
  $('vpill').dataset.state = v.key; $('vpill').textContent = v.label;
  $('bar-pill').dataset.state = v.key; $('bar-pill').textContent = v.label;
  $('vname').textContent = M.name || 'Custom machine';
  $('res-assume').textContent = Math.round(A.p * 100) + '% duty · ' + A.slotGB + ' GB/build';

  $('agents').textContent = String(r.n);
  $('bar-agents').textContent = String(r.n);
  const limitTxt = r.n === 0
    ? (r.limit === 'ram' ? 'not enough memory for one build' : 'too slow for one build')
    : r.limit === 'ram' ? 'limited by memory' : r.limit === 'cpu' ? 'limited by CPU' : 'more than 400';
  $('limit').textContent = limitTxt;

  $('m-hw').textContent = M.owned ? '$0' : fmt$(r.hwPer);
  $('m-hw-s').textContent = M.owned ? 'already paid for' : 'purchase ÷ agents';
  $('m-tco').textContent = fmt$(r.lifePer);
  $('bar-tco').textContent = fmt$(r.lifePer);
  $('m-tco-s').textContent = A.years + ' yr incl. power' + (M.owned ? ' only' : '');
  $('m-pwr').textContent = fmt$(r.powerYr);
  $('m-pwr-s').textContent = '~' + Math.round(r.watts) + ' W average';
  if (r.n === 0) { $('m-ref').textContent = '—'; $('m-ref-s').textContent = 'no agents'; }
  else {
    $('m-ref').textContent = '×' + v.ratio.toFixed(2);
    $('m-ref-s').textContent = v.ratio <= 1.0001 ? 'cheaper or equal per agent' : Math.round((v.ratio - 1) * 100) + '% more per agent';
  }

  // Fleet line
  const fleet = $('fleet');
  fleet.textContent = '';
  if (r.n > 0) {
    const boxes = Math.ceil(A.target / r.n);
    const up = boxes * r.cost;
    const life = boxes * (r.cost + A.years * r.powerYr);
    const parts: [string, 'b' | null][] = [['For ', null], [String(A.target), 'b'], [' agents: ', null], [boxes + (boxes === 1 ? ' box' : ' boxes'), 'b'], [' · ', null], [fmt$(up), 'b'], [' up front · ', null], [fmt$(life), 'b'], [' over ' + A.years + ' years', null]];
    if (M.owned) { parts.splice(5, 2, ['', null], ['', null]); }
    parts.forEach(([t, tag]) => { if (!t) return; if (tag) { const b = document.createElement('b'); b.textContent = t; fleet.appendChild(b); } else fleet.appendChild(document.createTextNode(t)); });
    const refBoxes = Math.ceil(A.target / ref.n);
    fleet.appendChild(document.createTextNode('. The 128 GB desktop needs ' + refBoxes + ' for ' + fmt$(refBoxes * (A.refPrice + A.years * ref.powerYr)) + '.'));
  } else {
    fleet.textContent = 'This box can’t run one full build with these settings.';
  }

  // Flags
  const flags: [VerdictKey, string][] = [];
  if (M.st < 2500) flags.push(['warn', 'Slow cores: serial steps run about ' + r.stStretch.toFixed(1) + '× slower than a Ryzen 9 9950X. Below about 2,500 single-thread points, agents feel sluggish.']);
  if (r.mtStretch > 1.01) flags.push(['warn', 'Not enough CPU for one full build slot, so each build runs about ' + r.mtStretch.toFixed(1) + '× slower.']);
  if (r.n > 0 && r.limit === 'ram' && r.cpuUsedP95 < 0.7) flags.push(['ok', 'Memory-bound with spare CPU: about ' + Math.round((1 - r.cpuUsedP95) * 100) + '% of the CPU is still free at peak, so more RAM adds agents.']);
  if (r.n > 0 && r.limit === 'cpu' && r.ramUsedP99 < 0.7) flags.push(['warn', 'CPU-bound: about ' + Math.round((1 - r.ramUsedP99) * 100) + '% of the memory sits unused even at peak.']);
  if (M.upGB > M.ram && M.upCost >= 0) {
    const u = evaluate(M, A, M.upGB, M.price + M.upCost);
    const uCost = M.owned ? M.upCost : M.price + M.upCost;
    const uLife = u.n ? (uCost + A.years * u.powerYr) / u.n : Infinity;
    const added = u.n - r.n;
    let txt = 'With ' + M.upGB + ' GB (+' + fmt$(M.upCost) + '): ' + u.n + ' agents, ' + fmt$(uLife) + ' per agent over ' + A.years + ' years';
    if (added > 0 && M.upCost > 0) txt += '. That’s ' + fmt$(M.upCost / added) + ' per added agent.';
    else if (added <= 0) txt += '. No gain: something else is the limit.';
    else txt += '.';
    const better = uLife < r.lifePer;
    flags.push([better ? 'ok' : 'warn', txt]);
  }
  renderSticks();
  if (M.owned && r.n > 0) flags.push(['ok', 'Already paid for, so only electricity counts.']);
  const ul = $('flags'); ul.textContent = '';
  flags.forEach(([s, t]) => { const li = document.createElement('li'); li.dataset.state = s; li.textContent = t; ul.appendChild(li); });

  drawChart(r);
  renderTable(ref);
  save();
}

function renderSticks() {
  $('sticks-box').hidden = M.cpus < 2;
  const out = $('sticks-out');
  const prices = Object.fromEntries(STICK_GB.filter((g) => M.stick[g] > 0).map((g) => [g, M.stick[g]]));
  if (M.cpus < 2 || !M.slots || !Object.keys(prices).length) { out.textContent = 'Enter the slots per CPU and at least one stick price to compare.'; return; }
  const opts = stickOptions(M.ram, M.cpus, M.slots, prices);
  const best = Math.min(...opts.filter((o) => o.fits).map((o) => o.cost));
  out.textContent = M.ram + ' GB across ' + M.cpus + ' CPUs × ' + M.slots + ' slots: ' + opts.map((o) => !o.fits
    ? o.gb + ' GB sticks need ' + o.sticks / M.cpus + ' slots per CPU'
    : o.sticks + ' × ' + o.gb + ' GB = ' + fmt$(o.cost) + (o.cost === best ? ' (cheapest)' : '')).join(' · ') + '.';
}

function drawChart(r: Result) {
  const svg = $('chart');
  const NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const n = r.shown;
  const ramCap = r.ramFitBuilds, cpuCap = r.cpuFitBuilds;
  const xMax = Math.min(Math.max(n, Math.ceil(Math.min(Math.max(ramCap, cpuCap), n * 2 + 2))), 60);
  const W = 320, x0 = 10, x1 = 310, yTop = 26, yBase = 102;
  const slot = (x1 - x0) / (xMax + 1);
  const xc = (k: number) => x0 + slot * (k + 0.5);
  const xCap = (v: number) => Math.min(x1, x0 + slot * (Math.min(Math.max(v, 0), xMax) + 1));
  const maxP = Math.max(...r.pmf);
  $('chart-title').textContent = 'Builds running at once · ' + n + (n === 1 ? ' agent' : ' agents');
  const mk = (tag: string, attrs: Record<string, string | number>, text?: string) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, String(attrs[k])); if (text != null) el.textContent = text; svg.appendChild(el); return el; };
  mk('line', { x1: x0, x2: x1, y1: yBase, y2: yBase, stroke: 'var(--line)', 'stroke-width': 1 });
  for (let k = 0; k <= xMax; k++) {
    const p = k <= n ? r.pmf[k] : 0;
    if (p <= 0) continue;
    const h = (yBase - yTop) * (p / maxP);
    mk('rect', { x: xc(k) - slot * 0.36, y: yBase - h, width: Math.max(1, slot * 0.72), height: h, rx: 1.5, fill: k <= r.q99 ? 'var(--accent)' : 'var(--muted)', opacity: k <= r.q95 ? 0.95 : 0.55 });
  }
  const lines = [
    { v: ramCap, label: 'Memory fits ' + (ramCap >= 100 ? '100+' : ramCap.toFixed(ramCap < 10 ? 1 : 0)), color: 'var(--bad)', dash: '4 3', y: 10 },
    { v: cpuCap, label: 'CPU fits ' + (cpuCap >= 100 ? '100+' : cpuCap.toFixed(cpuCap < 10 ? 1 : 0)), color: 'var(--ink)', dash: '1.5 2.5', y: 20 }
  ];
  lines.forEach((L) => {
    const x = xCap(L.v);
    mk('line', { x1: x, x2: x, y1: L.y + 3, y2: yBase, stroke: L.color, 'stroke-width': 1.4, 'stroke-dasharray': L.dash });
    const anchor = x > W * 0.62 ? 'end' : 'start';
    mk('text', { x: anchor === 'end' ? x - 3 : x + 3, y: L.y, 'font-size': 9.5, 'text-anchor': anchor, fill: L.color, 'font-family': 'var(--font-mono)' }, L.label + (L.v > xMax ? ' →' : ''));
  });
  const ticks = new Set([0, xMax, r.q99]);
  ticks.forEach((k) => {
    mk('line', { x1: xc(k), x2: xc(k), y1: yBase, y2: yBase + 4, stroke: 'var(--muted)', 'stroke-width': 1 });
    mk('text', { x: xc(k), y: yBase + 15, 'font-size': 9.5, 'text-anchor': 'middle', fill: k === r.q99 ? 'var(--accent)' : 'var(--muted)', 'font-family': 'var(--font-mono)' }, String(k));
  });
  mk('text', { x: xc(r.q99), y: yBase + 27, 'font-size': 9, 'text-anchor': 'middle', fill: 'var(--accent)', 'font-family': 'var(--font-body)' }, '99% of the time ≤ ' + r.q99);
}

let verdictFilter = 'all';
let source: 'report' | 'microcenter' = 'report';
const BUNDLES = CATALOG.filter((e) => e.machine.id?.startsWith('mk-microcenter-')).map((e) => e.machine);

function renderTable(ref: Result) {
  const tb = $('tbody'); tb.textContent = '';
  $('h-table').textContent = source === 'report' ? 'Every machine from the report, under your settings' : 'Micro Center bundles as full builds, under your settings';
  const rows = (source === 'report' ? PRESETS : BUNDLES).map((p) => { const m = { ...p, owned: !!p.owned }; const r = evaluate(m, A); return { p, r, v: judge(r, ref, m) }; })
    .filter((x) => verdictFilter === 'all' || x.v.key === verdictFilter);
  if (!rows.length) {
    const tr = document.createElement('tr'); tr.className = 'group';
    const td = document.createElement('td'); td.colSpan = 7; td.textContent = 'No machine gets this verdict under your settings.'; tr.appendChild(td); tb.appendChild(tr);
  }
  const sorter = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.r.lifePer - b.r.lifePer;
  const groups: [string, typeof rows][] = [['To buy', rows.filter((x) => !x.p.owned).sort(sorter)], ['Already yours · power only', rows.filter((x) => x.p.owned).sort(sorter)]];
  groups.forEach(([title, list]) => {
    if (!list.length) return;
    const g = document.createElement('tr'); g.className = 'group';
    const gtd = document.createElement('td'); gtd.colSpan = 7; gtd.textContent = title; g.appendChild(gtd); tb.appendChild(g);
    list.forEach(({ p, r, v }) => {
      const tr = document.createElement('tr');
      tr.setAttribute('aria-selected', String(p.id === presetId));
      tr.tabIndex = 0;
      const cells = [
        [p.name, ''],
        [p.owned ? 'owned' : fmt$(p.price), 'n'],
        [String(r.n), 'n'],
        [r.n === 0 ? '—' : r.limit === 'ram' ? 'Memory' : r.limit === 'cpu' ? 'CPU' : '—', ''],
        [p.owned ? '$0' : fmt$(r.hwPer), 'n'],
        [fmt$(r.lifePer), 'n']
      ];
      cells.forEach(([t, cls]) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = t; tr.appendChild(td); });
      const vtd = document.createElement('td'); const pill = document.createElement('span'); pill.className = 'pill'; pill.dataset.state = v.key; pill.textContent = v.label; vtd.appendChild(pill); tr.appendChild(vtd);
      const go = () => { loadPreset(p.id || 'custom'); render(); if (window.matchMedia('(max-width: 919px)').matches) $('h-machine').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      tb.appendChild(tr);
    });
  });
}

function init() {
  // Preset select
  const sel = $('preset');
  const groups: Record<string, Machine[]> = {};
  PRESETS.forEach((p) => { (groups[p.group || ''] = groups[p.group || ''] || []).push(p); });
  Object.entries(groups).forEach(([g, list]) => {
    const og = document.createElement('optgroup'); og.label = g;
    list.forEach((p) => { const o = document.createElement('option'); o.value = p.id || 'custom'; o.textContent = p.name; og.appendChild(o); });
    sel.appendChild(og);
  });
  // Market listings by form factor, then the user's own listings.
  const extra = [...CATALOG.filter((e) => e.origin === 'market'), ...userEntries()];
  const extraGroups = new Map<string, Machine[]>();
  extra.forEach((e) => { const g = e.origin === 'yours' ? 'Your listings' : 'Market · ' + FORM_LABEL[e.form]; extraGroups.set(g, [...(extraGroups.get(g) || []), e.machine]); });
  extraGroups.forEach((list, g) => {
    const og = document.createElement('optgroup'); og.label = g;
    list.sort((a, b) => a.price - b.price).forEach((m) => { const o = document.createElement('option'); o.value = m.id || 'custom'; o.textContent = m.name; og.appendChild(o); });
    sel.appendChild(og);
  });
  const oc = document.createElement('option'); oc.value = 'custom'; oc.textContent = 'Custom (edited)'; sel.appendChild(oc);

  const markCustom = () => { if (presetId !== 'custom') { presetId = 'custom'; sel.value = 'custom'; } };
  MACHINE_FIELDS.forEach((d) => buildField(d, $('machine-fields'), () => M, () => { markCustom(); render(); }));
  WORK_FIELDS.forEach((d) => buildField(d, $('work-fields'), () => A, render));
  ADV_FIELDS.forEach((d) => buildField(d, $('adv-fields'), () => A, render));

  sel.addEventListener('change', () => { if (sel.value === 'custom') { presetId = 'custom'; render(); return; } loadPreset(sel.value); render(); });
  $('mname').addEventListener('input', () => { M.name = $('mname').value; markCustom(); render(); });
  $('owned').addEventListener('change', () => { M.owned = $('owned').checked; markCustom(); render(); });
  // Table filters: which machines, then which verdicts.
  const onSeg = (id: 'verdict-seg' | 'source-seg', set: (v: string) => void) => $(id).addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return;
    set(b.dataset.v!);
    $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });
  onSeg('verdict-seg', (v) => { verdictFilter = v; });
  onSeg('source-seg', (v) => { source = v as typeof source; });
  $('os-seg').addEventListener('click', (e) => { const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return; M.reserve = Number(b.dataset.v); markCustom(); syncMachine(); render(); });
  $('upgb').addEventListener('input', () => { M.upGB = Number($('upgb').value) || 0; render(); });
  $('upcost').addEventListener('input', () => { M.upCost = Number($('upcost').value) || 0; render(); });
  $('slots').addEventListener('input', () => { M.slots = Number($('slots').value) || 0; render(); });
  STICK_GB.forEach((g) => $(`stick${g}` as 'stick16').addEventListener('input', () => { M.stick[g] = Number($(`stick${g}` as 'stick16').value) || 0; render(); }));
  $('reset').addEventListener('click', () => { A = { ...DEFAULTS }; syncWork(); render(); });

  const restored = restore();
  // ?preset=<id> (links from the cost chart) loads that machine and keeps the saved workload.
  const linked = new URLSearchParams(location.search).get('preset');
  if (linked && allMachines().some((p) => p.id === linked)) { loadPreset(linked); history.replaceState(null, '', location.pathname); }
  else if (!restored) loadPreset('270k128');
  syncMachine(); syncWork();
  render();
}
init();
