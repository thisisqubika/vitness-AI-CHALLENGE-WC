import { describe, it, expect } from "vitest";
import { samplePlay, interpolatePoint, activeEventAt } from "./play-sampler.ts";
import type { PlayScript } from "./play-script.ts";

const script: PlayScript = {
  version: 1,
  goalType: "open_play",
  durationMs: 4000,
  attackingSide: "home",
  actors: [
    { slotId: "a", team: "home", role: "origin" },
    { slotId: "b", team: "home", role: "scorer" },
  ],
  keyframes: [
    { t: 0, ball: { x: 0, y: 0 }, actors: { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } } },
    { t: 0.5, ball: { x: 60, y: 40 }, actors: { a: { x: 20, y: 20 }, b: { x: 50, y: 30 } }, event: "pass" },
    { t: 1, ball: { x: 120, y: 80 }, actors: { a: { x: 20, y: 20 }, b: { x: 100, y: 60 } }, event: "goal" },
  ],
};

describe("interpolatePoint", () => {
  it("returns the midpoint at f=0.5", () => {
    expect(interpolatePoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
  });
});

describe("samplePlay", () => {
  it("returns first frame at t=0", () => {
    const frame = samplePlay(script, 0);
    expect(frame.ball).toEqual({ x: 0, y: 0 });
    expect(frame.actors.b).toEqual({ x: 10, y: 10 });
  });

  it("returns last frame at t=1", () => {
    const frame = samplePlay(script, 1);
    expect(frame.ball).toEqual({ x: 120, y: 80 });
    expect(frame.actors.b).toEqual({ x: 100, y: 60 });
  });

  it("interpolates halfway into the first segment at t=0.25", () => {
    const frame = samplePlay(script, 0.25);
    expect(frame.ball).toEqual({ x: 30, y: 20 });
    expect(frame.actors.a).toEqual({ x: 10, y: 10 });
  });

  it("clamps out-of-range t", () => {
    expect(samplePlay(script, -1).ball).toEqual({ x: 0, y: 0 });
    expect(samplePlay(script, 2).ball).toEqual({ x: 120, y: 80 });
  });

  it("handles a single-keyframe script as a static frame", () => {
    const stat: PlayScript = { ...script, keyframes: [script.keyframes[0]!] };
    expect(samplePlay(stat, 0.7).ball).toEqual({ x: 0, y: 0 });
  });
});

describe("activeEventAt", () => {
  it("returns the most recent event at or before t", () => {
    expect(activeEventAt(script, 0.1)).toBeUndefined();
    expect(activeEventAt(script, 0.6)).toBe("pass");
    expect(activeEventAt(script, 1)).toBe("goal");
  });
});
