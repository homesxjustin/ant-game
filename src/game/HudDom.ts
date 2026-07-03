import type { SimStats } from "../core";
import { RunOutcome, type ObjectiveState } from "./Objectives";

/**
 * DOM/HTML overlay HUD for the 3D edition. Text stays crisp at any resolution
 * (unlike drawing into WebGL) and it is trivially themeable/localizable. It
 * reads already-computed state and writes it into elements — no game logic.
 * A console edition would swap this for a native UI layer; nothing else changes.
 */
export interface HudOpts {
  paused: boolean;
  overlay: boolean;
  possessing: boolean;
  mode: string;
}

export class HudDom {
  private root: HTMLElement;
  private stat: HTMLElement;
  private obj: HTMLElement;
  private hint: HTMLElement;
  private banner: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "hud-root");
    injectStyles();
    this.stat = el("div", "hud-panel hud-stat");
    this.obj = el("div", "hud-panel hud-obj");
    this.hint = el("div", "hud-hint");
    this.banner = el("div", "hud-banner");
    this.banner.style.display = "none";
    this.root.append(this.stat, this.obj, this.hint, this.banner);
    parent.appendChild(this.root);
  }

  update(stats: SimStats, obj: ObjectiveState, opts: HudOpts): void {
    this.stat.innerHTML =
      `<h1>SimAnt: Evolution <span class="ed">3D</span></h1>` +
      `<div class="stage">${escape(obj.stageLabel)}</div>` +
      row("Colony food", stats.playerFood) +
      row("Population", `${stats.playerPop} <span class="dim">(soldiers ${stats.playerSoldiers})</span>`) +
      row("Brood", stats.playerBrood) +
      row("Rival ants", `<span class="rival">${stats.rivalPop}</span>`) +
      row("View", `${escape(opts.mode)}${opts.possessing ? " · ●possessing" : ""}`);

    this.obj.innerHTML =
      `<h2>Objectives</h2>` +
      obj.objectives
        .map(
          (o) =>
            `<div class="o ${o.done ? "done" : ""}">${o.done ? "✔" : "○"} ${escape(o.label)}</div>`,
        )
        .join("");

    this.hint.innerHTML =
      `<b>WASD</b> move/pan · <b>Click</b> possess · <b>R</b> release · ` +
      `<b>Q/E</b> orbit · <b>1/2/3</b> Ground/Colony/Ecosystem · <b>Wheel</b> zoom · ` +
      `<b>F/H</b> paint food/home trail · <b>Tab</b> overlay · <b>C</b> recenter · <b>P</b> pause` +
      (opts.overlay ? "" : ` · <span class="dim">(overlay hidden)</span>`);

    if (opts.paused) this.showBanner("PAUSED", "Press P to resume");
    else if (obj.outcome === RunOutcome.Won)
      this.showBanner("COLONY ASCENDANT", "Chapter 1 complete — press Enter for a new world");
    else if (obj.outcome === RunOutcome.Lost)
      this.showBanner("THE QUEEN HAS FALLEN", "Press Enter to try again");
    else this.banner.style.display = "none";
  }

  private showBanner(title: string, sub: string): void {
    this.banner.style.display = "grid";
    this.banner.innerHTML = `<div><div class="bt">${escape(title)}</div><div class="bs">${escape(sub)}</div></div>`;
  }
}

function row(label: string, value: string | number): string {
  return `<div class="r"><span class="k">${label}</span><span class="v">${value}</span></div>`;
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] || c);
}

let injected = false;
function injectStyles(): void {
  if (injected) return;
  injected = true;
  const css = `
  .hud-root{position:fixed;inset:0;pointer-events:none;font-family:ui-monospace,Menlo,Consolas,monospace;color:#e8f0e0;z-index:5}
  .hud-panel{position:absolute;background:rgba(8,14,6,0.66);backdrop-filter:blur(3px);border:1px solid rgba(150,180,120,0.18);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5}
  .hud-stat{top:14px;left:14px;min-width:250px}
  .hud-stat h1{font-size:16px;letter-spacing:1px;color:#d7c34a;margin-bottom:4px;font-weight:600}
  .hud-stat h1 .ed{font-size:11px;color:#0b0d0a;background:#d7c34a;border-radius:4px;padding:1px 5px;vertical-align:middle}
  .hud-stat .stage{color:#a9d17a;margin-bottom:8px;font-size:12px}
  .hud-stat .r{display:flex;justify-content:space-between;gap:18px}
  .hud-stat .k{opacity:.7}
  .hud-stat .v{font-variant-numeric:tabular-nums}
  .hud-stat .dim,.hud-hint .dim{opacity:.5}
  .hud-stat .rival{color:#e2726a}
  .hud-obj{top:14px;right:14px;min-width:270px}
  .hud-obj h2{font-size:13px;color:#d7c34a;margin-bottom:6px}
  .hud-obj .o{font-size:12px;color:#c9d4bf;padding:2px 0}
  .hud-obj .o.done{color:#7cc24a}
  .hud-hint{position:absolute;left:0;right:0;bottom:0;padding:9px 14px;background:linear-gradient(transparent,rgba(6,9,4,0.82));font-size:11.5px;color:#9fb08f;text-align:center}
  .hud-hint b{color:#d7c34a;font-weight:600}
  .hud-banner{position:absolute;inset:0;place-items:center;background:rgba(6,9,4,0.72);text-align:center}
  .hud-banner .bt{font-size:34px;color:#d7c34a;letter-spacing:2px}
  .hud-banner .bs{font-size:15px;color:#c9d4bf;margin-top:10px}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
