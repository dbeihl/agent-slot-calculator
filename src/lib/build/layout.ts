/** Where every part sits inside the chassis, as axis-aligned boxes in mm.
 *
 *  Axes: x runs left to right as seen from the front, y is up from the chassis floor, z runs toward the front
 *  (the front face is at z = +D/2, the rear face at z = -D/2). The origin is the middle of the floor, so the
 *  model spins about its centre. `checkFit` is the clearance check; `test/build.test.ts` runs it.
 */

import type { Config } from '../../data/build';

export type Kind = 'solid' | 'shell';

export interface Box {
  id: string;
  /** Part id from `src/data/build.ts`, used for picking and highlight. */
  part: string;
  kind: Kind;
  min: [number, number, number];
  max: [number, number, number];
  /** Where the box moves to at full explode. */
  explode: [number, number, number];
  /** Part this box wraps, so the two can share volume. */
  on?: string;
}

const T = 1.2; // sheet thickness
const EARS = 482.6;
const SLOT_PITCH = 20.32;

/** What differs between the chassis, in mm. x and z are model axes; heights are up from the floor. */
export interface Chassis {
  W: number;
  H: number;
  D: number;
  /** How far the board's I/O edge sits in from the right exterior wall. */
  io: number;
  /** Bottom and top of the slot openings. */
  slotY: [number, number];
  /** Centre of the fan row, across and up, and the gap from the front face to the first fan. */
  fanX: number[];
  fanY: number;
  fanWall: number;
  /** Centre line of the PSU opening. */
  psuX: number;
  rearFanX: number[];
  rearFanY: number;
  /** Rear sheet openings other than the slots. */
  rearHoles: { rect?: [number, number, number, number]; circle?: [number, number, number] }[];
  /** Body colour for the model. */
  body: number;
  /** Camera aim height and distance multiplier, so each chassis fills the view. */
  targetY: number;
  frame: number;
}

const CHASSIS: Record<string, Chassis> = {
  rackchoice: {
    W: 428, H: 133, D: 400, io: 104, slotY: [9, 127],
    fanX: [-132, -12, 108], fanY: 66, fanWall: 15,
    psuX: 165.75, rearFanX: [2, 68], rearFanY: 94,
    rearHoles: [{ rect: [-46, 9, 113, 60] }, { rect: [134, 3, 198, 120] }, { circle: [2, 94, 29] }, { circle: [68, 94, 29] }],
    body: 0x1c1f23, targetY: 60, frame: 1,
  },
  // Rear positions scaled off Rosewill's square-on rear photo; the radiator stack is scaled from photos of a built one.
  rosewill: {
    W: 430, H: 176.5, D: 600, io: 108, slotY: [23, 120],
    fanX: [-120, 0, 120], fanY: 88, fanWall: 15,
    psuX: 164.75, rearFanX: [-5, 75], rearFanY: 120,
    rearHoles: [{ rect: [-49, 12, 112, 63] }, { rect: [122, 3, 207.5, 153] }, { circle: [-5, 120, 38] }, { circle: [75, 120, 38] }],
    body: 0x1c1f23, targetY: 80, frame: 1.3,
  },
};

export const chassisOf = (c: Config) => CHASSIS[c.chassis!];

/** Chassis slot k (0 nearest the I/O) centre line. Slot 0 on this board is covered by the Gen5 M.2 heatsink. */
export const slotX = (C: Chassis, k: number) => C.W / 2 - C.io - 168 - SLOT_PITCH * k;

const GPU_SLOT = 1;
const NIC_SLOT = 5;
const FAN = 25;
const RAD = 38;
/** Width, height and depth as the PSU stands on end, modular face toward the front. */
const PSU_SIZE: Record<string, [number, number, number]> = { sf1000: [63.5, 125, 100], gx750: [86, 150, 140] };

/** Front face to the Rosewill's bracket fans, scaled from photos of a built one. */
const BRACKET = 185;

/** Box id prefix, which sets the colour, and frame size for each rear fan. */
const REAR_FAN: Record<string, [string, number]> = { 'nf-a6x25': ['rear-fan', 60], p8: ['rear-p8', 80], 'nf-r8': ['rear-r8', 80] };

const NONE: [number, number, number] = [0, 0, 0];

function box(id: string, part: string, kind: Kind, min: [number, number, number], max: [number, number, number], explode: [number, number, number] = NONE): Box {
  return { id, part, kind, min, max, explode };
}
/** A box from a centre point and a size. */
function centred(id: string, part: string, kind: Kind, c: [number, number, number], s: [number, number, number], explode: [number, number, number] = NONE): Box {
  return box(id, part, kind, [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2], [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2], explode);
}

export function layout(config: Config): Box[] {
  const C = chassisOf(config);
  const { W, H, D } = C;
  // Helpers: X(mm from the left exterior), ZF(mm back from the front face), ZR(mm forward from the rear face).
  const X = (l: number) => l - W / 2;
  const ZF = (d: number) => D / 2 - d;
  const ZR = (d: number) => -D / 2 + d;
  // ATX board, rear edge against the rear sheet.
  const BOARD_IO_X = X(W - C.io);
  const BOARD_Y = T + 6.35; // standoffs
  const BY = BOARD_Y + 1.6; // top of the PCB
  /** Board coordinates: uIo = mm from the I/O edge toward the slots; dRear = mm from the rear edge. */
  const bx = (uIo: number) => BOARD_IO_X - uIo;
  const bz = (dRear: number) => ZR(T) + dRear;
  const sx = (k: number) => slotX(C, k);
  const [slotLo, slotHi] = C.slotY;

  const b: Box[] = [];
  const up = (mm: number): [number, number, number] => [0, mm, 0];
  const back = (mm: number): [number, number, number] => [0, 0, -mm];
  const fwd = (mm: number): [number, number, number] => [0, 0, mm];

  // Chassis sheets. 'shell' parts are skipped by the overlap check; solids must not cross them anyway.
  b.push(box('floor', 'chassis', 'shell', [-W / 2, 0, -D / 2], [W / 2, T, D / 2]));
  b.push(box('wall-l', 'chassis', 'shell', [-W / 2, 0, -D / 2], [-W / 2 + T, H, D / 2]));
  b.push(box('wall-r', 'chassis', 'shell', [W / 2 - T, 0, -D / 2], [W / 2, H, D / 2]));
  b.push(box('rear', 'chassis', 'shell', [-W / 2, 0, -D / 2], [W / 2, H, -D / 2 + T]));
  b.push(box('lid', 'chassis', 'shell', [-W / 2, H - T, -D / 2], [W / 2, H, D / 2], up(110)));
  // Front: mesh door face, ears and handles. Depth includes the door, not the handles.
  b.push(box('front', 'chassis', 'shell', [-W / 2, 0, D / 2 - T], [W / 2, H, D / 2], fwd(120)));
  b.push(box('ears', 'chassis', 'shell', [-EARS / 2, 0, D / 2 - 3], [EARS / 2, H, D / 2], fwd(120)));
  for (const s of [-1, 1]) b.push(box(`handle${s < 0 ? '-l' : '-r'}`, 'chassis', 'shell', [s * 228 - 12, 12, D / 2], [s * 228 + 12, H - 12, D / 2 + 45], fwd(120)));
  if (config.chassis === 'rackchoice') {
    // Front-panel USB/switch board, in the front-right corner behind the door.
    b.push(box('front-io', 'chassis', 'solid', [X(388), 95, ZF(14)], [X(418), 128, ZF(2)], fwd(120)));
  } else {
    // The crossbar over the board and the bracket's bar. Shells, so a guess at their height can't fail the check.
    b.push(box('bar-mid', 'chassis', 'shell', [-W / 2 + T, H - 14, ZR(205)], [W / 2 - T, H - T, ZR(225)], up(110)));
    b.push(box('bar-wall', 'chassis', 'shell', [-W / 2 + T, H - 22, ZF(BRACKET)], [W / 2 - T, H - T, ZF(BRACKET - 20)], up(110)));
  }
  // Blank covers on every slot no card uses.
  const used = [...(config.gpu ? [GPU_SLOT, GPU_SLOT + 1] : []), ...(config.nic ? [NIC_SLOT] : [])];
  for (let k = 0; k < 8; k++) if (!used.includes(k)) b.push(box(`cover-${k}`, 'chassis', 'shell', [sx(k) - 9, slotLo, -D / 2], [sx(k) + 9, slotHi, -D / 2 + T], back(60)));

  // Motherboard and what is soldered to it.
  b.push(box('pcb', 'board', 'solid', [bx(305), BOARD_Y, bz(0)], [bx(0), BY, bz(244)]));
  b.push(box('io-shroud', 'board', 'solid', [bx(155), BY, bz(0)], [bx(2), 49, bz(30)]));
  b.push(box('vrm-top', 'board', 'solid', [bx(155), BY, bz(14)], [bx(36), 41, bz(65)]));
  b.push(box('vrm-right', 'board', 'solid', [bx(36), BY, bz(65)], [bx(2), 44, bz(160)]));
  b.push(centred('socket', 'board', 'solid', [bx(97), BY + 3.5, bz(121)], [52, 7, 45]));
  for (const k of [GPU_SLOT, NIC_SLOT, 6]) b.push(box(`pcie-${k}`, 'board', 'solid', [sx(k) - 3.75, BY, bz(39)], [sx(k) + 3.75, BY + 11.4, bz(125)]));
  const dimmZ = [169, 179, 189, 199].map(bz);
  dimmZ.forEach((z, i) => b.push(box(`dimm-${i}`, 'board', 'solid', [bx(167), BY, z - 3.5], [bx(31), BY + 9, z + 3.5])));
  // The Gen5 heatsink is a shell because the SSD sits inside it.
  b.push(box('m2a-heatsink', 'board', 'shell', [bx(179), BY, bz(27)], [bx(153), 22, bz(152)], up(90)));
  b.push(box('m2-shroud', 'board', 'solid', [bx(257), BY, bz(27)], [bx(194), 17, bz(152)]));
  b.push(box('m2-plate', 'board', 'solid', [bx(260), BY, bz(152)], [bx(194), 15, bz(224)]));
  b.push(box('atx24', 'board', 'solid', [bx(100), BY, bz(227)], [bx(51), 21, bz(240)]));
  b.push(box('eps', 'board', 'solid', [bx(15), BY, bz(44)], [bx(2), 20, bz(76)]));

  // CPU and the pump block on it.
  const cpuTop = BY + 7 + 4.4;
  b.push(centred('cpu', 'cpu', 'solid', [bx(97), BY + 7 + 2.2, bz(121)], [45, 4.4, 37.5], up(60)));
  b.push(box('pump', 'cooler', 'solid', [bx(97) - 49, cpuTop, bz(121) - 39], [bx(97) + 49, cpuTop + 55, bz(121) + 39], up(110)));

  // Memory in the second and fourth slots from the CPU. The module's lower 4 mm is inside the slot.
  const ramId = config.ram === 'crucial-2x64' ? 'kit' : 'ram';
  for (const i of [1, 3]) b.push(box(`${ramId}-${i}`, 'ram', 'solid', [bx(166), BY + 9, dimmZ[i] - 3.5], [bx(32.65), BY + 9 + 29, dimmZ[i] + 3.5], up(70)));

  // SSD under the Gen5 heatsink.
  if (config.ssd) b.push(box('ssd', 'ssd', 'solid', [bx(177), BY + 2, bz(60)], [bx(155), BY + 4.5, bz(140)], up(50)));

  // Cards. The card box starts above the slot connector; height is from the PCB edge less the 9.4 mm in the slot.
  const cardY = BY + 11.4;
  if (config.gpu) {
    const gx = sx(GPU_SLOT);
    b.push(box('gpu', 'gpu', 'solid', [gx - 38, cardY, bz(0)], [gx + 1, cardY + 111.76 - 9.4, bz(267)], up(90)));
    for (const k of [GPU_SLOT, GPU_SLOT + 1]) b.push(box(`gpu-bracket-${k}`, 'gpu', 'shell', [sx(k) - 9, slotLo, -D / 2], [sx(k) + 9, slotHi, -D / 2 + T], up(90)));
  }
  if (config.nic) {
    const nx = sx(NIC_SLOT);
    b.push(box('nic', 'nic', 'solid', [nx - 8, cardY, bz(0)], [nx + 1, cardY + 68.9 - 9.4, bz(142)], up(90)));
    b.push(box('nic-bracket', 'nic', 'shell', [nx - 9, slotLo, -D / 2], [nx + 9, slotHi, -D / 2 + T], up(90)));
    if (config['nic-shroud']) b.push({ ...box('nic-shroud', 'nic-shroud', 'solid', [nx - 18.6, cardY, bz(0)], [nx - 0.6, cardY + 65, bz(190)], up(90)), on: 'nic' });
  }

  // PSU on end in the rear-right corner, modular face toward the front.
  const [pw, ph, pd] = PSU_SIZE[config.psu!];
  b.push(box('psu', 'psu', 'solid', [C.psuX - pw / 2, T, ZR(T)], [C.psuX + pw / 2, T + ph, ZR(T + pd)], [60, 0, -90]));

  // Rear fans on the vent above the I/O opening.
  if (config['fans-rear']) {
    const [id, size] = REAR_FAN[config['fans-rear']];
    for (const [i, cx] of C.rearFanX.entries()) b.push(centred(`${id}-${i}`, 'fans-rear', 'solid', [cx, C.rearFanY, ZR(T + 12.5)], [size, size, 25], back(90)));
  }

  // Front wall: push fans, radiator, pull fans.
  C.fanX.forEach((cx, i) => b.push(centred(`push-${i}`, 'fans-push', 'solid', [cx, C.fanY, ZF(C.fanWall + FAN / 2)], [120, 120, FAN], fwd(150))));
  b.push(centred('radiator', 'radiator', 'solid', [(C.fanX[0] + C.fanX[2]) / 2, C.fanY, ZF(C.fanWall + FAN + RAD / 2)], [398, 120, RAD], fwd(100)));
  if (config['fans-bracket']) C.fanX.forEach((cx, i) => b.push(centred(`bracket-${i}`, 'fans-bracket', 'solid', [cx, C.fanY, ZF(BRACKET + FAN / 2)], [120, 120, FAN], up(60))));
  if (config['fans-pull']) C.fanX.forEach((cx, i) => b.push(centred(`pull-${i}`, 'fans-pull', 'solid', [cx, C.fanY, ZF(C.fanWall + FAN + RAD + FAN / 2)], [120, 120, FAN], fwd(50))));

  return b;
}

export interface Fit {
  /** Pairs of solid boxes from different parts that share volume. */
  overlaps: [string, string][];
  /** Solid boxes that poke outside the chassis interior. */
  outside: string[];
  /** Named gaps in mm. */
  gaps: { label: string; mm: number }[];
}

const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0.01;

export function checkFit(boxes: Box[], config: Config): Fit {
  const C = chassisOf(config);
  const solids = boxes.filter((b) => b.kind === 'solid');
  const overlaps: [string, string][] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i], b = solids[j];
      if (a.part === b.part || a.on === b.part || b.on === a.part) continue;
      if ([0, 1, 2].every((k) => overlap1(a.min[k], a.max[k], b.min[k], b.max[k]))) overlaps.push([a.id, b.id]);
    }
  }
  const lim = [[-C.W / 2 + T, C.W / 2 - T], [T, C.H - T], [-C.D / 2 + T, C.D / 2 - T]];
  const outside = solids.filter((b) => [0, 1, 2].some((k) => b.min[k] < lim[k][0] - 0.01 || b.max[k] > lim[k][1] + 0.01)).map((b) => b.id);
  const by = (id: string) => boxes.find((b) => b.id === id);
  const gpu = by('gpu'), rad = by('radiator')!, pump = by('pump')!;
  const bracket = by('bracket-0'), pull = by('pull-0');
  const wall = bracket ?? pull ?? rad;
  const wallName = bracket ? 'bracket fans' : pull ? 'pull fans' : 'radiator';
  const gaps = [
    ...(gpu ? [
      { label: `GPU end to the ${wallName}`, mm: wall.min[2] - gpu.max[2] },
      { label: `Longest card that clears the ${wallName}`, mm: wall.min[2] - gpu.min[2] },
      { label: 'GPU top to the lid', mm: lim[1][1] - gpu.max[1] },
    ] : []),
    { label: 'Pump block top to the lid', mm: lim[1][1] - pump.max[1] },
    { label: 'Radiator end to the left wall', mm: rad.min[0] - lim[0][0] },
    { label: 'Radiator end to the right wall', mm: lim[0][1] - rad.max[0] },
  ].map((g) => ({ ...g, mm: Math.round(g.mm * 10) / 10 }));
  return { overlaps, outside, gaps };
}
