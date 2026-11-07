/** Build page controller: renders the model, spins it, wires the explode, lid, view and part controls, and swaps parts. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from '../lib/build/scene';
import { buildTotal, buildWarnings, chosen, DEFAULT_CONFIG, partPrice, SLOTS, withChassis, type BuildPart, type Config } from '../data/build';
import { checkFit, chassisOf, layout } from '../lib/build/layout';
import { fmt$ } from '../lib/format';
import { readSettings } from '../lib/settings';

const view = document.getElementById('view') as HTMLElement;
const noWebgl = document.getElementById('no-webgl') as HTMLElement;
const spin = document.getElementById('spin') as HTMLInputElement;
const explode = document.getElementById('explode') as HTMLInputElement;
const lidBox = document.getElementById('lid') as HTMLInputElement;
const info = document.getElementById('part-info') as HTMLElement;
const partList = document.getElementById('part-list') as HTMLElement;
const settings = readSettings();
const config: Config = { ...DEFAULT_CONFIG };

const priceText = (p: BuildPart) => {
  const v = partPrice(p, settings);
  if (v == null) return 'No price';
  return p.priceLabel ?? `${p.estimated ? 'est. ' : ''}${fmt$(v)}`;
};
const link = (href: string, text: string) => `<a href="${href}" rel="noopener" target="_blank">${text}</a>`;

/** The panels that follow the chosen parts. They don't need WebGL. */
function renderPanels() {
  const fit = checkFit(layout(config), config);
  const problems = fit.overlaps.length + fit.outside.length;
  const pill = document.getElementById('fit-pill') as HTMLElement;
  pill.dataset.state = problems ? 'bad' : 'ok';
  pill.textContent = problems ? `${problems} problem${problems > 1 ? 's' : ''}` : 'Nothing overlaps';
  const flag = (state: string, text: string) => `<li data-state="${state}">${text}</li>`;
  (document.getElementById('fit-flags') as HTMLElement).innerHTML = [
    ...fit.overlaps.map(([a, b]) => flag('bad', `${a} overlaps ${b}`)),
    ...fit.outside.map((id) => flag('bad', `${id} pokes outside the chassis`)),
    ...fit.gaps.map((g) => flag(g.mm < 15 ? 'warn' : 'ok', `${g.label}: ${g.mm} mm`)),
  ].join('');

  (document.getElementById('swap-warnings') as HTMLElement).innerHTML = buildWarnings(config).map((w) => flag('warn', w)).join('');

  // The dropdowns follow the config: a chassis sets some parts, and offers only the parts that suit it.
  document.querySelectorAll<HTMLSelectElement>('#swaps select').forEach((el) => {
    const slot = SLOTS.find((s) => s.id === el.dataset.slot)!;
    el.disabled = (!!slot.requires && !config[slot.requires]) || !slot.parts.some((p) => !p.chassis || p.chassis === config.chassis);
    for (const o of el.options) {
      const only = slot.parts.find((p) => p.id === o.value)?.chassis;
      o.hidden = o.disabled = !!only && only !== config.chassis;
    }
    el.value = config[el.dataset.slot!] ?? '';
  });

  const rows = chosen(config);
  const { total, unpriced } = buildTotal(config, settings);
  (document.getElementById('build-total') as HTMLElement).textContent =
    `${rows.length} parts · ${fmt$(total)} total${unpriced ? `, ${unpriced} unpriced` : ''}`;
  (document.getElementById('parts-body') as HTMLElement).innerHTML = rows.map(({ part: p }) =>
    `<tr><td>${link(p.url, p.name)}</td><td>${p.spec}</td><td class="n">${p.size}</td><td class="n">${link(p.priceUrl ?? p.url, priceText(p))}</td><td>${[p.note, p.priceNote].filter(Boolean).join(' ')}</td></tr>`).join('');
  partList.innerHTML = rows.map(({ slot, part }) =>
    `<li><button type="button" class="btn" data-part="${slot.id}" aria-pressed="false">${part.name}</button></li>`).join('');
}
renderPanels();

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  noWebgl.hidden = false;
  document.querySelector<HTMLElement>('.build-side')!.hidden = true;
  document.getElementById('swaps')!.hidden = true;
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
const camera = new THREE.PerspectiveCamera(32, 1, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.62;
controls.enableDamping = true;
controls.autoRotateSpeed = 1.2;

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(400, 900, 500);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -450;
key.shadow.camera.right = key.shadow.camera.top = 450;
key.shadow.camera.near = 100;
key.shadow.camera.far = 2500;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(-700, 300, -500);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.ShadowMaterial({ opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

let model = buildModel(config);
scene.add(model.group);

const VIEWS: Record<string, [number, number, number]> = {
  iso: [520, 500, 680],
  'rear-iso': [-520, 400, -760],
  front: [0, 200, 1200],
  rear: [0, 200, -1200],
  top: [0, 1300, 1],
};
const VIEW_ASPECT = 1.5;
const fit = () => Math.max(1, VIEW_ASPECT / camera.aspect);
let currentView = 'iso';
function setView(name: string) {
  currentView = name;
  const p = VIEWS[name] ?? VIEWS.iso;
  const C = chassisOf(config);
  // An undamped update clears any glide left from the last drag, which would otherwise carry on past the preset.
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
  controls.target.set(0, C.targetY, 0);
  camera.position.set(p[0], p[1], p[2]).sub(controls.target).multiplyScalar(fit() * C.frame).add(controls.target);
  controls.update();
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
spin.checked = !reduceMotion;
controls.autoRotate = spin.checked;
spin.addEventListener('change', () => (controls.autoRotate = spin.checked));
controls.addEventListener('start', () => {
  spin.checked = false;
  controls.autoRotate = false;
});

explode.addEventListener('input', () => model.setExplode(Number(explode.value) / 100));
model.setExplode(Number(explode.value) / 100);
lidBox.addEventListener('change', () => model.setLid(lidBox.checked));
model.setLid(lidBox.checked);
document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view!)));

// Part highlight: from the list, or by clicking the model.
const accent = new THREE.Color(token('--accent'));
let selected: string | undefined;
const black = new THREE.Color(0);
function select(part: string | undefined) {
  selected = part;
  for (const [id, objs] of model.byPart) {
    for (const o of objs) {
      o.traverse((m) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat?.emissive) {
          mat.emissive.copy(id === part ? accent : black);
          mat.emissiveIntensity = 0.45;
        }
      });
    }
  }
  partList.querySelectorAll<HTMLButtonElement>('button[data-part]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.part === part)));
  const p = chosen(config).find((x) => x.slot.id === part)?.part;
  info.innerHTML = p
    ? `<strong>${p.name}</strong><span>${p.spec}</span><span class="mono">${p.size} mm</span>${p.note ? `<span>${p.note}</span>` : ''}<span>${priceText(p)}. ${p.priceNote}</span>${link(p.url, 'Where to get it')}${p.source ? link(p.source, 'Source') : ''}`
    : '<span>Click a part in the model or the list.</span>';
}
partList.addEventListener('click', (e) => {
  const part = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-part]')?.dataset.part;
  if (part) select(selected === part ? undefined : part);
});
select(undefined);

// Swapping a part rebuilds the model, keeping the explode, lid and selection; a new chassis also reframes the camera.
document.getElementById('swaps')!.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  const slot = el.dataset.slot!;
  if (slot === 'chassis') Object.assign(config, withChassis(config, el.value));
  else config[slot] = el.value || null;
  renderPanels();
  scene.remove(model.group);
  model.dispose();
  model = buildModel(config);
  scene.add(model.group);
  model.setExplode(Number(explode.value) / 100);
  model.setLid(lidBox.checked);
  select(selected && model.byPart.has(selected) ? selected : undefined);
  if (slot === 'chassis') setView(currentView);
});

const ray = new THREE.Raycaster();
let down: [number, number] | undefined;
renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(model.group.children, true).find((h) => h.object.userData.part !== 'chassis');
  select(hit ? hit.object.userData.part : undefined);
});

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  const before = fit();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Limits and the far plane scale with the distance, so a clamp can't lose zoom across a resize.
  controls.minDistance = 250 * fit();
  controls.maxDistance = 2500 * fit();
  camera.far = 6000 * fit();
  camera.updateProjectionMatrix();
  camera.position.sub(controls.target).multiplyScalar(fit() / before).add(controls.target);
}
new ResizeObserver(resize).observe(view);
resize();
setView('iso');

// Test hook: e2e/build.spec.ts reads the camera state instead of comparing slow software-WebGL frames.
Object.assign(window, { __build: { camera, controls, model: () => model } });

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
