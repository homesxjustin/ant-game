import { Caste, Faction, type Simulation } from "../core";

/**
 * Lightweight objective / progression tracker for the vertical slice. Encodes
 * "Chapter 1 — Survival" from the design as a concrete, testable win state and
 * a lose state, plus the staged tutorial beats (lone worker → rebuilding →
 * expansion). Objectives read the simulation but never mutate it, so the same
 * tracker can drive campaign, sandbox, or a tutorial overlay.
 */
export interface Objective {
  id: string;
  label: string;
  done: (sim: Simulation) => boolean;
}

export enum RunOutcome {
  Playing = "playing",
  Won = "won",
  Lost = "lost",
}

export interface ObjectiveState {
  outcome: RunOutcome;
  objectives: { label: string; done: boolean }[];
  stage: number; // 1..3, mirrors the design's progression stages
  stageLabel: string;
}

const OBJECTIVES: Objective[] = [
  {
    id: "gather",
    label: "Gather 120 food for the colony",
    done: (s) => s.colonies[Faction.Player].totalGathered >= 120,
  },
  {
    id: "grow",
    label: "Grow the colony to 30 ants",
    done: (s) => s.colonies[Faction.Player].population >= 30,
  },
  {
    id: "soldiers",
    label: "Raise 6 soldiers",
    done: (s) => s.colonies[Faction.Player].soldiers >= 6,
  },
  {
    id: "dominate",
    label: "Outnumber the rival colony 2:1",
    done: (s) =>
      s.colonies[Faction.Player].population >= 2 * Math.max(1, s.colonies[Faction.Rival].population) &&
      s.colonies[Faction.Player].population >= 20,
  },
];

export class ObjectiveTracker {
  evaluate(sim: Simulation): ObjectiveState {
    const player = sim.colonies[Faction.Player];

    // Lose: the player queen is gone.
    const queenAlive = sim.allAnts.some(
      (a) => a.alive && a.faction === Faction.Player && a.caste === Caste.Queen,
    );

    const objectives = OBJECTIVES.map((o) => ({ label: o.label, done: o.done(sim) }));
    const allDone = objectives.every((o) => o.done);

    let outcome = RunOutcome.Playing;
    if (!queenAlive) outcome = RunOutcome.Lost;
    else if (allDone) outcome = RunOutcome.Won;

    const pop = player.population;
    let stage = 1;
    let stageLabel = "Stage 1 — The Lone Worker";
    if (pop >= 40) {
      stage = 3;
      stageLabel = "Stage 3 — Expansion";
    } else if (pop >= 16) {
      stage = 2;
      stageLabel = "Stage 2 — Rebuilding";
    }

    return { outcome, objectives, stage, stageLabel };
  }
}
