import type { PlayScript } from "./play-script.ts";

/**
 * Pads a sparse PlayScript (the hand-authored demo goals and the live
 * compose-play templates only carry 4 named dots) with anonymous scenery so the
 * pitch reads like a real team picture: a couple of trailing support attackers
 * and an opposition back line that retreats just goal-side of the ball. Plays
 * that already carry a full cast (e.g. the StatsBomb retro reconstructions) are
 * returned untouched. Pure + deterministic — safe to memoize in the renderer.
 */
const FULL_ENOUGH = 8;
const SUPPORT_LANES = [20, 60]; // trailing teammates' y lanes
const BACKLINE_LANES = [26, 40, 54]; // opposition back-line y lanes

export function densifyPlayScript(script: PlayScript): PlayScript {
  if (script.actors.length >= FULL_ENOUGH) return script;

  const home = script.attackingSide === "home";
  const dir = home ? 1 : -1; // attacking direction along x (home → 120)
  const oppTeam = home ? "away" : "home";
  const clampX = (v: number) => Math.max(2, Math.min(118, v));
  const clampY = (v: number) => Math.max(3, Math.min(77, v));
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  const round = (v: number) => Math.round(v * 10) / 10;

  const keyframes = script.keyframes.map((kf) => {
    const b = kf.ball;
    const extra: Record<string, { x: number; y: number }> = {};
    // support teammates trail the ball, deeper in our own half
    SUPPORT_LANES.forEach((laneY, k) => {
      extra[`sup${k}`] = {
        x: round(clampX(b.x - dir * (16 + k * 8))),
        y: round(clampY(lerp(laneY, b.y, 0.3))),
      };
    });
    // opposition back line sits just goal-side of the ball and shifts toward it
    const lineX = clampX(b.x + dir * 7);
    BACKLINE_LANES.forEach((laneY, k) => {
      extra[`dz${k}`] = {
        x: round(clampX(lineX + dir * (k - 1) * 3)),
        y: round(clampY(lerp(laneY, b.y, 0.25))),
      };
    });
    return { ...kf, actors: { ...kf.actors, ...extra } };
  });

  const extraActors = [
    ...SUPPORT_LANES.map((_, k) => ({ slotId: `sup${k}`, team: script.attackingSide, role: "carrier" as const })),
    ...BACKLINE_LANES.map((_, k) => ({ slotId: `dz${k}`, team: oppTeam as "home" | "away", role: "defender" as const })),
  ];

  return { ...script, actors: [...script.actors, ...extraActors], keyframes };
}
