import * as THREE from "three";
import { Channel, Faction, type FoodSource, type Simulation } from "../core";
import { ThreeStage } from "../platform/three/ThreeStage";
import { AntField } from "../platform/three/AntField";
import type { Terrain } from "./Terrain";

/** Length of one in-game day, in simulated seconds. Drives the day/night cycle
 * from the deterministic clock so lighting is reproducible. */
const DAY_LENGTH = 150;

/**
 * Binds the simulation to the 3D stage. Read-only with respect to the sim:
 * every frame it pushes ant transforms, food/nest props, the pheromone ground
 * overlay, and the day phase into Three objects. All "what the world looks
 * like in 3D" logic lives here so the stage stays a dumb renderer.
 */
export class WorldView3D {
  readonly stage: ThreeStage;
  private readonly sim: Simulation;
  private readonly terrain: Terrain;
  private readonly ants: AntField;

  private readonly foodMeshes = new Map<number, THREE.Mesh>();
  private overlay!: THREE.Mesh;
  private overlayTex!: THREE.DataTexture;
  private overlayData!: Uint8Array;
  private possessRing!: THREE.Mesh;
  private frame = 0;
  private overlayVisibleFlag = true;

  constructor(canvas: HTMLCanvasElement, sim: Simulation, terrain: Terrain) {
    this.sim = sim;
    this.terrain = terrain;
    this.stage = new ThreeStage(canvas, sim.cfg.world.width, sim.cfg.world.height, terrain);
    this.ants = new AntField(terrain);
    this.stage.scene.add(this.ants.mesh);

    this.buildNests();
    this.buildFood();
    this.buildOverlay();
    this.buildPossessRing();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.stage.camera;
  }

  toggleOverlay(): void {
    this.overlayVisibleFlag = !this.overlayVisibleFlag;
    this.overlay.visible = this.overlayVisibleFlag;
  }

  get overlayVisible(): boolean {
    return this.overlayVisibleFlag;
  }

  resize(w: number, h: number): void {
    this.stage.resize(w, h);
  }

  // ---- static / semi-static content ---------------------------------------

  private buildNests(): void {
    for (const faction of [Faction.Player, Faction.Rival]) {
      const c = this.sim.colonies[faction];
      const color = faction === Faction.Player ? 0x6f8a3e : 0x9a4a3a;
      const y = this.terrain.heightAt(c.nestX, c.nestY);

      // A raised mound ring with a dark central crater (the nest entrance).
      const mound = new THREE.Mesh(
        new THREE.CylinderGeometry(34, 44, 14, 24, 1, true),
        new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
      );
      mound.position.set(c.nestX, y + 4, c.nestY);
      this.stage.scene.add(mound);

      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(24, 24),
        new THREE.MeshStandardMaterial({ color: 0x120d08, roughness: 1 }),
      );
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(c.nestX, y + 11, c.nestY);
      this.stage.scene.add(crater);
    }
  }

  private buildFood(): void {
    for (const f of this.sim.food) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({
          color: f.kind === "aphid" ? 0x8ad17a : 0xe8c34a,
          emissive: f.kind === "aphid" ? 0x213b1a : 0x3a2e08,
          roughness: 0.7,
          flatShading: true,
        }),
      );
      mesh.position.set(f.x, this.terrain.heightAt(f.x, f.y), f.y);
      this.stage.scene.add(mesh);
      this.foodMeshes.set(f.id, mesh);
    }
  }

  private buildOverlay(): void {
    const ph = this.sim.pheromones;
    this.overlayData = new Uint8Array(ph.cols * ph.rows * 4);
    this.overlayTex = new THREE.DataTexture(this.overlayData, ph.cols, ph.rows, THREE.RGBAFormat);
    this.overlayTex.needsUpdate = true;
    this.overlayTex.magFilter = THREE.LinearFilter;
    this.overlayTex.minFilter = THREE.LinearFilter;

    // A terrain-conforming sheet lifted just above the ground so trails read
    // clearly without z-fighting the hills.
    const geo = new THREE.PlaneGeometry(
      this.sim.cfg.world.width,
      this.sim.cfg.world.height,
      120,
      84,
    );
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + this.sim.cfg.world.width / 2;
      const z = pos.getZ(i) + this.sim.cfg.world.height / 2;
      pos.setY(i, this.terrain.heightAt(x, z) + 2.0);
    }
    const mat = new THREE.MeshBasicMaterial({
      map: this.overlayTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    this.overlay = new THREE.Mesh(geo, mat);
    this.overlay.position.set(this.sim.cfg.world.width / 2, 0, this.sim.cfg.world.height / 2);
    this.stage.scene.add(this.overlay);
  }

  private buildPossessRing(): void {
    this.possessRing = new THREE.Mesh(
      new THREE.TorusGeometry(9, 1.1, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.possessRing.rotation.x = -Math.PI / 2;
    this.possessRing.visible = false;
    this.stage.scene.add(this.possessRing);
  }

  // ---- per-frame sync ------------------------------------------------------

  sync(): void {
    this.frame++;

    // Day/night from the deterministic sim clock. The +0.38 offset starts a
    // new world in bright mid-morning, then rolls toward golden hour and night.
    this.stage.setDayPhase((this.sim.simTime / DAY_LENGTH + 0.38) % 1);

    // Ants (every frame — this is the main spectacle).
    this.ants.update(this.sim.allAnts, this.sim.possessedId);

    // Food props: scale by remaining amount, hide when depleted.
    for (const f of this.sim.food) this.syncFood(f);

    // Pheromone overlay (throttled — the texture is the costly part).
    if (this.overlayVisibleFlag && this.frame % 2 === 0) this.syncOverlay();

    // Possession marker.
    const poss = this.sim.possessedAnt();
    if (poss) {
      this.possessRing.visible = true;
      this.possessRing.position.set(poss.x, this.terrain.heightAt(poss.x, poss.y) + 3, poss.y);
    } else {
      this.possessRing.visible = false;
    }
  }

  private syncFood(f: FoodSource): void {
    const mesh = this.foodMeshes.get(f.id);
    if (!mesh) return;
    if (f.amount <= 0) {
      mesh.visible = false;
      return;
    }
    const r = 4 + 9 * Math.sqrt(f.amount / Math.max(1, f.capacity));
    mesh.scale.setScalar(r);
    mesh.position.y = this.terrain.heightAt(f.x, f.y) + r * 0.5;
    mesh.rotation.y += 0.01;
  }

  private syncOverlay(): void {
    const ph = this.sim.pheromones;
    const food = ph.raw(Channel.ToFood);
    const home = ph.raw(Channel.ToHome);
    const d = this.overlayData;
    for (let i = 0; i < food.length; i++) {
      const fv = food[i];
      const hv = home[i];
      // Food trails read bright green (the useful signal); home trails a
      // subtler translucent blue so they don't blanket the ground.
      const g = Math.min(255, fv * 4);
      const b = Math.min(210, hv * 2.4);
      const a = Math.min(155, fv * 3.2 + hv * 1.5);
      const o = i * 4;
      d[o] = Math.min(24, b * 0.08);
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = a;
    }
    this.overlayTex.needsUpdate = true;
  }

  render(): void {
    this.stage.render();
  }
}
