/** Turns the layout boxes into detailed meshes, one group per box, placed at the box centre. */
import * as THREE from 'three';
import { chassisOf, layout } from './layout';
import type { Config } from '../../data/build';
import { buildPart } from './parts';

export interface Built {
  group: THREE.Group;
  /** Objects per part id, for highlight. */
  byPart: Map<string, THREE.Object3D[]>;
  /** Moves every box toward its exploded place; t from 0 to 1. */
  setExplode(t: number): void;
  setLid(on: boolean): void;
  /** Frees the GPU memory; call before dropping the model for a rebuilt one. */
  dispose(): void;
}

export function buildModel(config: Config): Built {
  const C = chassisOf(config);
  const group = new THREE.Group();
  const byPart = new Map<string, THREE.Object3D[]>();
  const movers: { obj: THREE.Object3D; base: THREE.Vector3; explode: THREE.Vector3 }[] = [];
  let lid: THREE.Object3D | undefined;
  let pump: THREE.Object3D | undefined;
  let radiator: THREE.Object3D | undefined;

  for (const b of layout(config)) {
    const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const centre = new THREE.Vector3(b.min[0] + size[0] / 2, b.min[1] + size[1] / 2, b.min[2] + size[2] / 2);
    const obj = buildPart(b.id, size, C);
    obj.position.copy(centre);
    obj.traverse((o) => (o.userData.part = b.part));
    group.add(obj);
    (byPart.get(b.part) ?? byPart.set(b.part, []).get(b.part)!).push(obj);
    movers.push({ obj, base: centre.clone(), explode: new THREE.Vector3(...b.explode) });
    if (b.id === 'lid') lid = obj;
    if (b.id === 'pump') pump = obj;
    if (b.id === 'radiator') radiator = obj;
  }

  // Cooler tubes: two curves from the radiator fittings to the pump ports, rebuilt when the parts move.
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95 });
  const tubes = [new THREE.Mesh(undefined, tubeMat), new THREE.Mesh(undefined, tubeMat)];
  for (const t of tubes) {
    t.castShadow = true;
    t.userData.part = 'cooler';
    group.add(t);
  }
  byPart.get('cooler')!.push(...tubes);
  function routeTubes() {
    if (!pump || !radiator) return;
    const rb = new THREE.Box3().setFromObject(radiator);
    const pb = new THREE.Box3().setFromObject(pump);
    const bracketFans = byPart.get('fans-bracket');
    const bracket = bracketFans && bracketFans.reduce((box, o) => box.expandByObject(o), new THREE.Box3());
    tubes.forEach((t, i) => {
      const dy = i ? 14 : -14;
      const dx = i ? 11 : -11;
      const start = new THREE.Vector3(rb.max.x - 12, (rb.min.y + rb.max.y) / 2 + dy, rb.min.z);
      const end = new THREE.Vector3((pb.min.x + pb.max.x) / 2 + dx, pb.max.y - 22, pb.max.z);
      // Past the bracket fans through the gap at the wall, as on a built Rosewill.
      const x = bracket ? bracket.max.x + (i ? 24 : 9) : 0;
      const bypass = bracket ? [new THREE.Vector3(x, start.y, bracket.max.z + 5), new THREE.Vector3(x, start.y, bracket.min.z - 5)] : [];
      const curve = new THREE.CatmullRomCurve3([
        start,
        start.clone().add(new THREE.Vector3(0, 0, -45)),
        ...bypass,
        new THREE.Vector3((start.x + end.x) / 2, Math.max(start.y, end.y) + 15, (start.z + end.z) / 2),
        end.clone().add(new THREE.Vector3(0, 0, 40)),
        end,
      ]);
      t.geometry.dispose();
      t.geometry = new THREE.TubeGeometry(curve, 48, 6, 12, false);
    });
  }
  routeTubes();

  return {
    group,
    byPart,
    setExplode(t) {
      for (const m of movers) m.obj.position.copy(m.base).addScaledVector(m.explode, t);
      routeTubes();
    },
    setLid(on) {
      if (lid) lid.visible = on;
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        mat?.map?.dispose();
        mat?.alphaMap?.dispose();
        mat?.dispose();
      });
    },
  };
}
