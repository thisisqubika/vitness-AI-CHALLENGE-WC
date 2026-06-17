import { PlayScriptSchema, type PlayScript } from "@vitness/shared";

/**
 * Hand-authored reconstructions for the ARG-MEX demo fixture goals, keyed by the
 * event's providerEventId. These stand in for the compose-play pipeline (live)
 * and the StatsBomb compiler (retro), which produce the same PlayScript shape.
 * Coordinates are on the shared 120×80 pitch; home attacks left → right.
 */

const scripts: Record<string, PlayScript> = {
  // 23' — Messi opener, worked from the right with De Paul.
  "arg-mex-e03": {
    version: 1,
    goalType: "open_play",
    durationMs: 5000,
    attackingSide: "home",
    actors: [
      { slotId: "origin", team: "home", role: "origin", shirtNumber: 7 },
      { slotId: "scorer", team: "home", role: "scorer", shirtNumber: 10 },
      { slotId: "def", team: "away", role: "defender", shirtNumber: 15 },
      { slotId: "gk", team: "away", role: "keeper", shirtNumber: 1 },
    ],
    keyframes: [
      {
        t: 0,
        ball: { x: 62, y: 20 },
        actors: { origin: { x: 60, y: 20 }, scorer: { x: 78, y: 46 }, def: { x: 96, y: 44 }, gk: { x: 116, y: 40 } },
        event: "pass",
      },
      {
        t: 0.45,
        ball: { x: 88, y: 40 },
        actors: { origin: { x: 70, y: 26 }, scorer: { x: 90, y: 42 }, def: { x: 98, y: 46 }, gk: { x: 115, y: 41 } },
        event: "carry",
      },
      {
        t: 0.8,
        ball: { x: 104, y: 42 },
        actors: { origin: { x: 80, y: 30 }, scorer: { x: 104, y: 43 }, def: { x: 101, y: 47 }, gk: { x: 114, y: 42 } },
        event: "shot",
      },
      {
        t: 1,
        ball: { x: 120, y: 38 },
        actors: { origin: { x: 84, y: 32 }, scorer: { x: 108, y: 44 }, def: { x: 103, y: 47 }, gk: { x: 117, y: 36 } },
        event: "goal",
      },
    ],
  },

  // 41' — Mexico equaliser, Jiménez finish from a Lozano cross.
  "arg-mex-e06": {
    version: 1,
    goalType: "open_play",
    durationMs: 4500,
    attackingSide: "away",
    actors: [
      { slotId: "origin", team: "away", role: "origin", shirtNumber: 22 },
      { slotId: "scorer", team: "away", role: "scorer", shirtNumber: 9 },
      { slotId: "def", team: "home", role: "defender", shirtNumber: 13 },
      { slotId: "gk", team: "home", role: "keeper", shirtNumber: 23 },
    ],
    keyframes: [
      {
        t: 0,
        ball: { x: 58, y: 60 },
        actors: { origin: { x: 56, y: 62 }, scorer: { x: 30, y: 40 }, def: { x: 22, y: 42 }, gk: { x: 4, y: 40 } },
        event: "pass",
      },
      {
        t: 0.5,
        ball: { x: 30, y: 56 },
        actors: { origin: { x: 40, y: 60 }, scorer: { x: 20, y: 42 }, def: { x: 22, y: 44 }, gk: { x: 5, y: 40 } },
        event: "carry",
      },
      {
        t: 0.82,
        ball: { x: 16, y: 44 },
        actors: { origin: { x: 30, y: 58 }, scorer: { x: 16, y: 43 }, def: { x: 20, y: 45 }, gk: { x: 6, y: 41 } },
        event: "shot",
      },
      {
        t: 1,
        ball: { x: 0, y: 42 },
        actors: { origin: { x: 28, y: 56 }, scorer: { x: 13, y: 43 }, def: { x: 19, y: 45 }, gk: { x: 3, y: 44 } },
        event: "goal",
      },
    ],
  },

  // 76' — Messi winner, De Paul through-ball.
  "arg-mex-e10": {
    version: 1,
    goalType: "open_play",
    durationMs: 5200,
    attackingSide: "home",
    actors: [
      { slotId: "origin", team: "home", role: "origin", shirtNumber: 7 },
      { slotId: "scorer", team: "home", role: "scorer", shirtNumber: 10 },
      { slotId: "def", team: "away", role: "defender", shirtNumber: 3 },
      { slotId: "gk", team: "away", role: "keeper", shirtNumber: 1 },
    ],
    keyframes: [
      {
        t: 0,
        ball: { x: 64, y: 44 },
        actors: { origin: { x: 62, y: 44 }, scorer: { x: 82, y: 34 }, def: { x: 95, y: 40 }, gk: { x: 116, y: 40 } },
        event: "pass",
      },
      {
        t: 0.5,
        ball: { x: 92, y: 36 },
        actors: { origin: { x: 72, y: 42 }, scorer: { x: 94, y: 36 }, def: { x: 98, y: 42 }, gk: { x: 115, y: 40 } },
        event: "carry",
      },
      {
        t: 0.83,
        ball: { x: 108, y: 38 },
        actors: { origin: { x: 82, y: 40 }, scorer: { x: 108, y: 38 }, def: { x: 105, y: 44 }, gk: { x: 113, y: 42 } },
        event: "shot",
      },
      {
        t: 1,
        ball: { x: 120, y: 44 },
        actors: { origin: { x: 86, y: 40 }, scorer: { x: 112, y: 40 }, def: { x: 107, y: 45 }, gk: { x: 116, y: 36 } },
        event: "goal",
      },
    ],
  },
};

/** Validate once at module load so a malformed hand-authored script fails loudly. */
for (const [id, script] of Object.entries(scripts)) {
  const result = PlayScriptSchema.safeParse(script);
  if (!result.success) {
    throw new Error(`demo jugada "${id}" is invalid: ${result.error.message}`);
  }
}

export function demoJugadaFor(providerEventId: string): PlayScript | null {
  return scripts[providerEventId] ?? null;
}
