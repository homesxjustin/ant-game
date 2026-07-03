import type { Renderer } from "../platform/Platform";
import type { SimStats } from "../core";
import { RunOutcome, type ObjectiveState } from "./Objectives";

/**
 * Heads-up display drawn in screen space after the world pass. Pure
 * presentation — takes already-computed stats/objectives and lays them out.
 */
export class Hud {
  draw(
    r: Renderer,
    stats: SimStats,
    obj: ObjectiveState,
    opts: { paused: boolean; overlay: boolean; possessing: boolean; brush: string },
  ): void {
    const pad = 12;
    const line = 18;

    // Top-left stat panel.
    r.rect(pad - 6, pad - 6, 260, 132, "rgba(8,12,6,0.72)");
    let y = pad;
    r.text("SimAnt: Evolution", pad, y, "#d7c34a", 15);
    y += line + 4;
    r.text(obj.stageLabel, pad, y, "#a9d17a", 12);
    y += line;
    r.text(`Colony food:   ${stats.playerFood}`, pad, y, "#e6efe0", 12);
    y += line;
    r.text(`Population:    ${stats.playerPop}  (soldiers ${stats.playerSoldiers})`, pad, y, "#e6efe0", 12);
    y += line;
    r.text(`Brood:        ${stats.playerBrood}`, pad, y, "#e6efe0", 12);
    y += line;
    r.text(`Rival ants:   ${stats.rivalPop}`, pad, y, "#d18a7a", 12);

    // Objectives panel (top-right).
    const panelW = 300;
    const rightX = r.width / this.dpr(r) - panelW - pad;
    r.rect(rightX - 6, pad - 6, panelW, line * (obj.objectives.length + 1) + 14, "rgba(8,12,6,0.72)");
    r.text("Objectives", rightX, pad, "#d7c34a", 13);
    obj.objectives.forEach((o, i) => {
      const mark = o.done ? "[x]" : "[ ]";
      const col = o.done ? "#7cc24a" : "#c9d4bf";
      r.text(`${mark} ${o.label}`, rightX, pad + line * (i + 1) + 2, col, 11);
    });

    // Bottom control hints.
    const hintY = r.height / this.dpr(r) - 26;
    r.rect(0, hintY - 6, r.width / this.dpr(r), 34, "rgba(8,12,6,0.6)");
    const brush = `Brush: ${opts.brush}`;
    const hints =
      "WASD move  ·  E possess/release  ·  F food-trail  ·  H home-trail  ·  Wheel zoom  ·  Tab overlay  ·  C recenter  ·  P pause";
    r.text(hints, pad, hintY, "#9fb08f", 11);
    r.text(brush, r.width / this.dpr(r) - pad, hintY, "#d7c34a", 11, "right");

    if (opts.possessing) {
      r.text("● POSSESSING — drive this ant to food and back", pad, hintY - line, "#ffffff", 11);
    }

    if (!opts.overlay) {
      r.text("(pheromone overlay hidden — Tab)", pad, pad + 132, "#6f7d63", 10);
    }

    if (opts.paused) {
      this.banner(r, "PAUSED", "Press P to resume");
    }
    if (obj.outcome === RunOutcome.Won) {
      this.banner(r, "COLONY ASCENDANT", "Chapter 1 complete — press Enter for a new world");
    } else if (obj.outcome === RunOutcome.Lost) {
      this.banner(r, "THE QUEEN HAS FALLEN", "Press Enter to try again");
    }
  }

  private banner(r: Renderer, title: string, sub: string): void {
    const w = r.width / this.dpr(r);
    const h = r.height / this.dpr(r);
    r.rect(0, h / 2 - 60, w, 120, "rgba(6,9,4,0.82)");
    r.text(title, w / 2, h / 2 - 34, "#d7c34a", 30, "center");
    r.text(sub, w / 2, h / 2 + 10, "#c9d4bf", 14, "center");
  }

  private dpr(r: Renderer): number {
    // Renderer reports device pixels; HUD lays out in CSS pixels. Infer ratio
    // from the canvas if exposed, else assume 1. CanvasRenderer sizes width in
    // device px, so divide by the ratio it used. We approximate via a getter.
    const anyR = r as unknown as { pixelRatio?: number };
    return anyR.pixelRatio ?? 1;
  }
}
