/** Detailed geometry for each layout box. A builder gets the box size (w, h, d in mm) and returns a group
 *  centred on the box, in world axes (x right, y up, z toward the front). */
import * as THREE from 'three';
import { slotX, type Chassis } from './layout';

type Size = [number, number, number];
type Builder = (s: Size, id: string, C: Chassis) => THREE.Object3D;

const std = (color: number, roughness = 0.6, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const STEEL = () => std(0x1c1f23, 0.45, 0.7);
const BODY = (C: Chassis) => std(C.body, 0.45, 0.7);
const ALU = () => std(0x9ea4ad, 0.35, 0.85);
const BLACK_PLASTIC = () => std(0x15171a, 0.7);
const PCB = () => std(0x14181c, 0.8);
const GREEN_PCB = () => std(0x1d5a3a, 0.8);

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
/** Cylinder along the z axis. */
function cylZ(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 32): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}
function cylX(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, x, y, z);
  m.rotation.z = Math.PI / 2;
  return m;
}

/** A plate in the x-y plane with rectangular and round holes, extruded `t` along z and centred. */
function plate(w: number, h: number, t: number, mat: THREE.Material, holes: { rect?: [number, number, number, number]; circle?: [number, number, number] }[] = []): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2).lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).closePath();
  for (const hole of holes) {
    const p = new THREE.Path();
    if (hole.rect) {
      const [x0, y0, x1, y1] = hole.rect;
      p.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).closePath();
    } else if (hole.circle) {
      p.absarc(hole.circle[0], hole.circle[1], hole.circle[2], 0, Math.PI * 2, true);
    }
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  return mesh(geo, mat);
}

/** Repeating hole pattern as an alpha map: 1 = metal, 0 = hole. */
function holeAlpha(hexagonal: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#000';
  const dots: [number, number][] = hexagonal ? [[8, 8], [24, 8], [16, 22], [0, 22], [32, 22]] : [[16, 16]];
  for (const [x, y] of dots) {
    g.beginPath();
    g.arc(x, y, hexagonal ? 7 : 9, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** A see-through perforated sheet. */
function perforated(w: number, h: number, cellMm: number, color: number, hexagonal = true): THREE.Mesh {
  const alpha = holeAlpha(hexagonal);
  alpha.repeat.set(w / cellMm, h / cellMm);
  const m = mesh(new THREE.PlaneGeometry(w, h), std(color, 0.5, 0.6, { alphaMap: alpha, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }));
  m.castShadow = false;
  return m;
}

/** Radiator fin texture: fine dark stripes. */
function finMap(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2d31';
  g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#0d0e10';
  g.fillRect(3, 0, 2, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Fan with its axis along z, blades facing +z. */
function fan(size: number, thick: number, frameColor: number, bladeColor: number): THREE.Group {
  const g = new THREE.Group();
  const r = size / 2 - 2.5;
  const frame = plate(size, size, thick, std(frameColor, 0.7), [{ circle: [0, 0, r] }]);
  g.add(frame);
  // Rubber corner pads.
  const pad = std(0x202022, 0.9);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(cylZ(size * 0.05, thick + 0.4, pad, sx * (size / 2 - size * 0.065), sy * (size / 2 - size * 0.065)));
  // Rear struts and motor.
  const strutMat = std(frameColor, 0.7);
  for (let i = 0; i < 4; i++) {
    const s = box(r * 0.95, 2, 3, strutMat, 0, 0, -thick / 2 + 2);
    s.rotation.z = Math.PI / 4 + (i * Math.PI) / 2;
    s.position.x = Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * r * 0.48;
    s.position.y = Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * r * 0.48;
    g.add(s);
  }
  const hubR = size * 0.19;
  g.add(cylZ(hubR * 0.9, thick - 5, std(0x2b2e33, 0.6), 0, 0, -1));
  g.add(cylZ(hubR, 6, std(bladeColor, 0.55), 0, 0, thick / 2 - 4.5));
  // Blades.
  const blades = size >= 100 ? 7 : 9;
  const len = r - hubR - 1;
  const bladeMat = std(bladeColor, 0.55, 0, { side: THREE.DoubleSide });
  for (let i = 0; i < blades; i++) {
    const b = box(len, 1.2, len * 0.62, bladeMat, hubR + len / 2, 0, 0);
    b.rotation.x = -0.6;
    const holder = new THREE.Group();
    holder.add(b);
    holder.rotation.z = (i / blades) * Math.PI * 2;
    holder.position.z = thick / 2 - 7;
    g.add(holder);
  }
  return g;
}

function radiator([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const tank = 24;
  const core = w - tank * 2;
  const map = finMap();
  map.repeat.set(core / 1.6, 1);
  const fins = std(0x222529, 0.9, 0.3, { map });
  g.add(box(core, h - 4, d - 2, fins));
  const tankMat = std(0x101214, 0.4, 0.6);
  g.add(box(tank, h, d, tankMat, -w / 2 + tank / 2, 0, 0));
  g.add(box(tank, h, d, tankMat, w / 2 - tank / 2, 0, 0));
  g.add(box(core, 3, d, tankMat, 0, h / 2 - 1.5, 0));
  g.add(box(core, 3, d, tankMat, 0, -h / 2 + 1.5, 0));
  // Fittings on the right tank, facing the board.
  for (const dy of [-14, 14]) g.add(cylZ(5, 12, ALU(), w / 2 - 12, dy, -d / 2 - 5));
  return g;
}

function pump([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const body = std(0x202327, 0.5, 0.2);
  // Cold plate and the mounting frame, then the pump body with the small VRM fan on top.
  g.add(box(w * 0.55, 3, d * 0.55, std(0xb87333, 0.3, 0.9), 0, -h / 2 + 1.5, 0));
  g.add(box(w * 0.68, 8, d * 0.68, body, 0, -h / 2 + 7, 0));
  g.add(box(w, h - 30, d * 0.9, body, 0, -h / 2 + 11 + (h - 30) / 2, 0));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.32, 14, 32), std(0x2a2e33, 0.4, 0.3));
  top.position.y = h / 2 - 7 - 6;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  const f = fan(44, 10, 0x1a1c1f, 0x2d3136);
  f.rotation.x = -Math.PI / 2;
  f.position.y = h / 2 - 5;
  g.add(f);
  // Tube ports on the front face.
  for (const dx of [-11, 11]) g.add(cylZ(6, 12, ALU(), dx, h / 2 - 22, d / 2 + 2));
  return g;
}

function heatsinkFins(w: number, h: number, d: number, along: 'x' | 'z', pitch = 2.4): THREE.Group {
  const g = new THREE.Group();
  const mat = ALU();
  g.add(box(w, 3, d, mat, 0, -h / 2 + 1.5, 0));
  const span = along === 'x' ? w : d;
  const n = Math.floor(span / pitch);
  for (let i = 0; i < n; i++) {
    const p = -span / 2 + pitch / 2 + i * pitch;
    g.add(along === 'x' ? box(1, h - 3, d, mat, p, 1.5, 0) : box(w, h - 3, 1, mat, 0, 1.5, p));
  }
  return g;
}

function gpu([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const shroud = std(0x1b1d20, 0.45, 0.3);
  const gold = std(0xb9933d, 0.35, 0.8);
  // Card PCB at the slot side (+x), blower shroud filling the rest.
  g.add(box(1.6, h, d, PCB(), w / 2 - 0.8, 0, 0));
  g.add(box(w - 1.6, h - 2, d, shroud, -0.8, 0, 0));
  g.add(box(1.5, 6, d, gold, -w / 2 + 0.75, h / 2 - 4, 0));
  g.add(box(w - 1.6, 1.5, 6, gold, -0.8, h / 2 - 1.25, d / 2 - 3));
  g.add(box(1.5, h - 12, d * 0.3, gold, -w / 2 + 0.75, -2, -d * 0.3));
  // Blower intake at the front end, and the exhaust grille facing the bracket.
  const intake = cylX(h * 0.36, 2, std(0x0a0b0c, 0.9), -w / 2 + 1, -h * 0.05, d / 2 - h * 0.42);
  g.add(intake);
  const vent = perforated(w - 6, h - 10, 3, 0x2a2d31);
  vent.position.z = -d / 2 - 0.5;
  g.add(vent);
  return g;
}

function nic([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6, h, d, GREEN_PCB(), w / 2 - 0.8, 0, 0));
  const hs = heatsinkFins(12, 14, 24, 'z', 2);
  hs.rotation.z = Math.PI / 2;
  hs.position.set(w / 2 - 1.6 - 7, h * 0.05, d * 0.15);
  g.add(hs);
  // Two SFP28 cages at the bracket end.
  const cage = std(0x8d9299, 0.4, 0.8);
  for (const dy of [-h * 0.25, h * 0.12]) g.add(box(14, 12, 48, cage, w / 2 - 1.6 - 7, dy, -d / 2 + 20));
  return g;
}

/** Grey printed shroud over the card's -x face: a fan in a through-hole near the far end, as in the photos. */
function nicShroud([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const fanZ = d / 2 - 33; // 157 mm from the bracket
  const fanY = -7.5;
  const body = plate(d, h, w, std(0x8d9096, 0.85), [{ circle: [-fanZ, fanY, 20] }]);
  body.rotation.y = Math.PI / 2;
  g.add(body);
  const f = fan(40, 10, 0xb9a27c, 0x6a2a28);
  f.rotation.y = -Math.PI / 2;
  f.position.set(-w / 2 + 5.5, fanY, fanZ);
  g.add(f);
  return g;
}

function psu([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const body = std(0x121416, 0.5, 0.5);
  g.add(box(w, h, d, body));
  // 92 mm fan behind a grille, on the face toward the board.
  const fanSize = Math.min(h, d) - 8;
  const f = fan(fanSize, 10, 0x121416, 0x2a2d31);
  f.rotation.y = -Math.PI / 2;
  f.position.x = -w / 2 - 1;
  g.add(f);
  const grille = perforated(fanSize + 4, fanSize + 4, 4, 0x1e2124, false);
  grille.rotation.y = Math.PI / 2;
  grille.position.x = -w / 2 - 6.5;
  g.add(grille);
  // Modular sockets on the front face, IEC inlet and switch at the back.
  const sock = std(0x0b0c0d, 0.8);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.add(box(20, 9, 2, sock, -w / 2 + 14 + c * 24, h / 2 - 20 - r * 16, d / 2 + 1));
  g.add(box(24, 18, 2, sock, 0, -h / 2 + 18, -d / 2 - 1));
  g.add(box(12, 10, 2, std(0xc0392b, 0.6), -w / 2 + 12, -h / 2 + 18, -d / 2 - 1));
  const vent = perforated(w - 6, h - 40, 3, 0x1e2124);
  vent.position.z = -d / 2 - 0.3;
  vent.position.y = 10;
  g.add(vent);
  return g;
}

function ram([w, h, d]: Size, id: string): THREE.Group {
  const g = new THREE.Group();
  // The 128 GB kit is lighter, so a swap shows in the model; its heatsink shape is not modelled.
  const spreader = id.startsWith('kit-') ? std(0x6b7078, 0.5, 0.7) : std(0x121314, 0.55, 0.4);
  g.add(box(w, 4, 1.6, GREEN_PCB(), 0, -h / 2 + 2, 0));
  g.add(box(w, h - 4, d, spreader, 0, 2, 0));
  g.add(box(w * 0.7, 3, d + 0.6, std(0x3a3d42, 0.5, 0.5), 0, h / 2 - 6, 0));
  return g;
}

function cpu([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 1.4, d, GREEN_PCB(), 0, -h / 2 + 0.7, 0));
  g.add(box(w * 0.78, h - 1.4, d * 0.8, std(0xb8bcc2, 0.35, 0.9), 0, 0.7, 0));
  return g;
}

function socket([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  const frame = plate(w, d, 3, std(0x9a9ea5, 0.4, 0.8), [{ rect: [-w * 0.42, -d * 0.4, w * 0.42, d * 0.4] }]);
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = h / 2 - 1.5;
  g.add(frame);
  g.add(box(w, h - 3, d, std(0x0d0e10, 0.8), 0, -1.5, 0));
  g.add(box(2.5, 2.5, d * 0.9, std(0x9a9ea5, 0.4, 0.8), w / 2 + 2, h / 2 - 1, 0));
  return g;
}

function ssd([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 1.2, d, std(0x1a2a38, 0.8), 0, -h / 2 + 0.6, 0));
  const chip = std(0x0e0f10, 0.6);
  for (const z of [-d * 0.3, 0, d * 0.3]) g.add(box(w * 0.75, h - 1.2, 14, chip, 0, 0.6, z));
  return g;
}

function dimmSlot([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, BLACK_PLASTIC()));
  g.add(box(w - 10, 1.2, 1.8, std(0x2a2d31), 0, h / 2 - 0.6, 0));
  for (const s of [-1, 1]) g.add(box(5, h + 4, d + 2, std(0x8f939a, 0.6), s * (w / 2 - 2.5), 2, 0));
  return g;
}

function pcieSlot([w, h, d]: Size, id: string): THREE.Group {
  const g = new THREE.Group();
  const x16 = id === 'pcie-1';
  g.add(box(w, h, d, x16 ? std(0x8a8e94, 0.4, 0.8) : BLACK_PLASTIC()));
  g.add(box(1.5, 1, d - 6, std(0x0a0a0b), 0, h / 2, -3));
  return g;
}

function ioShroud([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  // Plastic cover over the ports, and the ports themselves on the rear face.
  g.add(box(w, h - 26, d, std(0x2e3238, 0.6), 0, 13, 0));
  const silver = std(0xa7abb2, 0.4, 0.8);
  const dark = std(0x0d0e10, 0.8);
  let x = -w / 2 + 6;
  const port = (pw: number, ph: number, mat: THREE.Material, y: number) => {
    g.add(box(pw, ph, 14, mat, x + pw / 2, -h / 2 + y + ph / 2, -d / 2 + 7));
  };
  port(14, 7, silver, 2); port(14, 7, silver, 10); x += 17;
  port(14, 7, silver, 2); port(14, 7, silver, 10); x += 17;
  port(9, 4, silver, 2); port(9, 4, silver, 8); x += 12;
  port(16, 14, dark, 2); x += 19;
  port(14, 7, silver, 2); port(14, 7, silver, 10); x += 17;
  port(16, 14, dark, 2); x += 20;
  for (const c of [0xdb6f1d, 0x2b8d5a, 0x3b74c8]) { g.add(cylZ(3, 14, std(c, 0.5), x + 4, -h / 2 + 8, -d / 2 + 7)); x += 10; }
  for (const dx of [0, 10]) g.add(cylZ(2.5, 16, std(0xb9933d, 0.3, 0.9), x + dx + 3, -h / 2 + 8, -d / 2 + 8));
  return g;
}

function atx24([w, h, d]: Size): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, BLACK_PLASTIC()));
  const pin = std(0x8a8e94, 0.4, 0.8);
  for (let i = 0; i < 12; i++) for (const z of [-d * 0.25, d * 0.25]) g.add(box(1, 3, 1, pin, -w / 2 + 2.5 + i * (w - 5) / 11, h / 2 - 1.5, z));
  return g;
}

/** Rear sheet with the chassis's openings and its eight slot openings. */
function rear([w, h, d]: Size, _id: string, C: Chassis): THREE.Mesh {
  const y = (mm: number) => mm - h / 2;
  const holes: Parameters<typeof plate>[4] = C.rearHoles.map((o) =>
    o.rect ? { rect: [o.rect[0], y(o.rect[1]), o.rect[2], y(o.rect[3])] } : { circle: [o.circle![0], y(o.circle![1]), o.circle![2]] });
  for (let k = 0; k < 8; k++) holes.push({ rect: [slotX(C, k) - 9.5, y(C.slotY[0]), slotX(C, k) + 9.5, y(C.slotY[1])] });
  return plate(w, h, d, BODY(C), holes);
}

/** Builders by box id, then by id prefix. */
const BY_ID: Record<string, Builder> = {
  radiator, pump, gpu, nic, psu, cpu, socket, ssd, atx24,
  'nic-shroud': nicShroud,
  'io-shroud': ioShroud,
  eps: atx24,
  'vrm-top': ([w, h, d]) => heatsinkFins(w, h, d, 'x'),
  'vrm-right': ([w, h, d]) => heatsinkFins(w, h, d, 'z'),
  'm2a-heatsink': ([w, h, d]) => heatsinkFins(w, h, d, 'z', 3),
  'm2-shroud': ([w, h, d]) => box(w, h, d, std(0x3a3e45, 0.35, 0.8)),
  'm2-plate': ([w, h, d]) => box(w, h, d, std(0x3a3e45, 0.35, 0.8)),
  pcb: ([w, h, d]) => box(w, h, d, PCB()),
  'front-io': ([w, h, d]) => box(w, h, d, GREEN_PCB()),
  front: ([w, h]) => perforated(w, h, 6, 0x1c1f23),
  lid: ([w, h, d], _, C) => box(w, h, d, BODY(C)),
  floor: ([w, h, d], _, C) => box(w, h, d, BODY(C)),
  'wall-l': ([w, h, d], _, C) => box(w, h, d, BODY(C)),
  'wall-r': ([w, h, d], _, C) => box(w, h, d, BODY(C)),
  'bar-mid': ([w, h, d]) => box(w, h, d, ALU()),
  'bar-wall': ([w, h, d]) => box(w, h, d, ALU()),
  rear,
  ears: ([w, h, d]) => {
    const g = new THREE.Group();
    const ear = (x: number) => g.add(plate(27, h, d, STEEL(), [{ rect: [-6, h / 2 - 28, 6, h / 2 - 14] }, { rect: [-6, -h / 2 + 14, 6, -h / 2 + 28] }]).translateX(x));
    ear(-w / 2 + 13.5);
    ear(w / 2 - 13.5);
    return g;
  },
};
const BY_PREFIX: [string, Builder][] = [
  ['push-', ([w, , d]) => fan(w, d, 0x141618, 0x232629)],
  ['pull-', ([w, , d]) => fan(w, d, 0x141618, 0x232629)],
  ['bracket-', ([w, , d]) => fan(w, d, 0x141618, 0x232629)],
  ['rear-fan-', ([w, , d]) => fan(w, d, 0x5f4537, 0xc9b79a)],
  ['rear-p8-', ([w, , d]) => fan(w, d, 0x141618, 0x232629)],
  ['rear-r8-', ([w, , d]) => fan(w, d, 0x3a3d42, 0x7c8087)],
  ['ram-', ram],
  ['kit-', ram],
  ['dimm-', dimmSlot],
  ['pcie-', pcieSlot],
  ['handle', ([w, h, d]) => {
    const g = new THREE.Group();
    const m = STEEL();
    g.add(box(w, 8, d, m, 0, h / 2 - 4, 0));
    g.add(box(w, 8, d, m, 0, -h / 2 + 4, 0));
    g.add(box(w, h, 6, m, 0, 0, d / 2 - 3));
    return g;
  }],
  ['cover-', ([w, h, d]) => {
    const g = new THREE.Group();
    g.add(box(w, h, d, STEEL()));
    const v = perforated(w - 4, h - 30, 3, 0x2a2d31);
    v.position.z = -d / 2 - 0.3;
    g.add(v);
    return g;
  }],
  ['gpu-bracket', ([w, h, d]) => {
    const g = new THREE.Group();
    g.add(box(w, h, d, ALU()));
    for (let i = 0; i < 4; i++) g.add(box(w + 1, 6, 2, std(0x0a0b0c, 0.8), 0, h / 2 - 20 - i * 18, 0));
    return g;
  }],
  ['nic-bracket', ([w, h, d]) => {
    const g = new THREE.Group();
    g.add(box(w, h, d, ALU()));
    return g;
  }],
];

export function buildPart(id: string, size: Size, C: Chassis): THREE.Object3D {
  const b = BY_ID[id] ?? BY_PREFIX.find(([p]) => id.startsWith(p))?.[1];
  if (!b) throw new Error(`No builder for part ${id}`);
  return b(size, id, C);
}
