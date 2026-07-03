import { Caste, Channel, Faction, type Simulation } from "../core";
import type { Renderer } from "../platform/Platform";
import type { Camera } from "./Camera";

/**
 * Draws the simulation. Read-only: it queries the sim and issues renderer
 * calls, holding no game state of its own. Keeping all "what the world looks
 * like" logic here means a console renderer only has to implement the small
 * Renderer interface, not understand ants.
 */

const COLORS = {
  background: "#12160f",
  ground: "#1b2113",
  nestPlayer: "#7cc24a",
  nestRival: "#c2564a",
  antPlayerWorker: "#a9d17a",
  antPlayerSoldier: "#d7e26a",
  antPlayerQueen: "#f2e39a",
  antRivalWorker: "#d18a7a",
  antRivalSoldier: "#e2726a",
  antRivalQueen: "#f2a89a",
  possessed: "#ffffff",
  food: "#e8c34a",
  foodAphid: "#8ad17a",
};

export class WorldView {
  private showOverlay = true;

  toggleOverlay(): void {
    this.showOverlay = !this.showOverlay;
  }

  get overlayVisible(): boolean {
    return this.showOverlay;
  }

  draw(r: Renderer, sim: Simulation, cam: Camera): void {
    r.begin(cam.view(), COLORS.background);

    // Pheromone overlays.
    if (this.showOverlay) {
      const ph = sim.pheromones;
      r.drawField(ph.raw(Channel.ToFood), ph.cols, ph.rows, ph.cellSize, [90, 200, 90]);
      r.drawField(ph.raw(Channel.ToHome), ph.cols, ph.rows, ph.cellSize, [90, 140, 220]);
    }

    // Nests.
    const p = sim.colonies[Faction.Player];
    const rv = sim.colonies[Faction.Rival];
    r.circle(p.nestX, p.nestY, 20, "#2b3a1c");
    r.ring(p.nestX, p.nestY, 22, COLORS.nestPlayer, 2);
    r.circle(rv.nestX, rv.nestY, 20, "#3a221c");
    r.ring(rv.nestX, rv.nestY, 22, COLORS.nestRival, 2);

    // Food sources (radius scales with remaining amount).
    for (const f of sim.food) {
      if (f.amount <= 0) continue;
      const rr = 3 + 7 * Math.sqrt(f.amount / Math.max(1, f.capacity));
      r.circle(f.x, f.y, rr, f.kind === "aphid" ? COLORS.foodAphid : COLORS.food);
    }

    // Ants.
    const possessedId = sim.possessedId;
    for (const a of sim.allAnts) {
      if (!a.alive) continue;
      const color =
        a.id === possessedId ? COLORS.possessed : this.antColor(a.faction, a.caste);
      const size = a.caste === Caste.Queen ? 6 : a.caste === Caste.Soldier ? 4 : 3;
      r.ant(a.x, a.y, a.heading, size, color, a.carrying > 0);
      if (a.id === possessedId) {
        r.ring(a.x, a.y, 10, "#ffffff", 1.5);
      }
    }

    r.end();
  }

  private antColor(faction: Faction, caste: Caste): string {
    if (faction === Faction.Player) {
      if (caste === Caste.Queen) return COLORS.antPlayerQueen;
      if (caste === Caste.Soldier) return COLORS.antPlayerSoldier;
      return COLORS.antPlayerWorker;
    }
    if (caste === Caste.Queen) return COLORS.antRivalQueen;
    if (caste === Caste.Soldier) return COLORS.antRivalSoldier;
    return COLORS.antRivalWorker;
  }
}
