import type { PlayScript, GoalType, PlayActor, Keyframe, PitchPoint } from "./play-script.ts";
import type { TeamSide } from "./match.ts";

/**
 * Deterministic, stylized reconstruction of a goal for which no real tracking
 * data exists (every WC 2026 goal). The real scorer + minute anchor a template
 * chosen by a hash of the event id; supporting players are anonymous. Pure and
 * side-effect-free — the same event always yields the same PlayScript. NOT real
 * positions: the UI must frame this as a reconstruction. See ticket VIT-7.
 *
 * Accurate, real reconstructions come only from StatsBomb 360 data for historic
 * matches (Track B / retro).
 */

export interface ComposeInput {
  providerEventId: string;
  team: TeamSide;
  scorerId?: string;
  scorerShirt?: number;
}

interface Template {
  goalType: GoalType;
  durationMs: number;
  /** Waypoints in home-attacking orientation (left → right, goal at x≈120). */
  frames: Array<{ t: number; ball: PitchPoint; origin: PitchPoint; scorer: PitchPoint; defender: PitchPoint; keeper: PitchPoint; event?: Keyframe["event"] }>;
}

const TEMPLATES: Template[] = [
  {
    goalType: "open_play",
    durationMs: 4800,
    frames: [
      { t: 0, ball: { x: 62, y: 40 }, origin: { x: 60, y: 40 }, scorer: { x: 84, y: 36 }, defender: { x: 96, y: 40 }, keeper: { x: 116, y: 40 }, event: "pass" },
      { t: 0.5, ball: { x: 92, y: 38 }, origin: { x: 72, y: 40 }, scorer: { x: 94, y: 37 }, defender: { x: 99, y: 42 }, keeper: { x: 115, y: 40 }, event: "carry" },
      { t: 0.82, ball: { x: 108, y: 38 }, origin: { x: 82, y: 40 }, scorer: { x: 108, y: 38 }, defender: { x: 104, y: 44 }, keeper: { x: 113, y: 41 }, event: "shot" },
      { t: 1, ball: { x: 120, y: 42 }, origin: { x: 86, y: 40 }, scorer: { x: 112, y: 40 }, defender: { x: 106, y: 45 }, keeper: { x: 117, y: 36 }, event: "goal" },
    ],
  },
  {
    goalType: "counter",
    durationMs: 4200,
    frames: [
      { t: 0, ball: { x: 50, y: 60 }, origin: { x: 48, y: 60 }, scorer: { x: 70, y: 50 }, defender: { x: 90, y: 52 }, keeper: { x: 116, y: 40 }, event: "carry" },
      { t: 0.55, ball: { x: 92, y: 48 }, origin: { x: 64, y: 56 }, scorer: { x: 96, y: 46 }, defender: { x: 100, y: 48 }, keeper: { x: 115, y: 41 }, event: "pass" },
      { t: 0.85, ball: { x: 110, y: 44 }, origin: { x: 78, y: 52 }, scorer: { x: 110, y: 44 }, defender: { x: 106, y: 46 }, keeper: { x: 112, y: 43 }, event: "shot" },
      { t: 1, ball: { x: 120, y: 38 }, origin: { x: 82, y: 50 }, scorer: { x: 113, y: 42 }, defender: { x: 108, y: 46 }, keeper: { x: 117, y: 44 }, event: "goal" },
    ],
  },
  {
    goalType: "header",
    durationMs: 4000,
    frames: [
      { t: 0, ball: { x: 100, y: 8 }, origin: { x: 100, y: 10 }, scorer: { x: 102, y: 44 }, defender: { x: 106, y: 46 }, keeper: { x: 116, y: 40 }, event: "pass" },
      { t: 0.6, ball: { x: 106, y: 30 }, origin: { x: 100, y: 14 }, scorer: { x: 106, y: 42 }, defender: { x: 107, y: 45 }, keeper: { x: 115, y: 40 }, event: "carry" },
      { t: 0.85, ball: { x: 110, y: 40 }, origin: { x: 100, y: 16 }, scorer: { x: 110, y: 41 }, defender: { x: 108, y: 45 }, keeper: { x: 114, y: 41 }, event: "shot" },
      { t: 1, ball: { x: 120, y: 44 }, origin: { x: 100, y: 18 }, scorer: { x: 112, y: 41 }, defender: { x: 109, y: 45 }, keeper: { x: 117, y: 37 }, event: "goal" },
    ],
  },
  {
    goalType: "free_kick",
    durationMs: 3600,
    frames: [
      { t: 0, ball: { x: 88, y: 52 }, origin: { x: 88, y: 54 }, scorer: { x: 88, y: 53 }, defender: { x: 100, y: 44 }, keeper: { x: 116, y: 42 }, event: "shot" },
      { t: 0.7, ball: { x: 108, y: 44 }, origin: { x: 89, y: 53 }, scorer: { x: 90, y: 52 }, defender: { x: 101, y: 43 }, keeper: { x: 113, y: 40 } },
      { t: 1, ball: { x: 120, y: 36 }, origin: { x: 89, y: 53 }, scorer: { x: 90, y: 52 }, defender: { x: 102, y: 43 }, keeper: { x: 110, y: 44 }, event: "goal" },
    ],
  },
];

/** Stable non-negative hash of a string (deterministic; no Math.random). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PITCH_WIDTH = 80;
const PITCH_LENGTH = 120;

/** Mirror a home-orientation point for an away attack (right → left). */
function mirror(p: PitchPoint, away: boolean): PitchPoint {
  return away ? { x: PITCH_LENGTH - p.x, y: PITCH_WIDTH - p.y } : p;
}

export function composePlayScript(input: ComposeInput): PlayScript {
  const template = TEMPLATES[hash(input.providerEventId) % TEMPLATES.length]!;
  const away = input.team === "away";
  const opp: TeamSide = away ? "home" : "away";

  const actors: PlayActor[] = [
    { slotId: "origin", team: input.team, role: "origin" },
    {
      slotId: "scorer",
      team: input.team,
      role: "scorer",
      ...(input.scorerShirt !== undefined ? { shirtNumber: input.scorerShirt } : {}),
      ...(input.scorerId !== undefined ? { playerId: input.scorerId } : {}),
    },
    { slotId: "defender", team: opp, role: "defender" },
    { slotId: "keeper", team: opp, role: "keeper" },
  ];

  const keyframes: Keyframe[] = template.frames.map((f) => ({
    t: f.t,
    ball: mirror(f.ball, away),
    actors: {
      origin: mirror(f.origin, away),
      scorer: mirror(f.scorer, away),
      defender: mirror(f.defender, away),
      keeper: mirror(f.keeper, away),
    },
    ...(f.event ? { event: f.event } : {}),
  }));

  return {
    version: 1,
    goalType: template.goalType,
    durationMs: template.durationMs,
    attackingSide: input.team,
    actors,
    keyframes,
  };
}
