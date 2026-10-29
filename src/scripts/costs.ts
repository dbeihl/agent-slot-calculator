import { costPoints, applyFilters, frontier, cheapestPerAgent, logDomain, logTicks, NO_FILTERS, type CostPoint, type Filters, type ConditionFilter, type FormFilter } from '../lib/costs';
import { CATALOG, CPUS, FORM_LABEL, type CatalogEntry, type Condition, type Form } from '../data/catalog';
import { DEFAULTS, REFERENCE_ID } from '../data/presets';
import { readSaved } from '../lib/saved';
import { readUserListings, writeUserListings, userEntry, matchCpu, parseImport, validListing } from '../lib/listings';
import { fmt$, fmtAxis$ } from '../lib/format';

const NS = 'http://www.w3.org/2000/svg';
const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement | SVGSVGElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ISO_AGENTS = [1, 2, 5, 10, 20, 50, 100, 200, 400];

let points: CostPoint[] = [];
let filters: Filters = { ...NO_FILTERS };
let selectedId = '';
let years = DEFAULTS.years;
let drawnWidth = 0;
let shown: CostPoint[] = [];
let front = new Set<string>();
let cheapest = Infinity;

function load() {
  const saved = readSaved();
  const A = saved ? saved.A : { ...DEFAULTS };
  selectedId = saved ? saved.presetId : '';
  years = A.years;
  const entries: CatalogEntry[] = [...CATALOG, ...readUserListings().map(userEntry)];
  // A machine edited in the calculator is plotted too; catalog machines are plotted from current data.
  if (saved && selectedId === 'custom') {
    entries.push({
      machine: { ...saved.M, id: 'custom', name: saved.M.name || 'Custom machine' },
      condition: saved.M.owned ? 'owned' : 'new', form: saved.M.reserve === 8 ? 'mac' : 'tower', origin: 'yours',
      priceKind: saved.M.owned ? 'owned' : 'yours', powerEstimated: false, scoreEstimated: false, source: undefined, seen: undefined,
    });
  }
  points = costPoints(entries, A);
  $('cost-assume').textContent = Math.round(A.p * 100) + '% duty · ' + A.slotGB + ' GB/build · ' + A.years + ' yr · $' + A.rate.toFixed(2) + '/kWh';
  $('th-total').textContent = 'Total, ' + A.years + ' yr';
}

function render() {
  shown = applyFilters(points, filters);
  front = frontier(shown);
  cheapest = cheapestPerAgent(shown);
  draw();
  renderTable();
  const none = shown.filter((p) => p.result.n === 0).length;
  $('cost-count').textContent = 'Showing ' + shown.length + ' of ' + points.length + ' machines.'
    + (none ? ' ' + none + " can't hold one agent with these settings, so " + (none === 1 ? 'it is' : 'they are') + ' listed in the table but not plotted.' : '');
}

const ratioText = (p: CostPoint) => p.result.n && isFinite(cheapest) ? '×' + (p.perAgent / cheapest).toFixed(2) : '—';

function draw() {
  const svg = $<SVGSVGElement>('cost-chart');
  const wrap = $('cost-chart-wrap');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  hideTip();
  const W = Math.max(280, Math.round(wrap.clientWidth));
  const H = Math.round(Math.min(460, Math.max(300, W * 0.62)));
  drawnWidth = W;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const mk = (tag: string, attrs: Record<string, string | number>, text?: string, parent: Element = svg) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, String(attrs[k]));
    if (text != null) el.textContent = text;
    parent.appendChild(el);
    return el;
  };
  const plotted = shown.filter((p) => p.result.n > 0);
  if (!plotted.length) {
    mk('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)', class: 'axis-title' }, 'No machine matches these filters and holds an agent.');
    return;
  }

  const m = { l: 50, r: 14, t: 12, b: 42 };
  const [x0, x1] = logDomain(Math.min(...plotted.map((p) => p.total)), Math.max(...plotted.map((p) => p.total)));
  const ys = plotted.map((p) => p.perAgent);
  if (isFinite(cheapest)) ys.push(cheapest * 1.25);
  const [y0, y1] = logDomain(Math.min(...ys), Math.max(...ys));
  const lx = (v: number) => Math.log10(v);
  const X = (v: number) => m.l + (lx(v) - lx(x0)) / (lx(x1) - lx(x0)) * (W - m.l - m.r);
  const Y = (v: number) => H - m.b - (lx(v) - lx(y0)) / (lx(y1) - lx(y0)) * (H - m.t - m.b);
  const plotL = m.l, plotR = W - m.r, plotT = m.t, plotB = H - m.b;

  // Bands: within 10% and within 25% of the cheapest per-agent cost among the machines shown.
  if (isFinite(cheapest)) {
    const clampY = (v: number) => Math.min(plotB, Math.max(plotT, Y(v)));
    const yOk = clampY(cheapest * 1.1), yWarn = clampY(cheapest * 1.25);
    mk('rect', { x: plotL, y: yWarn, width: plotR - plotL, height: yOk - yWarn, fill: 'var(--warn-bg)' });
    mk('rect', { x: plotL, y: yOk, width: plotR - plotL, height: plotB - yOk, fill: 'var(--ok-bg)' });
    const yMin = clampY(cheapest);
    mk('line', { x1: plotL, x2: plotR, y1: yMin, y2: yMin, stroke: 'var(--ok)', 'stroke-width': 1 });
    const label = mk('text', { x: plotL + 6, y: Math.min(plotB - 4, yMin + 13), 'font-size': 10.5, fill: 'var(--muted)', class: 'halo' }, 'Cheapest per agent · ' + fmt$(cheapest)) as SVGTextElement;
    if (label.getComputedTextLength() > (plotR - plotL) * 0.4) label.textContent = 'Cheapest ' + fmt$(cheapest);
  }

  // Grid and axes.
  const thin = (vals: number[], px: (v: number) => number, gap: number) => {
    const kept: number[] = [];
    vals.forEach((v) => { if (!kept.length || Math.abs(px(v) - px(kept[kept.length - 1])) >= gap) kept.push(v); });
    return kept;
  };
  thin(logTicks(x0, x1), X, 46).forEach((v) => {
    mk('line', { x1: X(v), x2: X(v), y1: plotT, y2: plotB, stroke: 'var(--line)', 'stroke-width': 1 });
    mk('text', { x: X(v), y: plotB + 15, 'font-size': 10.5, 'text-anchor': 'middle', fill: 'var(--muted)' }, fmtAxis$(v));
  });
  thin(logTicks(y0, y1), Y, 22).forEach((v) => {
    mk('line', { x1: plotL, x2: plotR, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': 1 });
    mk('text', { x: plotL - 6, y: Y(v) + 3.5, 'font-size': 10.5, 'text-anchor': 'end', fill: 'var(--muted)' }, fmtAxis$(v));
  });
  mk('text', { x: (plotL + plotR) / 2, y: H - 6, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--muted)', class: 'axis-title' }, 'One box over ' + years + (years === 1 ? ' year' : ' years') + ', purchase + power');
  mk('text', { x: 12, y: (plotT + plotB) / 2, 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--muted)', class: 'axis-title', transform: `rotate(-90 12 ${(plotT + plotB) / 2})` }, 'Per agent');

  // Iso-agent diagonals: per agent = total ÷ n.
  const placed: { x: number; y: number }[] = [];
  ISO_AGENTS.forEach((n) => {
    const xs = Math.max(x0, n * y0), xe = Math.min(x1, n * y1);
    if (xe <= xs * 1.001) return;
    const a = { x: X(xs), y: Y(xs / n) }, b = { x: X(xe), y: Y(xe / n) };
    mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.6 });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 80) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const px = b.x - Math.cos(ang) * 8, py = b.y - Math.sin(ang) * 8;
    if (placed.some((q) => Math.hypot(q.x - px, q.y - py) < 44)) return;
    placed.push({ x: px, y: py });
    mk('text', { x: px, y: py - 4, 'font-size': 10, 'text-anchor': 'end', fill: 'var(--muted)', class: 'halo', transform: `rotate(${ang * 180 / Math.PI} ${px} ${py})` }, n + (n === 1 ? ' agent' : ' agents'));
  });

  // Frontier: the lowest per-agent cost available at or below each total.
  const line = plotted.filter((p) => front.has(p.id)).sort((p, q) => p.total - q.total);
  if (line.length > 1) {
    mk('polyline', { points: line.map((p) => X(p.total) + ',' + Y(p.perAgent)).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, opacity: 0.55, 'stroke-linejoin': 'round' });
  }

  // Points, with a 24px hit target each. Frontier points draw last so they sit on top.
  const labels: { p: CostPoint; text: string }[] = [];
  [...plotted].sort((p, q) => Number(front.has(p.id)) - Number(front.has(q.id))).forEach((p) => {
    const cx = X(p.total), cy = Y(p.perAgent);
    const owned = p.entry.condition === 'owned';
    const g = mk('g', { class: 'pt', tabindex: 0, role: 'img', 'data-id': p.id, 'aria-label': describe(p) });
    mk('circle', { cx, cy, r: 12, fill: 'transparent' }, undefined, g);
    if (p.id === selectedId) mk('circle', { cx, cy, r: 9, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }, undefined, g);
    mk('circle', { class: 'mark', cx, cy, r: owned ? 4.5 : 5, fill: owned ? 'var(--panel)' : 'var(--accent)', stroke: owned ? 'var(--accent)' : 'var(--panel)', 'stroke-width': 2 }, undefined, g);
    const show = () => { showTip(p, cx, cy, W, H); highlight(p.id, true); };
    const hide = () => { hideTip(); highlight(p.id, false); };
    g.addEventListener('pointerenter', show);
    g.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType === 'mouse') hide(); });
    g.addEventListener('focus', show);
    g.addEventListener('blur', hide);
    if (p.id === REFERENCE_ID) labels.push({ p, text: p.id === selectedId ? 'Your pick: 128 GB desktop' : '128 GB desktop' });
    else if (p.id === selectedId) labels.push({ p, text: 'Your pick' });
  });
  labels.forEach(({ p, text }) => {
    const cx = X(p.total), cy = Y(p.perAgent);
    const t = mk('text', { x: cx + 12, y: cy - 9, 'font-size': 11, 'font-weight': 600, fill: 'var(--ink)', class: 'halo', 'pointer-events': 'none' }, text) as SVGTextElement;
    // Flip to the left of the dot when the label would run past the plot.
    if (cx + 12 + t.getComputedTextLength() > plotR) { t.setAttribute('x', String(cx - 12)); t.setAttribute('text-anchor', 'end'); }
  });
}

const PRICE_LABEL: Record<CatalogEntry['priceKind'], string> = {
  report: 'report price', list: 'list price', asking: 'asking price', ebay: 'eBay median ask', yours: 'your price', owned: 'power only',
};
const CONDITION_LABEL: Record<Condition, string> = { new: 'New', used: 'Used', refurbished: 'Refurbished', owned: 'Owned' };

/** The provenance line for a machine: where its price came from, how fresh it is, and what is estimated. */
function provenance(e: CatalogEntry) {
  const parts = [CONDITION_LABEL[e.condition] + ' ' + FORM_LABEL[e.form].toLowerCase(), PRICE_LABEL[e.priceKind]];
  if (e.seen) parts.push(e.seen);
  if (e.powerEstimated) parts.push('power estimated');
  if (e.scoreEstimated) parts.push('scores estimated');
  return parts.join(' · ');
}

function describe(p: CostPoint) {
  return p.machine.name + ': ' + fmt$(p.perAgent) + ' per agent, ' + p.result.n + (p.result.n === 1 ? ' agent, ' : ' agents, ')
    + fmt$(p.total) + ' over ' + years + (years === 1 ? ' year' : ' years') + (p.entry.condition === 'owned' ? ' (power only)' : '')
    + ', ' + ratioText(p) + ' the cheapest per agent. ' + provenance(p.entry) + '.';
}

function showTip(p: CostPoint, cx: number, cy: number, W: number, H: number) {
  const tip = $('cost-tip');
  tip.textContent = '';
  const add = (tag: string, cls: string, text: string) => { const el = document.createElement(tag); el.className = cls; el.textContent = text; tip.appendChild(el); return el; };
  add('strong', 'tip-v', fmt$(p.perAgent) + ' per agent');
  add('span', 'tip-s', p.result.n + (p.result.n === 1 ? ' agent · ' : ' agents · ') + fmt$(p.total) + ' over ' + years + ' yr' + (p.entry.condition === 'owned' ? ', power only' : ''));
  add('span', 'tip-s', ratioText(p) + ' the cheapest per agent');
  add('span', 'tip-name', p.machine.name);
  add('span', 'tip-meta', provenance(p.entry));
  tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = cx + 16 + tw <= W ? cx + 16 : Math.max(0, cx - 16 - tw);
  tip.style.left = left + 'px';
  tip.style.top = Math.min(Math.max(0, cy - th / 2), H - th) + 'px';
}
function hideTip() { $('cost-tip').hidden = true; }

function highlight(id: string, on: boolean) {
  document.querySelectorAll(`#cost-chart .pt[data-id="${CSS.escape(id)}"], #cost-tbody tr[data-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.toggle('is-hot', on));
}

function renderTable() {
  const tb = $('cost-tbody'); tb.textContent = '';
  const byTotal = (p: CostPoint, q: CostPoint) => (p.result.n ? 0 : 1) - (q.result.n ? 0 : 1) || p.total - q.total;
  const groups: [string, CostPoint[]][] = [
    ['To buy', shown.filter((p) => p.entry.condition !== 'owned').sort(byTotal)],
    ['Already yours · power only', shown.filter((p) => p.entry.condition === 'owned').sort(byTotal)],
  ];
  groups.forEach(([title, list]) => {
    if (!list.length) return;
    const g = document.createElement('tr'); g.className = 'group';
    const gtd = document.createElement('td'); gtd.colSpan = 6; gtd.textContent = title; g.appendChild(gtd); tb.appendChild(g);
    list.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.id = p.id;
      if (p.id === selectedId) tr.className = 'is-selected';
      const name = document.createElement('td');
      const a = document.createElement('a');
      a.href = p.id === 'custom' ? BASE : BASE + '?preset=' + encodeURIComponent(p.id);
      a.textContent = p.machine.name;
      name.appendChild(a);
      const tags = [p.id === selectedId ? 'Your pick' : '', front.has(p.id) ? 'Best at this budget' : ''];
      tags.forEach((t) => { if (!t) return; const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = t; name.appendChild(tag); });
      tr.appendChild(name);
      [fmt$(p.total), String(p.result.n), fmt$(p.perAgent), ratioText(p)].forEach((t) => { const td = document.createElement('td'); td.className = 'n'; td.textContent = t; tr.appendChild(td); });
      const src = document.createElement('td'); src.className = 'src';
      const meta = document.createElement('span'); meta.textContent = provenance(p.entry); src.appendChild(meta);
      if (p.entry.source) {
        const link = document.createElement(p.entry.source.startsWith('http') ? 'a' : 'span');
        link.className = 'src-link';
        link.textContent = p.entry.source.startsWith('http') ? new URL(p.entry.source).hostname.replace(/^www\./, '') : 'research report';
        if (link instanceof HTMLAnchorElement) { link.href = p.entry.source; link.rel = 'noopener noreferrer'; link.target = '_blank'; }
        src.appendChild(link);
      }
      tr.appendChild(src);
      tr.addEventListener('mouseenter', () => highlight(p.id, true));
      tr.addEventListener('mouseleave', () => highlight(p.id, false));
      tb.appendChild(tr);
    });
  });
}

// ---- Filters ----
function wireFilters() {
  const seg = $('f-cond');
  seg.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return;
    filters.condition = b.dataset.v as ConditionFilter;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });
  $<HTMLSelectElement>('f-form').addEventListener('change', (e) => { filters.form = (e.target as HTMLSelectElement).value as FormFilter; render(); });
  $<HTMLSelectElement>('f-ram').addEventListener('change', (e) => { filters.minRam = Number((e.target as HTMLSelectElement).value); render(); });
  $<HTMLInputElement>('f-max').addEventListener('input', (e) => { const v = Number((e.target as HTMLInputElement).value); filters.maxTotal = v > 0 ? v : null; render(); });
  $<HTMLInputElement>('show-owned').addEventListener('change', (e) => { filters.owned = (e.target as HTMLInputElement).checked; render(); });
}

// ---- Your machines ----
function renderYours() {
  const ul = $('yours-list'); ul.textContent = '';
  const list = readUserListings();
  list.forEach((l) => {
    const li = document.createElement('li');
    const txt = document.createElement('span');
    txt.textContent = l.name + ' · ' + (l.condition === 'owned' ? 'owned' : fmt$(l.price));
    const del = document.createElement('button'); del.type = 'button'; del.className = 'btn'; del.textContent = 'Remove';
    del.setAttribute('aria-label', 'Remove ' + l.name);
    del.addEventListener('click', () => { writeUserListings(readUserListings().filter((x) => x.id !== l.id)); refresh(); $('yours-msg').textContent = 'Removed ' + l.name + '.'; });
    li.append(txt, del);
    ul.appendChild(li);
  });
  if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'None yet. Machines you add appear on the chart and in the calculator.'; ul.appendChild(li); }
  $<HTMLButtonElement>('export').disabled = !list.length;
}

function wireForm() {
  const dl = $('cpu-list');
  [...CPUS].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => { const o = document.createElement('option'); o.value = c.name; dl.appendChild(o); });
  const cpu = $<HTMLInputElement>('a-cpu'), st = $<HTMLInputElement>('a-st'), mt = $<HTMLInputElement>('a-mt');
  cpu.addEventListener('input', () => { const c = matchCpu(cpu.value); if (c) { st.value = String(c.st); mt.value = String(c.mt); } });
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) => $<HTMLInputElement>(id).value.trim();
    const candidate = {
      id: 'u-' + Date.now().toString(36), name: val('a-name'), cpuName: val('a-cpu'),
      st: Number(val('a-st')), mt: Number(val('a-mt')), ram: Number(val('a-ram')), price: val('a-price') === '' ? NaN : Number(val('a-price')),
      condition: $<HTMLSelectElement>('a-cond').value, form: $<HTMLSelectElement>('a-form').value as Form, link: val('a-link'),
      added: new Date().toISOString().slice(0, 10),
    };
    if (candidate.condition === 'owned' && isNaN(candidate.price)) candidate.price = 0;
    const l = validListing(candidate);
    if (!l) {
      const missing = [!candidate.cpuName && 'processor', !(candidate.st > 0) && 'single-thread score', !(candidate.mt > 0) && 'multi-thread score', !(candidate.ram > 0) && 'memory', !(candidate.price >= 0) && 'price'].filter(Boolean);
      const list = missing.length > 1 ? missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1] : missing[0] || 'missing fields';
      $('a-error').textContent = 'Fill in the ' + list + '.';
      $('yours-msg').textContent = '';
      return;
    }
    $('a-error').textContent = '';
    writeUserListings([...readUserListings(), l]);
    ($('add-form') as HTMLFormElement).reset();
    refresh();
    $('yours-msg').textContent = 'Added ' + l.name + ' to the chart.';
  });
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ listings: readUserListings() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'agent-slot-listings.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $<HTMLInputElement>('import').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      const { listings, dropped } = parseImport(await file.text());
      const have = new Set(readUserListings().map((l) => l.id));
      const added = listings.filter((l) => !have.has(l.id));
      writeUserListings([...readUserListings(), ...added]);
      refresh();
      $('yours-msg').textContent = 'Imported ' + added.length + (added.length === 1 ? ' machine' : ' machines') + (dropped ? '; skipped ' + dropped + ' incomplete.' : '.');
    } catch (err) {
      $('yours-msg').textContent = "That file isn't a listings export.";
    }
    input.value = '';
  });
}

function refresh() { load(); render(); renderYours(); }

function init() {
  wireFilters();
  wireForm();
  refresh();
  new ResizeObserver(() => { if (Math.round($('cost-chart-wrap').clientWidth) !== drawnWidth) draw(); }).observe($('cost-chart-wrap'));
  // Coming back from the calculator through the back/forward cache: pick up its new settings.
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
}
init();
