import * as THREE from "three";
import { Caste, Faction, type Ant } from "../../core";
import type { Terrain } from "../../game/Terrain";

/**
 * GPU-instanced ant rendering. All ants share one merged mesh and are drawn in
 * a single draw call via InstancedMesh — this is what lets the colony scale to
 * thousands of visible ants at 60 Hz. Per-ant colour (faction/caste, or white
 * when possessed) rides in instanceColor. The manager holds no simulation
 * state; it is refreshed from the ant list every frame.
 */
export class AntField {
  readonly mesh: THREE.InstancedMesh;
  private readonly terrain: Terrain;
  private readonly capacity: number;

  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();

  constructor(terrain: Terrain, capacity = 6000) {
    this.terrain = terrain;
    this.capacity = capacity;

    const geo = buildAntGeometry();
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    // Allocate the per-instance colour buffer.
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3,
    );
  }

  /** Rebuild instance transforms + colours from the live ants. */
  update(ants: readonly Ant[], possessedId: number | null): void {
    let n = 0;
    for (const a of ants) {
      if (!a.alive || n >= this.capacity) continue;

      const size =
        a.caste === Caste.Queen ? 5.5 : a.caste === Caste.Soldier ? 3.4 : 2.4;
      const y = this.terrain.heightAt(a.x, a.y) + size * 0.5;

      this.tmpPos.set(a.x, y, a.y);
      // heading is in the sim's XY plane → rotate about world +Y. Negate so the
      // ant faces its travel direction under the x→x, y→z mapping.
      this.tmpQuat.setFromAxisAngle(this.up, -a.heading);
      this.tmpScale.setScalar(size);
      this.tmpM.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.mesh.setMatrixAt(n, this.tmpM);

      this.setColor(a, possessedId === a.id);
      this.mesh.setColorAt(n, this.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private setColor(a: Ant, possessed: boolean): void {
    if (possessed) {
      this.color.setHex(0xffffff);
      return;
    }
    if (a.faction === Faction.Player) {
      if (a.caste === Caste.Queen) this.color.setHex(0xf2e39a);
      else if (a.caste === Caste.Soldier) this.color.setHex(0xd7e26a);
      else this.color.setHex(0x9fc85f);
    } else {
      if (a.caste === Caste.Queen) this.color.setHex(0xf2a89a);
      else if (a.caste === Caste.Soldier) this.color.setHex(0xe2726a);
      else this.color.setHex(0xcf7a68);
    }
  }
}

/** Merge three little spheres (head / thorax / abdomen) into one unit-ish ant
 * geometry, so a single instanced draw yields a readable silhouette. Built at
 * radius ~1 and scaled per instance. */
function buildAntGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const head = new THREE.SphereGeometry(0.42, 8, 6);
  head.translate(0.7, 0, 0);
  const thorax = new THREE.SphereGeometry(0.5, 8, 6);
  const abdomen = new THREE.SphereGeometry(0.62, 8, 6);
  abdomen.translate(-0.85, 0, 0);
  parts.push(head, thorax, abdomen);
  return mergeGeometries(parts);
}

/** Minimal position/normal merge (avoids depending on three/examples). */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertCount = 0;
  let idxCount = 0;
  for (const g of geos) {
    vertCount += (g.attributes.position as THREE.BufferAttribute).count;
    idxCount += g.index ? g.index.count : 0;
  }
  const position = new Float32Array(vertCount * 3);
  const normal = new Float32Array(vertCount * 3);
  const index = new Uint16Array(idxCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const gp = g.attributes.position as THREE.BufferAttribute;
    const gn = g.attributes.normal as THREE.BufferAttribute;
    position.set(gp.array as Float32Array, vOff * 3);
    normal.set(gn.array as Float32Array, vOff * 3);
    const gi = g.index!;
    for (let i = 0; i < gi.count; i++) index[iOff + i] = gi.getX(i) + vOff;
    vOff += gp.count;
    iOff += gi.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  return merged;
}
