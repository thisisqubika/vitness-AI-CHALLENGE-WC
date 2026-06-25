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
  shot?: { outcome?: { name: string }; key_pass_id?: string; body_part?: { name: string }; end_location?: number[] };
}

async function loadEvents(matchId: number): Promise<SbEvent[]> {
  const cache = `/tmp/sb-ev-${matchId}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const res = await fetch(eventsUrl(matchId));
  const json = await res.text();
  writeFileSync(cache, json);
  return JSON.parse(json);
}

/** A StatsBomb 360 freeze-frame entry: a visible player at a real position.
 * Anonymous — `teammate` is relative to the event's possession team. */
interface FF {
  teammate: boolean;
  actor: boolean;
  keeper: boolean;
  location: [number, number];
}
async function load360(matchId: number): Promise<Map<string, FF[]>> {
  const cache = `/tmp/sb-360-${matchId}.json`;
  let arr: { event_uuid: string; freeze_frame: FF[] }[];
  if (existsSync(cache)) arr = JSON.parse(readFileSync(cache, "utf8"));
  else {
    const res = await fetch(`https://raw.githubusercontent.com/statsbomb/open-data/master/data/three-sixty/${matchId}.json`);
    const json = await res.text();
    writeFileSync(cache, json);
    arr = JSON.parse(json);
  }
  return new Map(arr.map((e) => [e.event_uuid, e.freeze_frame]));
}

type Pt = { x: number; y: number };

/**
 * Stitch per-frame anonymous player positions into continuous tracks by matching
 * each player to the nearest same-team player in the previous frame (greedy,
 * within `thresh` yards). Players who leave the camera produce a null until they
 * reappear (or never); identity is inferred purely by proximity. Returns one
 * (Pt|null)[] per inferred player, length = number of frames.
 */
function matchTracks(frames: Pt[][], thresh: number): (Pt | null)[][] {
  const nF = frames.length;
  const tracks: (Pt | null)[][] = [];
  (frames[0] ?? []).forEach((p) => {
    const t: (Pt | null)[] = Array(nF).fill(null);
    t[0] = p;
    tracks.push(t);
  });
  const lastKnown = (t: (Pt | null)[], before: number): Pt | null => {
    for (let j = before - 1; j >= 0; j--) if (t[j]) return t[j]!;
    return null;
  };
  for (let k = 1; k < nF; k++) {
    const cur = frames[k] ?? [];
    const actives = tracks
      .map((t, ti) => ({ ti, lp: lastKnown(t, k) }))
      .filter((a): a is { ti: number; lp: Pt } => a.lp !== null);
    const pairs: { pi: number; ti: number; d: number }[] = [];
    cur.forEach((p, pi) => actives.forEach((a) => pairs.push({ pi, ti: a.ti, d: Math.hypot(p.x - a.lp.x, p.y - a.lp.y) })));
    pairs.sort((x, y) => x.d - y.d);
    const usedP = new Set<number>();
    const usedT = new Set<number>();
    for (const pr of pairs) {
      if (pr.d > thresh) break;
      if (usedP.has(pr.pi) || usedT.has(pr.ti)) continue;
      tracks[pr.ti]![k] = cur[pr.pi]!;
      usedP.add(pr.pi);
      usedT.add(pr.ti);
    }
    cur.forEach((p, pi) => {
      if (!usedP.has(pi)) {
        const t: (Pt | null)[] = Array(nF).fill(null);
        t[k] = p;
        tracks.push(t);
      }
    });
  }
  return tracks;
}

/** Fill a track's null gaps: hold before the first sighting, interpolate interior
 * gaps, hold after the last — so every frame has a position. */
function fillTrack(t: (Pt | null)[]): Pt[] {
  const nF = t.length;
  const out: (Pt | null)[] = [...t];
  let firstK = out.findIndex(Boolean);
  if (firstK < 0) firstK = 0;
  for (let i = 0; i < firstK; i++) out[i] = out[firstK];
  let prev = firstK;
  for (let i = firstK + 1; i < nF; i++) {
    if (out[i]) {
      if (i - prev > 1) {
        const a = out[prev]!;
        const b = out[i]!;
        for (let j = prev + 1; j < i; j++) {
          const f = (j - prev) / (i - prev);
          out[j] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
      }
      prev = i;
    }
  }
  for (let i = prev + 1; i < nF; i++) out[i] = out[prev];
  return out as Pt[];
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
  /** The defending team's name (for the away kit/flag); the scoring team comes
   * from the shot event. */
  opponent: string;
}

/** The famous goals we reconstruct from real events (StatsBomb match ids). */
const GOALS: GoalCfg[] = [
  { providerEventId: "retro-wc2022-final-dimaria", matchId: 3869685, possession: 52, title: "Final del Mundial 2022 — el gol colectivo", opponent: "France" },
  // 108' Messi extra-time strike (3–2) — the golazo card's historic moment.
  { providerEventId: "retro-wc2022-final-messi", matchId: 3869685, possession: 228, title: "Final del Mundial 2022 — el gol del alargue", opponent: "France" },
  // 80' Mbappé — France's second, the comeback goal (Thuram assist).
  { providerEventId: "retro-wc2022-final-mbappe", matchId: 3869685, possession: 165, title: "Final del Mundial 2022 — el gol de la remontada", opponent: "Argentina" },
  // 73' Richarlison bicycle kick vs Serbia — goal of the tournament.
  { providerEventId: "retro-wc2022-bra-ser-richarlison", matchId: 3857258, possession: 133, title: "Mundial 2022 — la chilena ante Serbia", opponent: "Serbia" },
  // 64' Messi opens the scoring vs Mexico — the goal that settled Argentina.
  { providerEventId: "retro-wc2022-arg-mex-messi", matchId: 3857289, possession: 105, title: "Mundial 2022 — el gol que abrió a México", opponent: "Mexico" },
  // 91' Mbappé curls in France's third vs Poland.
  { providerEventId: "retro-wc2022-fra-pol-mbappe", matchId: 3869152, possession: 143, title: "Mundial 2022 — el golazo ante Polonia", opponent: "Poland" },
];

function buildJugada(ev: SbEvent[], byFF: Map<string, FF[]>, cfg: GoalCfg) {
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
  // Shirt number of a known player (scorer/assist) — revealed on the jerseys
  // after the challenge is solved. Unknown/anonymous dots stay blank.
  const shirtOf = (full: string): number | undefined => {
    const m = toSquad(full, squad);
    return m ? squad?.players.find((p) => p.id === m.id)?.shirtNumber : undefined;
  };
  const scorerNum = shirtOf(scorerFull);
  const assistNum = assistFull ? shirtOf(assistFull) : undefined;

  // ---- Real player movement from StatsBomb 360 freeze-frames ----
  // Each chain event with a freeze-frame becomes a keyframe: the ball sits at the
  // event and every VISIBLE player at its real recorded position. We stitch the
  // anonymous per-event snapshots into continuous tracks by nearest-neighbour
  // matching (matchTracks). `teammate` is relative to the possession team = the
  // scoring side, so teammate → home. Players who leave the camera hold their last
  // seen spot — the honest limit of the data.
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const clampPt = (p: Pt): Pt => ({ x: round1(cl(p.x, 0.5, 119.5)), y: round1(cl(p.y, 0.5, 79.5)) });
  const shotLoc: Pt = { x: shot.location![0], y: shot.location![1] };

  const tag = (t: string) => (t === "Pass" ? "pass" : t === "Carry" ? "carry" : t === "Shot" ? "shot" : undefined);
  const framed = chain.filter((e) => byFF.has(e.id));
  type Snap = { ball: Pt; ev?: string; home: Pt[]; away: Pt[]; hgk?: Pt; agk?: Pt; actorHome?: Pt };
  const snaps: Snap[] = framed.map((e) => {
    const home: Pt[] = [];
    const away: Pt[] = [];
    let hgk: Pt | undefined;
    let agk: Pt | undefined;
    let actorHome: Pt | undefined;
    for (const p of byFF.get(e.id)!) {
      const q: Pt = { x: p.location[0], y: p.location[1] };
      if (p.keeper) {
        if (p.teammate) hgk = q;
        else agk = q;
        continue;
      }
      if (p.teammate) {
        home.push(q);
        if (p.actor) actorHome = q;
      } else away.push(q);
    }
    return { ball: { x: e.location![0], y: e.location![1] }, ev: tag(e.type.name), home, away, hgk, agk, actorHome };
  });
  // Final keyframe: the ball crosses the line INTO the net. Use the shot's real
  // end_location (where the ball actually finished) rather than the shooter's y —
  // a goal from a wide angle ended near the centre of the mouth, not out by the
  // post. Clamp to the goal mouth (y 36–44) as a safety net.
  const goalEnd = shot.shot?.end_location;
  const goalY = goalEnd && typeof goalEnd[1] === "number" ? cl(goalEnd[1], 36.5, 43.5) : 40;
  const tail = snaps[snaps.length - 1];
  snaps.push({ ball: { x: 120, y: goalY }, ev: "goal", home: [], away: [], hgk: tail?.hgk, agk: tail?.agk });
  const K = snaps.length;

  // Stitch the snapshots into tracks; cap each side to eleven (most-seen win, but
  // always keep the pinned scorer/assist tracks even if they appear only late).
  const finalize = (raw: (Pt | null)[][], cap: number, force: number[] = []): { tracks: Pt[][]; map: number[] } => {
    const forced = force.filter((i) => i >= 0);
    const rest = raw
      .map((t, i) => ({ i, seen: t.filter(Boolean).length }))
      .filter((x) => x.seen >= 2 && !forced.includes(x.i))
      .sort((a, b) => b.seen - a.seen)
      .map((x) => x.i);
    const chosen = [...forced, ...rest].slice(0, cap);
    return { tracks: chosen.map((i) => fillTrack(raw[i]!).map(clampPt)), map: chosen };
  };

  // The `actor` in the shot frame is the scorer; in the key-pass frame, the
  // assister — pin them in the RAW tracks before the cap can drop them.
  const rawNearest = (raw: (Pt | null)[][], target: Pt | undefined, k: number): number => {
    if (!target) return -1;
    let best = -1;
    let bd = 6; // within 6 yd or it isn't the same dot
    raw.forEach((t, i) => {
      const p = t[k];
      if (!p) return;
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const shotK = K - 2; // the Shot keyframe (last framed event)
  const kpK = keyPass ? framed.findIndex((e) => e.id === keyPass.id) : -1;
  const homeRaw = matchTracks(snaps.map((s) => s.home), 20);
  const scorerRaw = rawNearest(homeRaw, snaps[shotK]?.actorHome, shotK);
  let assistRaw = kpK >= 0 ? rawNearest(homeRaw, snaps[kpK]?.actorHome, kpK) : -1;
  if (assistRaw === scorerRaw) assistRaw = -1;
  const homeSel = finalize(homeRaw, 10, [scorerRaw, assistRaw]);
  const homeTracks = homeSel.tracks;
  const scorerIdx = homeSel.map.indexOf(scorerRaw);
  const assistIdx = assistRaw >= 0 ? homeSel.map.indexOf(assistRaw) : -1;
  const awayTracks = finalize(matchTracks(snaps.map((s) => s.away), 20), 10).tracks;

  // Keepers: a single player each — take the recorded position, hold when unseen.
  const gkTrack = (key: "hgk" | "agk", restX: number): Pt[] => {
    let last: Pt = { x: restX, y: 40 };
    return snaps.map((s) => {
      if (s[key]) last = s[key]!;
      return clampPt(last);
    });
  };
  const homeGk = gkTrack("hgk", 4);
  const awayGk = gkTrack("agk", 118);

  // Keep camera-late attackers onside at the start. The 360 camera often only
  // catches a forward once he's already advanced, and fillTrack back-fills his
  // earlier frames with that advanced spot — so he looks parked offside while the
  // ball is still in defence. For each home track's pre-sighting frames, run him
  // up from an onside start (no further forward than the second-last defender or
  // the ball) to where he is first really seen, instead of holding it.
  const offsideX = (i: number): number => {
    const xs = [...awayTracks.map((tr) => tr[i]!.x), awayGk[i]!.x].sort((a, b) => b - a);
    return Math.max(snaps[i]!.ball.x, xs[1] ?? xs[0] ?? snaps[i]!.ball.x);
  };
  homeSel.map.forEach((rawIdx, k) => {
    const firstK = homeRaw[rawIdx]!.findIndex(Boolean);
    if (firstK <= 0) return; // seen from the start — already real
    const seen = homeTracks[k]![firstK]!;
    const startX = Math.min(seen.x, offsideX(0));
    for (let i = 0; i < firstK; i++) {
      const run = startX + (seen.x - startX) * (i / firstK);
      homeTracks[k]![i] = clampPt({ x: Math.min(run, offsideX(i) + 2), y: homeTracks[k]![i]!.y });
    }
  });

  // Timing: pace each ball segment by event (pass fast, dribble slow, shot quick).
  // PACE < 1 stretches the whole replay below real-time for readability.
  const PACE = 0.4;
  const N = K - 1;
  const B: Pt[] = snaps.map((s) => s.ball);
  const seg = (i: number) => Math.hypot(B[i]!.x - B[i - 1]!.x, B[i]!.y - B[i - 1]!.y);
  const speedOf = (e?: string) => PACE * (e === "pass" ? 24 : e === "carry" ? 8 : e === "shot" || e === "goal" ? 30 : 11);
  const segT = [0];
  for (let i = 1; i <= N; i++) segT[i] = segT[i - 1]! + Math.max(seg(i), 1) / speedOf(snaps[i]!.ev);
  const totalT = segT[N] || 1;
  const durationMs = Math.max(10000, Math.min(22000, Math.round((totalT * 1000) / 100) * 100));
  const tAt = (i: number) => segT[i]! / totalT;

  const homeId = (k: number) => (k === scorerIdx ? "scorer" : k === assistIdx ? "assist" : `h${k}`);
  const keyframes = snaps.map((s, i) => {
    const actors: Record<string, Pt> = {};
    homeTracks.forEach((tr, k) => (actors[homeId(k)] = tr[i]!));
    actors.hgk = homeGk[i]!;
    awayTracks.forEach((tr, k) => (actors[`a${k}`] = tr[i]!));
    actors.keeper = awayGk[i]!;
    return {
      t: Math.round(tAt(i) * 1000) / 1000,
      ball: { x: round1(s.ball.x), y: round1(s.ball.y) },
      actors,
      ...(s.ev ? { event: s.ev } : {}),
    };
  });

  // The ball is at the acting player's feet in every source event, but the
  // stitched anonymous tracks don't always put a dot there. Snap the nearest
  // attacker exactly onto the ball each keyframe so the carrier visibly has it.
  // The final "goal" frame is left alone — the ball is already in the net.
  const homeSlotIds = homeTracks.map((_, k) => homeId(k));
  for (const kf of keyframes) {
    if (kf.event === "goal" || homeSlotIds.length === 0) continue;
    let best = homeSlotIds[0]!;
    let bd = Infinity;
    for (const sid of homeSlotIds) {
      const p = kf.actors[sid]!;
      const dd = Math.hypot(p.x - kf.ball.x, p.y - kf.ball.y);
      if (dd < bd) {
        bd = dd;
        best = sid;
      }
    }
    kf.actors[best] = { x: kf.ball.x, y: kf.ball.y };
  }

  const playScript = {
    version: 1,
    goalType: "open_play",
    durationMs,
    attackingSide: "home",
    actors: [
      ...homeTracks.map((_, k) => ({
        slotId: homeId(k),
        team: "home",
        role: k === scorerIdx ? "scorer" : k === assistIdx ? "assist" : "carrier",
        ...(k === scorerIdx && scorerNum !== undefined ? { shirtNumber: scorerNum } : {}),
        ...(k === assistIdx && assistNum !== undefined ? { shirtNumber: assistNum } : {}),
      })),
      { slotId: "hgk", team: "home", role: "keeper" },
      ...awayTracks.map((_, k) => ({ slotId: `a${k}`, team: "away", role: "defender" })),
      { slotId: "keeper", team: "away", role: "keeper" },
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
  const scorerQ = nameOptions(scorerFull, 11);
  // Solo finishes (e.g. a rebound) have no key pass — skip the assist question
  // rather than show a blank option.
  const assistQ = assistFull ? nameOptions(assistFull, 21) : null;

  // No "which World Cup?" question — the title already names the tournament, so
  // asking the year would be giving away the answer.
  const distractors = [
    { slotId: "scorer", role: "scorer", prompt: "Who finished the move?", options: scorerQ.options },
    ...(assistQ ? [{ slotId: "assist", role: "assist", prompt: "Who provided the assist?", options: assistQ.options }] : []),
    { slotId: "bodypart", role: "scorer", prompt: "Finished with…", options: bodyOptions },
  ];
  const answerKey: Record<string, string> = { scorer: scorerQ.correctId, bodypart: "correct" };
  if (assistQ) answerKey.assist = assistQ.correctId;

  // Team kits for the replay jerseys: home = the scoring team, away = opponent.
  const oppSquad = SQUADS_BY_NAME[cfg.opponent];
  const kit = (t?: { flagEmoji: string; primaryColor: string; secondaryColor: string }) =>
    t ? { flag: t.flagEmoji, primary: t.primaryColor, secondary: t.secondaryColor } : undefined;

  return {
    providerEventId: cfg.providerEventId,
    title: cfg.title,
    // The scorer mapped to our squad — links a golazo card to its historic moment.
    playerId: toSquad(scorerFull, squad)?.id ?? null,
    home: kit(squad?.team),
    away: kit(oppSquad?.team),
    playScript,
    distractors,
    answerKey,
    _debug: { scorer: scorerFull, assist: assistFull, body: bodyPart, keyframes: keyframes.length },
  };
}

async function main(): Promise<void> {
  const byMatch = new Map<number, SbEvent[]>();
  const byMatch360 = new Map<number, Map<string, FF[]>>();
  for (const matchId of new Set(GOALS.map((g) => g.matchId))) {
    byMatch.set(matchId, await loadEvents(matchId));
    byMatch360.set(matchId, await load360(matchId));
  }
  const jugadas = GOALS.map((cfg) => buildJugada(byMatch.get(cfg.matchId)!, byMatch360.get(cfg.matchId)!, cfg));

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
