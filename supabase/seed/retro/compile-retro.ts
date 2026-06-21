import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SQUADS_BY_NAME, type TeamSquad } from "../catalog/catalog-source.ts";

/**
 * Compiles famous goals from StatsBomb Open Data (real event data) into retro
 * jugadas: an accurate play-script from the goal's possession chain + named
 * trivia that is factual from the events (scorer, assist, body part, year).
 *
 * Honest scope: StatsBomb's 360 freeze-frames are positional but ANONYMOUS (no
 * player identities), so "who was nearby" cannot be named — only scorer/assist/
 * dribbled-past/body-part/year are. Play-script actors are anonymous dots; the
 * scorer's identity lives only in the server answer key.
 *
 * Source (download once, cached in /tmp): StatsBomb open-data events.
 *   https://github.com/statsbomb/open-data (free, attribution).
 * Output: apps/mobile/src/data/retro-jugadas.json (consumed by the app for the
 * play-script and by seed-retro.ts for the server challenge).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../../apps/mobile/src/data/retro-jugadas.json");
const eventsUrl = (matchId: number) =>
  `https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/${matchId}.json`;

interface SbEvent {
  id: string;
  index: number;
  minute: number;
  possession: number;
  type: { name: string };
  team: { name: string };
  player?: { name: string };
  location?: [number, number];
  pass?: { end_location?: [number, number]; key_pass_id?: string };
  shot?: { outcome?: { name: string }; key_pass_id?: string; body_part?: { name: string } };
}

async function loadEvents(matchId: number): Promise<SbEvent[]> {
  const cache = `/tmp/sb-ev-${matchId}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const res = await fetch(eventsUrl(matchId));
  const json = await res.text();
  writeFileSync(cache, json);
  return JSON.parse(json);
}

function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Map a StatsBomb full name to a squad player (full names differ — StatsBomb
 * keeps maternal surnames). Match if the squad surname appears in the SB name. */
function toSquad(full: string, squad: TeamSquad | undefined): { id: string; name: string } | null {
  if (!squad) return null;
  const f = norm(full);
  for (const p of squad.players) {
    const surname = norm(p.name).split(" ").slice(1).join(" ");
    if (surname && f.includes(surname)) return { id: p.id, name: p.name };
  }
  return null;
}

interface GoalCfg {
  providerEventId: string;
  matchId: number;
  possession: number;
  title: string;
}

/** The famous goals we reconstruct from real events (StatsBomb match ids). */
const GOALS: GoalCfg[] = [
  { providerEventId: "retro-wc2022-final-dimaria", matchId: 3869685, possession: 52, title: "World Cup 2022 final — the team goal" },
  // 108' Messi extra-time strike (3–2) — the golazo card's historic moment.
  { providerEventId: "retro-wc2022-final-messi", matchId: 3869685, possession: 228, title: "World Cup 2022 final — Messi's extra-time strike" },
  // 80' Mbappé — France's second, the comeback goal (Thuram assist).
  { providerEventId: "retro-wc2022-final-mbappe", matchId: 3869685, possession: 165, title: "World Cup 2022 final — Mbappé's comeback goal" },
];

function buildJugada(ev: SbEvent[], cfg: GoalCfg) {
  const chain = ev
    .filter((e) => e.possession === cfg.possession && e.location && ["Pass", "Carry", "Shot"].includes(e.type.name))
    .sort((a, b) => a.index - b.index);
  const shot = chain.find((e) => e.type.name === "Shot" && e.shot?.outcome?.name === "Goal");
  if (!shot) throw new Error(`goal not found in possession ${cfg.possession} (${cfg.providerEventId})`);
  const keyPass = shot.shot?.key_pass_id ? ev.find((e) => e.id === shot.shot!.key_pass_id) : undefined;

  const scorerFull = shot.player!.name;
  const assistFull = keyPass?.player?.name ?? "";
  const bodyPart = shot.shot?.body_part?.name ?? "Left Foot";
  const squad = SQUADS_BY_NAME[shot.team.name];

  // Ball waypoints: first touch, every pass end, the shot, then the goal line.
  const points: Array<{ p: [number, number]; event?: string }> = [];
  chain.forEach((e) => {
    if (points.length === 0 && e.location) points.push({ p: e.location });
    if (e.type.name === "Pass" && e.pass?.end_location) points.push({ p: e.pass.end_location, event: "pass" });
    if (e.type.name === "Carry" && e.location) points.push({ p: e.location, event: "carry" });
  });
  points.push({ p: shot.location!, event: "shot" });
  points.push({ p: [120, shot.location![1]], event: "goal" });

  const n = points.length - 1;
  // The ball polyline is real; the dots are SYNTHESIZED into a full team picture.
  // Each ball touch belongs to an attacker; passes hand the ball to a DIFFERENT
  // attacker, so every pass lands on a real receiver dot (no passing into space).
  // Carries keep the same owner (a dribble). Off the ball, a player glides toward
  // its next touch so it is in position to receive. We add an opposition keeper +
  // back line so the pitch reads like 10 players, not 4.
  type P = { x: number; y: number };
  const clamp = (v: number, max: number) => Math.max(0.5, Math.min(max - 0.5, v));
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  const lerpP = (a: P, b: P, f: number): P => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const pt2 = (p: P) => ({ x: Math.round(clamp(p.x, 120) * 10) / 10, y: Math.round(clamp(p.y, 80) * 10) / 10 });
  const B: P[] = points.map((p) => ({ x: p.p[0], y: p.p[1] }));
  const evs = points.map((p) => p.event);

  const shotIdx = points.findIndex((p) => p.event === "shot");
  let kpIdx = 0;
  for (let i = 0; i < shotIdx; i++) if (evs[i] === "pass") kpIdx = i;
  kpIdx = Math.max(1, Math.min(kpIdx || Math.floor(shotIdx * 0.6), shotIdx - 1));
  const shotLoc: P = { x: shot.location![0], y: shot.location![1] };

  // Ownership chain: a new owner on every pass, same owner through carries.
  const ownerAt: number[] = [0];
  for (let i = 1; i <= shotIdx; i++) ownerAt[i] = ownerAt[i - 1]! + (evs[i] === "pass" ? 1 : 0);
  const distinct = ownerAt[shotIdx]! + 1;
  const POOL = Math.max(2, Math.min(distinct, 6)); // distinct attacker dots
  const dotOf = (o: number) => ((o % POOL) + POOL) % POOL;
  const scorerDot = dotOf(ownerAt[shotIdx]!);
  let assistDot = dotOf(Math.max(0, ownerAt[kpIdx]! - 1)); // the key-pass player
  if (assistDot === scorerDot) assistDot = dotOf(scorerDot + 1);

  // Each attacker's touch stations (keyframe index → ball position).
  const stations: { i: number; pos: P }[][] = Array.from({ length: POOL }, () => []);
  for (let i = 0; i <= shotIdx; i++) stations[dotOf(ownerAt[i]!)]!.push({ i, pos: B[i]! });
  stations[scorerDot]!.push({ i: n, pos: shotLoc }); // striker holds as the ball flies in

  // Position of a dot at keyframe j: interpolate between its touches; hold at the
  // ends (an off-ball player drifts toward where it will next receive).
  const posOnTrack = (st: { i: number; pos: P }[], j: number): P => {
    if (st.length === 0) return B[0]!;
    if (j <= st[0]!.i) return st[0]!.pos;
    const last = st[st.length - 1]!;
    if (j >= last.i) return last.pos;
    for (let k = 0; k < st.length - 1; k++) {
      const a = st[k]!;
      const b = st[k + 1]!;
      if (j >= a.i && j <= b.i) return lerpP(a.pos, b.pos, (j - a.i) / ((b.i - a.i) || 1));
    }
    return last.pos;
  };

  const DEF_LANES = [24, 40, 56]; // opposition back-line y lanes
  const keyframes = points.map((pt, i) => {
    const b = B[i]!;
    const actors: Record<string, { x: number; y: number }> = {};
    for (let d = 0; d < POOL; d++) {
      const id = d === scorerDot ? "scorer" : d === assistDot ? "assist" : `atk${d}`;
      actors[id] = pt2(posOnTrack(stations[d]!, i));
    }
    // keeper holds the line, sliding across once the ball enters the final third
    const react = clamp01((b.x - 80) / 36);
    actors.keeper = pt2({ x: lerp(119, 116.5, react), y: lerp(40, shotLoc.y, react) });
    // a back line that retreats just goal-side of the ball and shifts toward it
    const lineX = Math.max(b.x + 6, 80);
    DEF_LANES.forEach((laneY, k) => {
      actors[`def${k}`] = pt2({ x: lineX + (k - 1) * 3, y: lerp(laneY, b.y, 0.28) });
    });

    return {
      t: Math.round((i / n) * 100) / 100,
      ball: { x: pt.p[0], y: pt.p[1] },
      actors,
      ...(pt.event ? { event: pt.event } : {}),
    };
  });

  const attackerActors = Array.from({ length: POOL }, (_, d) => ({
    slotId: d === scorerDot ? "scorer" : d === assistDot ? "assist" : `atk${d}`,
    team: "home",
    role: d === scorerDot ? "scorer" : d === assistDot ? "assist" : "carrier",
  }));
  const playScript = {
    version: 1,
    goalType: "open_play",
    durationMs: 6000,
    attackingSide: "home",
    actors: [
      ...attackerActors,
      { slotId: "keeper", team: "away", role: "keeper" },
      ...DEF_LANES.map((_, k) => ({ slotId: `def${k}`, team: "away", role: "defender" })),
    ],
    keyframes,
  };

  const pool = squad?.players ?? [];
  function nameOptions(full: string, seed: number): { options: Array<{ id: string; label: string }>; correctId: string } {
    const matched = toSquad(full, squad);
    const correct = matched ?? { id: "name-correct", name: full };
    const distractors = shuffleSeeded(
      pool.filter((p) => p.id !== correct.id),
      seed,
    ).slice(0, 3);
    const options = shuffleSeeded(
      [{ id: correct.id, label: correct.name }, ...distractors.map((p) => ({ id: p.id, label: p.name }))],
      seed + 1,
    );
    return { options, correctId: correct.id };
  }

  const bodyOptions = shuffleSeeded(
    [
      { id: "correct", label: bodyPart },
      ...["Right Foot", "Head", "Left Foot"].filter((b) => b !== bodyPart).slice(0, 2).map((b, i) => ({ id: `d${i}`, label: b })),
    ],
    7,
  );
  const yearOptions = shuffleSeeded(
    [
      { id: "correct", label: "2022" },
      { id: "d0", label: "2014" },
      { id: "d1", label: "2018" },
      { id: "d2", label: "2010" },
    ],
    9,
  );

  const scorerQ = nameOptions(scorerFull, 11);
  // Solo finishes (e.g. a rebound) have no key pass — skip the assist question
  // rather than show a blank option.
  const assistQ = assistFull ? nameOptions(assistFull, 21) : null;

  const distractors = [
    { slotId: "scorer", role: "scorer", prompt: "Who finished the move?", options: scorerQ.options },
    ...(assistQ ? [{ slotId: "assist", role: "assist", prompt: "Who provided the assist?", options: assistQ.options }] : []),
    { slotId: "bodypart", role: "scorer", prompt: "Finished with…", options: bodyOptions },
    { slotId: "year", role: "origin", prompt: "Which World Cup?", options: yearOptions },
  ];
  const answerKey: Record<string, string> = { scorer: scorerQ.correctId, bodypart: "correct", year: "correct" };
  if (assistQ) answerKey.assist = assistQ.correctId;

  return {
    providerEventId: cfg.providerEventId,
    title: cfg.title,
    // The scorer mapped to our squad — links a golazo card to its historic moment.
    playerId: toSquad(scorerFull, squad)?.id ?? null,
    playScript,
    distractors,
    answerKey,
    _debug: { scorer: scorerFull, assist: assistFull, body: bodyPart, keyframes: keyframes.length },
  };
}

async function main(): Promise<void> {
  const byMatch = new Map<number, SbEvent[]>();
  for (const matchId of new Set(GOALS.map((g) => g.matchId))) {
    byMatch.set(matchId, await loadEvents(matchId));
  }
  const jugadas = GOALS.map((cfg) => buildJugada(byMatch.get(cfg.matchId)!, cfg));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      jugadas.map(({ _debug, ...j }) => j),
      null,
      2,
    ) + "\n",
  );
  console.log(`✓ compiled ${jugadas.length} retro jugada(s) → ${OUT}`);
  for (const j of jugadas) {
    console.log(
      `  ${j.providerEventId}: scorer ${j._debug.scorer} (${j.playerId}) | assist ${j._debug.assist} | ${j._debug.body} | ${j._debug.keyframes} keyframes`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
