import * as THREE from "three";
import type { Ant } from "../core";
import type { Terrain } from "./Terrain";

/**
 * The three-perspective camera from the design vision, unified into one
 * continuous zoom axis so switching is seamless rather than a hard cut:
 *
 *   zoomT 0.0  Ground     — just above an ant; the world feels enormous.
 *   zoomT 0.5  Colony     — RTS boom; pheromone highways and crowds visible.
 *   zoomT 1.0  Ecosystem  — the whole property at once.
 *
 * Presets snap zoomT to those anchors; the wheel glides between them. In
 * Ground mode while possessing, the camera falls in behind the ant so you
 * experience the world as the insect does. Otherwise WASD pans the focus.
 *
 * Also owns screen→ground raycasting, so the game can turn a cursor/reticle
 * into a world point for possession and pheromone painting.
 */

// Per-anchor camera shape, interpolated by zoomT.
const GROUND = { radius: 20, pitch: 0.14, lift: 6 };
const COLONY = { radius: 360, pitch: 0.85, lift: 0 };
const ECO = { radius: 1200, pitch: 1.22, lift: 0 };

export interface CameraInput {
  move: { x: number; y: number };
  orbit: number; // -1 left, +1 right, 0 none
  zoom: number; // wheel delta (+ = toward ground)
  preset: 0 | 1 | 2 | null; // 1/2/3 keys → Ground/Colony/Ecosystem
  possessed: Ant | null;
}

export class CameraRig {
  private focusX: number;
  private focusZ: number;
  private _yaw = Math.PI * 0.5;
  private zoomT = 0.5;
  private targetZoomT = 0.5;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrain: Terrain;
  private readonly worldW: number;
  private readonly worldH: number;
  private readonly ray = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    camera: THREE.PerspectiveCamera,
    terrain: Terrain,
    worldW: number,
    worldH: number,
    focus: { x: number; z: number },
  ) {
    this.camera = camera;
    this.terrain = terrain;
    this.worldW = worldW;
    this.worldH = worldH;
    this.focusX = focus.x;
    this.focusZ = focus.z;
  }

  /** Current perspective as a 0/1/2 index, for HUD labelling. */
  get modeIndex(): number {
    return this.zoomT < 0.28 ? 0 : this.zoomT < 0.72 ? 1 : 2;
  }

  get modeLabel(): string {
    return ["Ground", "Colony", "Ecosystem"][this.modeIndex];
  }

  /** Current camera yaw (radians), so the game can map screen-relative input
   * (WASD) into world-space steering. */
  get yaw(): number {
    return this._yaw;
  }

  /** True when close enough to the ground that WASD should steer the possessed
   * ant instead of panning the camera. */
  get isGroundMode(): boolean {
    return this.zoomT < 0.3;
  }

  update(dt: number, input: CameraInput): void {
    // Zoom target from presets / wheel.
    if (input.preset !== null) this.targetZoomT = [0, 0.5, 1][input.preset];
    if (input.zoom !== 0) this.targetZoomT = clamp(this.targetZoomT - input.zoom * 0.08, 0, 1);
    this.zoomT += (this.targetZoomT - this.zoomT) * Math.min(1, dt * 6);

    // Orbit.
    this._yaw += input.orbit * dt * 1.6;

    const grounded = this.isGroundMode;
    const following = grounded && input.possessed != null;

    if (following) {
      const a = input.possessed as Ant;
      // Glide the focus onto the ant and swing behind its heading.
      this.focusX += (a.x - this.focusX) * Math.min(1, dt * 8);
      this.focusZ += (a.y - this.focusZ) * Math.min(1, dt * 8);
      const desiredYaw = a.heading; // world dir (x→x, y→z)
      this._yaw = slerpAngle(this._yaw, desiredYaw, Math.min(1, dt * 3)) + input.orbit * dt * 1.6;
    } else if (input.move.x !== 0 || input.move.y !== 0) {
      // Pan the focus in camera-relative space, scaled by altitude so it feels
      // consistent from ground to ecosystem.
      const speed = 60 + this.currentRadius() * 0.9;
      const fx = Math.cos(this._yaw);
      const fz = Math.sin(this._yaw);
      // move.y up (W) = -1 → forward; move.x right (D) = +1 → strafe right.
      this.focusX += (fx * -input.move.y + Math.cos(this._yaw + Math.PI / 2) * input.move.x) * speed * dt;
      this.focusZ += (fz * -input.move.y + Math.sin(this._yaw + Math.PI / 2) * input.move.x) * speed * dt;
    }

    this.focusX = clamp(this.focusX, 0, this.worldW);
    this.focusZ = clamp(this.focusZ, 0, this.worldH);

    this.applyToCamera();
  }

  private currentRadius(): number {
    // Exponential blend for a natural feel across three orders of magnitude.
    const t = this.zoomT;
    if (t < 0.5) return lerpExp(GROUND.radius, COLONY.radius, t / 0.5);
    return lerpExp(COLONY.radius, ECO.radius, (t - 0.5) / 0.5);
  }

  private currentShape(): { radius: number; pitch: number; lift: number } {
    const t = this.zoomT;
    if (t < 0.5) {
      const k = t / 0.5;
      return {
        radius: lerpExp(GROUND.radius, COLONY.radius, k),
        pitch: lerp(GROUND.pitch, COLONY.pitch, k),
        lift: lerp(GROUND.lift, COLONY.lift, k),
      };
    }
    const k = (t - 0.5) / 0.5;
    return {
      radius: lerpExp(COLONY.radius, ECO.radius, k),
      pitch: lerp(COLONY.pitch, ECO.pitch, k),
      lift: lerp(COLONY.lift, ECO.lift, k),
    };
  }

  private applyToCamera(): void {
    const { radius, pitch, lift } = this.currentShape();
    const groundY = this.terrain.heightAt(this.focusX, this.focusZ);
    const horiz = radius * Math.cos(pitch);
    const vert = radius * Math.sin(pitch);

    this.camera.position.set(
      this.focusX - Math.cos(this._yaw) * horiz,
      groundY + vert + 4,
      this.focusZ - Math.sin(this._yaw) * horiz,
    );
    this.camera.lookAt(this.focusX, groundY + lift, this.focusZ);
  }

  /**
   * Convert a device-pixel screen point to a world ground point (sim x = world
   * x, sim y = world z). Returns null if the ray misses the ground.
   */
  screenToGround(px: number, py: number, viewW: number, viewH: number): { x: number; y: number } | null {
    const ndc = new THREE.Vector2((px / viewW) * 2 - 1, -((py / viewH) * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.groundPlane, hit)) return null;
    return { x: hit.x, y: hit.z };
  }

  /** Focus point in sim coordinates (x, y), e.g. for painting when no cursor. */
  focusSim(): { x: number; y: number } {
    return { x: this.focusX, y: this.focusZ };
  }

  /** Recenter the view on a sim point at the Colony preset (the "home" view). */
  recenter(simX: number, simY: number): void {
    this.focusX = simX;
    this.focusZ = simY;
    this.targetZoomT = 0.5;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpExp(a: number, b: number, t: number): number {
  return a * Math.pow(b / a, clamp(t, 0, 1));
}
function slerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
