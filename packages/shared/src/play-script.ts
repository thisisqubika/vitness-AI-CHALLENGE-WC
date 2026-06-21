import { z } from "zod";
import { TeamSideSchema } from "./match.ts";

/**
 * PlayScript — the single animation contract that powers everything: the live
 * pitch reconstruction, the "who was in the play?" trivia (rendered with names
 * stripped), and golazo sticker replays. Retro plays are compiled into this
 * shape offline from StatsBomb event data; live plays are composed at runtime
 * from a goal event. See docs/CONCEPT.md "Play-script pipeline".
 *
 * Coordinate system matches StatsBomb: a 120 x 80 pitch, origin top-left,
 * attacking left-to-right. Live data is normalized into the same space so one
 * renderer serves both sources.
 */

export const PITCH_LENGTH = 120;
export const PITCH_WIDTH = 80;

export const PitchPointSchema = z.object({
  x: z.number().min(0).max(PITCH_LENGTH),
  y: z.number().min(0).max(PITCH_WIDTH),
});
export type PitchPoint = z.infer<typeof PitchPointSchema>;

/**
 * A participant in the play. `slotId` is the stable handle the trivia layer
 * uses; `playerId`/`playerName` are the truth, withheld from the client until
 * an answer is submitted. `role` labels the trivia question ("started the
 * play" / "assist" / "scored").
 */
export const PlayActorSchema = z.object({
  slotId: z.string(),
  team: TeamSideSchema,
  shirtNumber: z.number().int().min(1).max(99).optional(),
  role: z.enum(["origin", "assist", "scorer", "carrier", "keeper", "defender"]),
  playerId: z.string().optional(),
  playerName: z.string().optional(),
});
export type PlayActor = z.infer<typeof PlayActorSchema>;

/**
 * One animation keyframe. `t` is normalized play time in [0,1]; the renderer
 * interpolates positions between keyframes. `ball` is the ball position at `t`;
 * `actors` maps slotId -> position. `event` flags a beat to emphasize (pass,
 * shot, goal) for sound/flash cues.
 */
export const KeyframeSchema = z.object({
  t: z.number().min(0).max(1),
  ball: PitchPointSchema,
  actors: z.record(z.string(), PitchPointSchema),
  event: z.enum(["pass", "carry", "shot", "goal", "save"]).optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const GoalTypeSchema = z.enum([
  "open_play",
  "counter",
  "penalty",
  "free_kick",
  "header",
  "own_goal",
]);
export type GoalType = z.infer<typeof GoalTypeSchema>;

export const PlayScriptSchema = z.object({
  version: z.literal(1),
  goalType: GoalTypeSchema,
  durationMs: z.number().int().min(1000).max(30000),
  attackingSide: TeamSideSchema,
  actors: z.array(PlayActorSchema).min(1).max(12),
  keyframes: z.array(KeyframeSchema).min(2),
});
export type PlayScript = z.infer<typeof PlayScriptSchema>;

/**
 * The trivia question set derived from a PlayScript. One slot per actor with a
 * role the user must name. `options` are the shuffled choices (real player plus
 * era/position-matched distractors); the correct answer is NOT included here —
 * it lives only in the server-side answer key.
 */
export const TriviaSlotSchema = z.object({
  slotId: z.string(),
  role: PlayActorSchema.shape.role,
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(4),
});
export type TriviaSlot = z.infer<typeof TriviaSlotSchema>;

/**
 * What the client receives BEFORE answering: the animation plus the question
 * slots, with zero identifying truth. Compare with the server-held answer key.
 */
export const TriviaChallengeSchema = z.object({
  jugadaId: z.string(),
  source: z.enum(["live", "retro"]),
  playScript: PlayScriptSchema,
  slots: z.array(TriviaSlotSchema).min(1),
  askYear: z.boolean(),
  timerMs: z.number().int(),
});
export type TriviaChallenge = z.infer<typeof TriviaChallengeSchema>;
