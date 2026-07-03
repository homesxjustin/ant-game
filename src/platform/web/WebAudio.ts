import type { AudioSink } from "../Platform";

/**
 * Minimal procedural audio via the Web Audio API — no asset files needed for
 * the vertical slice. Cues are short synthesized blips so the build stays
 * self-contained. A shipping title swaps this for a sample-based mixer behind
 * the same AudioSink interface.
 */
export class WebAudio implements AudioSink {
  private ctx: AudioContext | null = null;
  private master = 0.6;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  play(cue: string, volume = 1): void {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    const spec = CUES[cue] ?? CUES.tap;
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, now);
    if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, now + spec.dur);

    const vol = this.master * volume * spec.gain;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + spec.dur + 0.02);
  }

  setMasterVolume(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
  }
}

interface CueSpec {
  type: OscillatorType;
  freq: number;
  slideTo?: number;
  dur: number;
  gain: number;
}

const CUES: Record<string, CueSpec> = {
  tap: { type: "square", freq: 440, dur: 0.05, gain: 0.15 },
  possess: { type: "triangle", freq: 330, slideTo: 660, dur: 0.12, gain: 0.25 },
  release: { type: "triangle", freq: 660, slideTo: 300, dur: 0.12, gain: 0.22 },
  food: { type: "sine", freq: 720, slideTo: 960, dur: 0.09, gain: 0.2 },
  hatch: { type: "sine", freq: 520, slideTo: 780, dur: 0.14, gain: 0.22 },
  paint: { type: "square", freq: 240, dur: 0.04, gain: 0.12 },
  win: { type: "sawtooth", freq: 400, slideTo: 900, dur: 0.5, gain: 0.3 },
  lose: { type: "sawtooth", freq: 300, slideTo: 90, dur: 0.6, gain: 0.3 },
};
