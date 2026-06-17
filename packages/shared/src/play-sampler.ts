import type { PitchPoint, PlayScript } from "./play-script.ts";

/**
 * Pure interpolation of a PlayScript at a normalized time t ∈ [0,1]. Rendering
 * (Skia) lives in the app; this is the math, kept side-effect-free and
 * unit-testable. Returns the ball position and each actor's position by slotId.
 */

export interface PlayFrame {
  ball: PitchPoint;
  actors: Record<string, PitchPoint>;
}

export function interpolatePoint(a: PitchPoint, b: PitchPoint, f: number): PitchPoint {
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Find the two keyframes bracketing `t` and the local fraction between them.
 * Keyframes are assumed sorted by their `t`. Clamps to [first, last].
 */
function bracket(
  script: PlayScript,
  t: number,
): { from: PlayScript["keyframes"][number]; to: PlayScript["keyframes"][number]; f: number } {
  const frames = script.keyframes;
  const clamped = Math.max(0, Math.min(1, t));
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("play-script has no keyframes");
  }
  if (clamped <= first.t) return { from: first, to: first, f: 0 };
  if (clamped >= last.t) return { from: last, to: last, f: 0 };

  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i];
    const to = frames[i + 1];
    if (from === undefined || to === undefined) continue;
    if (clamped >= from.t && clamped <= to.t) {
      const span = to.t - from.t;
      const f = span === 0 ? 0 : (clamped - from.t) / span;
      return { from, to, f };
    }
  }
  return { from: last, to: last, f: 0 };
}

export function samplePlay(script: PlayScript, t: number): PlayFrame {
  const { from, to, f } = bracket(script, t);
  const ball = interpolatePoint(from.ball, to.ball, f);
  const actors: Record<string, PitchPoint> = {};
  for (const actor of script.actors) {
    const a = from.actors[actor.slotId];
    const b = to.actors[actor.slotId] ?? a;
    if (a === undefined) continue;
    actors[actor.slotId] = interpolatePoint(a, b ?? a, f);
  }
  return { ball, actors };
}

/** The keyframe whose `event` should fire at or before `t` (most recent). */
export function activeEventAt(script: PlayScript, t: number): PlayScript["keyframes"][number]["event"] {
  const clamped = Math.max(0, Math.min(1, t));
  let current: PlayScript["keyframes"][number]["event"];
  for (const frame of script.keyframes) {
    if (frame.t <= clamped && frame.event) current = frame.event;
  }
  return current;
}
