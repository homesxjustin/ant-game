import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { CameraRig } from "../src/game/CameraRig";
import { Terrain } from "../src/game/Terrain";
import type { Ant } from "../src/core";

const noInput = { move: { x: 0, y: 0 }, orbit: 0, zoom: 0, preset: null as null };

function makeRig() {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 1, 8000);
  const terrain = new Terrain(2400, 1600, 10);
  const rig = new CameraRig(cam, terrain, 2400, 1600, { x: 600, z: 800 });
  return { cam, rig };
}

function fakeAnt(x: number, y: number, heading = 0): Ant {
  return { x, y, heading, alive: true } as unknown as Ant;
}

describe("CameraRig", () => {
  it("snaps to perspective presets", () => {
    const { rig } = makeRig();
    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, preset: 2, possessed: null });
    expect(rig.modeIndex).toBe(2);
    expect(rig.modeLabel).toBe("Ecosystem");

    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, preset: 0, possessed: null });
    expect(rig.modeIndex).toBe(0);
    expect(rig.isGroundMode).toBe(true);
  });

  it("follows a possessed ant in ground mode", () => {
    const { rig } = makeRig();
    // Drop to ground mode.
    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, preset: 0, possessed: null });
    const ant = fakeAnt(1500, 400);
    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, possessed: ant });
    const f = rig.focusSim();
    expect(f.x).toBeCloseTo(1500, 0);
    expect(f.y).toBeCloseTo(400, 0);
  });

  it("pans the focus with movement when not possessing", () => {
    const { rig } = makeRig();
    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, preset: 1, possessed: null });
    const before = rig.focusSim();
    for (let i = 0; i < 60; i++)
      rig.update(1 / 60, { ...noInput, move: { x: 1, y: 0 }, preset: 1, possessed: null });
    const after = rig.focusSim();
    expect(after.x !== before.x || after.y !== before.y).toBe(true);
  });

  it("raycasts a screen point onto the ground plane", () => {
    const { rig } = makeRig();
    for (let i = 0; i < 120; i++) rig.update(1 / 60, { ...noInput, preset: 2, possessed: null });
    const hit = rig.screenToGround(512, 320, 1024, 640); // screen centre
    expect(hit).not.toBeNull();
    // Centre ray should land near the camera focus.
    const f = rig.focusSim();
    expect(Math.hypot(hit!.x - f.x, hit!.y - f.y)).toBeLessThan(400);
  });

  it("recenter moves focus to the given sim point at colony zoom", () => {
    const { rig } = makeRig();
    rig.recenter(2000, 1200);
    rig.update(1 / 60, { ...noInput, possessed: null });
    const f = rig.focusSim();
    expect(f.x).toBeCloseTo(2000, 0);
    expect(f.y).toBeCloseTo(1200, 0);
  });
});
