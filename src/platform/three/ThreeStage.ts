import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Rng } from "../../core";
import type { Terrain } from "../../game/Terrain";

/**
 * The 3D "stage": WebGL renderer, scene, camera, dynamic lighting/sky, the
 * displaced ground mesh, and the scattered scale props (giant grass blades and
 * pebble "boulders") that sell the "six millimetres tall" fantasy. It owns
 * nothing about ants or gameplay — WorldView3D populates the dynamic content
 * and CameraRig drives the camera. Swapping this class for a native 3D renderer
 * is the console-port task; the game/ and core/ layers don't change.
 */
export class ThreeStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly worldW: number;
  private readonly worldH: number;

  // Cinematic post + living-world animation state.
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grassUniform = { value: 0 }; // uTime for wind sway (shared)
  private motes: THREE.Points | null = null;
  private moteVel: Float32Array | null = null;
  private startTime = (globalThis.performance?.now?.() ?? 0) / 1000;

  width = 1;
  height = 1;

  constructor(canvas: HTMLCanvasElement, worldW: number, worldH: number, terrain: Terrain) {
    this.worldW = worldW;
    this.worldH = worldH;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x8ec5e6, 1);
    // Filmic tone mapping + sRGB output push the look toward the "cinematic,
    // never evenly lit" art direction. Real GI/RT is a production-engine
    // concern (see docs/ART_DIRECTION.md); this is the real-time approximation.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false; // soft-shadow pass is a later step

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x8ec5e6, 500, 3000);

    this.camera = new THREE.PerspectiveCamera(60, 1, 1, 8000);
    this.camera.position.set(worldW * 0.28, 300, worldH * 0.5 + 300);
    this.camera.lookAt(worldW * 0.28, 0, worldH * 0.5);

    // Lighting: hemisphere for soft sky/ground bounce, a warm sun for a
    // golden-hour key, and a low ambient floor so nothing is pure black.
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a22, 0.85);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffe9c2, 0.22);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
    this.sun.position.set(worldW * 0.5, 800, worldH * 0.3);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.buildGround(terrain);
    this.scatterProps(terrain);
    this.buildAtmosphere();
  }

  // ---- static world geometry ----------------------------------------------

  private buildGround(terrain: Terrain): void {
    const segX = 160;
    const segZ = 110;
    const geo = new THREE.PlaneGeometry(this.worldW, this.worldH, segX, segZ);
    geo.rotateX(-Math.PI / 2); // lie flat, +Y up
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const lowC = new THREE.Color(0x3a4a22);
    const highC = new THREE.Color(0x6f8a3e);
    for (let i = 0; i < pos.count; i++) {
      // Plane is centred at origin; shift so world spans [0..W]×[0..H].
      const x = pos.getX(i) + this.worldW / 2;
      const z = pos.getZ(i) + this.worldH / 2;
      const y = terrain.heightAt(x, z);
      pos.setY(i, y);
      const t = THREE.MathUtils.clamp((y / terrain.amplitude) * 0.5 + 0.5, 0, 1);
      const c = lowC.clone().lerp(highC, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Re-centre so the plane's local origin maps to world (W/2, H/2).
    mesh.position.set(this.worldW / 2, 0, this.worldH / 2);
    this.scene.add(mesh);
  }

  private scatterProps(terrain: Terrain): void {
    const rng = new Rng(0xa17c0de);

    // Giant grass blades — thin tall cones towering over ~3-unit ants.
    const bladeGeo = new THREE.ConeGeometry(2.2, 46, 5);
    bladeGeo.translate(0, 23, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1 });
    // Wind: bend each blade in the vertex shader, tips (high local y) moving
    // more than the base, phased per-instance so the field ripples like real
    // grass rather than swaying in lockstep. GPU-side, so it's effectively free.
    bladeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.grassUniform;
      shader.vertexShader =
        "uniform float uTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float ph = instanceMatrix[3].x * 0.03 + instanceMatrix[3].z * 0.037;
           float gust = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.23 + ph * 0.5));
           transformed.x += sin(uTime * 1.6 + ph) * 0.11 * transformed.y * gust;
           transformed.z += cos(uTime * 1.2 + ph * 1.3) * 0.08 * transformed.y * gust;`,
        );
    };
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, 900);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 900; i++) {
      const x = rng.range(20, this.worldW - 20);
      const z = rng.range(20, this.worldH - 20);
      const y = terrain.heightAt(x, z);
      const lean = rng.range(-0.09, 0.09);
      q.setFromAxisAngle(new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), lean);
      const sc = rng.range(0.7, 1.7);
      s.set(sc, rng.range(0.8, 1.6), sc);
      p.set(x, y, z);
      m.compose(p, q, s);
      blades.setMatrixAt(i, m);
    }
    blades.instanceMatrix.needsUpdate = true;
    this.scene.add(blades);

    // Pebble "boulders" — low icosahedra of varied size.
    const pebGeo = new THREE.IcosahedronGeometry(1, 0);
    const pebMat = new THREE.MeshStandardMaterial({ color: 0x8a8477, roughness: 1, flatShading: true });
    const pebbles = new THREE.InstancedMesh(pebGeo, pebMat, 220);
    for (let i = 0; i < 220; i++) {
      const x = rng.range(10, this.worldW - 10);
      const z = rng.range(10, this.worldH - 10);
      const y = terrain.heightAt(x, z);
      const sc = rng.range(6, 26);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      s.set(sc, sc * rng.range(0.5, 0.8), sc);
      p.set(x, y + sc * 0.2, z);
      m.compose(p, q, s);
      pebbles.setMatrixAt(i, m);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    this.scene.add(pebbles);
  }

  /**
   * Floating pollen / dust motes drifting through the air and catching the
   * light — the "the world is alive even when you stand still" atmosphere from
   * the art direction. A single additive Points system; cheap, high-impact.
   */
  private buildAtmosphere(): void {
    const COUNT = 700;
    const rng = new Rng(0x9011ea);
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = rng.range(0, this.worldW);
      pos[i * 3 + 1] = rng.range(6, 140);
      pos[i * 3 + 2] = rng.range(0, this.worldH);
      vel[i * 3] = rng.range(-6, 6);
      vel[i * 3 + 1] = rng.range(-1.5, 3);
      vel[i * 3 + 2] = rng.range(-6, 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe6a8,
      size: 2.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.moteVel = vel;
    this.scene.add(this.motes);
  }

  private updateAtmosphere(dt: number): void {
    if (!this.motes || !this.moteVel) return;
    const attr = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const v = this.moteVel;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += v[i] * dt;
      p[i + 1] += v[i + 1] * dt;
      p[i + 2] += v[i + 2] * dt;
      // Wrap within the world volume so the haze is endless.
      if (p[i] < 0) p[i] += this.worldW;
      else if (p[i] > this.worldW) p[i] -= this.worldW;
      if (p[i + 2] < 0) p[i + 2] += this.worldH;
      else if (p[i + 2] > this.worldH) p[i + 2] -= this.worldH;
      if (p[i + 1] > 150) p[i + 1] = 6;
      else if (p[i + 1] < 4) p[i + 1] = 140;
    }
    attr.needsUpdate = true;
  }

  private ensureComposer(): void {
    if (this.composer) return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    // Sparing bloom: only bright highlights (dew, sun-catch) bloom.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      0.32, // strength
      0.7, // radius
      0.82, // threshold
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloom = bloom;
  }

  // ---- dynamic state -------------------------------------------------------

  /**
   * Advance the sky and sun to a day phase in [0,1): 0=dawn, 0.25=noon,
   * 0.5=dusk, 0.75=night. Colours and sun elevation interpolate so the same
   * world reads as morning / afternoon / golden hour / moonlit night.
   */
  setDayPhase(t: number): void {
    const ang = t * Math.PI * 2 - Math.PI / 2; // sun angle over the day
    const elev = Math.sin(ang); // -1..1
    const azimuth = t * Math.PI * 2;
    const R = Math.max(this.worldW, this.worldH);
    this.sun.position.set(
      this.worldW / 2 + Math.cos(azimuth) * R,
      elev * 900,
      this.worldH / 2 + Math.sin(azimuth) * R,
    );
    this.sun.target.position.set(this.worldW / 2, 0, this.worldH / 2);

    const day = THREE.MathUtils.clamp(elev * 1.4 + 0.35, 0, 1); // brightness 0..1
    // Sky colour: night indigo → dawn/dusk warm → day blue.
    const night = new THREE.Color(0x0b1030);
    const noon = new THREE.Color(0x8ec5e6);
    const dusk = new THREE.Color(0xe8a25a);
    const warm = THREE.MathUtils.clamp(1 - Math.abs(elev) * 3, 0, 1); // peaks at horizon
    const sky = night.clone().lerp(noon, day).lerp(dusk, warm * 0.5);

    this.renderer.setClearColor(sky, 1);
    (this.scene.fog as THREE.Fog).color.copy(sky);

    this.sun.intensity = 0.15 + day * 1.1;
    this.sun.color.setHex(warm > 0.4 ? 0xffb066 : 0xfff2cc);
    this.hemi.intensity = 0.25 + day * 0.75;
    this.ambient.intensity = 0.12 + day * 0.2;
  }

  /** `w`/`h` are the desired drawing-buffer size in DEVICE pixels (the host's
   * surface already folded in DPR), so pixel ratio stays 1 here to avoid
   * double-scaling. CSS sizing is handled by the canvas's 100%/100% style. */
  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  render(): void {
    // Advance living-world animation from a real clock so wind and motes keep
    // moving independent of simulation pace.
    const t = (globalThis.performance?.now?.() ?? 0) / 1000 - this.startTime;
    this.grassUniform.value = t;
    this.updateAtmosphere(Math.min(0.05, t - this.lastRenderT));
    this.lastRenderT = t;

    this.ensureComposer();
    this.composer!.render();
  }

  private lastRenderT = 0;
}
