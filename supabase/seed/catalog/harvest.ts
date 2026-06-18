import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * One-shot, resume-safe harvester for API-Football. Pulls everything the app
 * needs for WC 2026 — league, teams, squads, fixtures — in a single run and
 * snapshots each response to raw/ (committed). Downstream tooling reads the
 * snapshot, never the API, so the 100-requests/day free tier is spent once.
 *
 * Safety for the low cap:
 *  - resumable: a team whose squad file already exists is skipped, so a re-run
 *    (even the next day) continues without re-spending calls;
 *  - rate-limited: respects the per-minute throttle and stops before the daily
 *    cap is exhausted, logging what remains;
 *  - probes free-tier access first (the free tier often blocks current seasons)
 *    and aborts cleanly rather than burning calls.
 *
 * Usage: API_FOOTBALL_KEY=... node supabase/seed/catalog/harvest.ts
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, "raw");
const SQUADS = join(RAW, "squads");

const BASE = "https://v3.football.api-sports.io";
const WC_SEASON = 2026;
const PER_MINUTE_THROTTLE_MS = 7000;
const DAILY_STOP_THRESHOLD = 5;

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) {
  console.error(
    "Missing API_FOOTBALL_KEY. Sign up (free) at https://dashboard.api-football.com,\n" +
      "then: API_FOOTBALL_KEY=<key> node supabase/seed/catalog/harvest.ts",
  );
  process.exit(1);
}

mkdirSync(SQUADS, { recursive: true });

let dailyRemaining = Infinity;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ApiResult {
  response: unknown[];
  errors: unknown;
}

/** One GET against API-Football. Records rate-limit headers and the raw body. */
async function get(path: string): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY! } });

  const reqRemaining = res.headers.get("x-ratelimit-requests-remaining");
  if (reqRemaining !== null) dailyRemaining = Number(reqRemaining);

  const body = (await res.json()) as ApiResult & { results?: number };

  const errors = body.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    console.error(`API error for ${path}:`, JSON.stringify(errors));
    if (JSON.stringify(errors).toLowerCase().includes("plan")) {
      console.error(
        "\nThis looks like a free-tier restriction (the season/endpoint is not on your plan).\n" +
          "WC 2026 may be blocked on free. Options: a paid day, or pivot to hand-curated squads.",
      );
      process.exit(2);
    }
  }
  return body;
}

function save(name: string, data: unknown): void {
  writeFileSync(join(RAW, name), JSON.stringify(data, null, 2) + "\n");
}

async function resolveLeagueId(): Promise<number> {
  const cached = join(RAW, "league.json");
  if (existsSync(cached)) {
    const id = JSON.parse(readFileSync(cached, "utf8")).id as number;
    console.log(`league: cached id ${id}`);
    return id;
  }
  const data = await get(`/leagues?search=world cup`);
  const wc = (data.response as Array<{ league: { id: number; name: string; type: string } }>).find(
    (l) => l.league.type === "Cup" && /world cup/i.test(l.league.name) && !/women|u-?\d/i.test(l.league.name),
  );
  if (!wc) {
    console.error("could not resolve the World Cup league id from /leagues");
    process.exit(1);
  }
  save("league.json", { id: wc.league.id, name: wc.league.name });
  console.log(`league: resolved "${wc.league.name}" id ${wc.league.id} (daily remaining ${dailyRemaining})`);
  return wc.league.id;
}

async function harvestTeams(leagueId: number): Promise<Array<{ id: number; name: string }>> {
  const cached = join(RAW, "teams.json");
  if (existsSync(cached)) {
    const teams = JSON.parse(readFileSync(cached, "utf8"));
    console.log(`teams: cached (${teams.length})`);
    return teams;
  }
  const data = await get(`/teams?league=${leagueId}&season=${WC_SEASON}`);
  const teams = (data.response as Array<{ team: { id: number; name: string } }>).map((t) => ({
    id: t.team.id,
    name: t.team.name,
  }));
  save("teams.json", teams);
  console.log(`teams: ${teams.length} (daily remaining ${dailyRemaining})`);
  return teams;
}

async function harvestSquads(teams: Array<{ id: number; name: string }>): Promise<void> {
  for (const team of teams) {
    const file = join(SQUADS, `${team.id}.json`);
    if (existsSync(file)) continue;
    if (dailyRemaining <= DAILY_STOP_THRESHOLD) {
      console.warn(
        `\nStopping: daily quota nearly exhausted (${dailyRemaining} left). ` +
          `Re-run later — already-fetched teams are skipped.`,
      );
      return;
    }
    const data = await get(`/players/squads?team=${team.id}`);
    writeFileSync(file, JSON.stringify(data.response, null, 2) + "\n");
    console.log(`squad: ${team.name} (#${team.id}) saved (daily remaining ${dailyRemaining})`);
    await sleep(PER_MINUTE_THROTTLE_MS);
  }
}

async function harvestFixtures(leagueId: number): Promise<void> {
  const cached = join(RAW, "fixtures.json");
  if (existsSync(cached)) {
    console.log("fixtures: cached");
    return;
  }
  if (dailyRemaining <= DAILY_STOP_THRESHOLD) return;
  const data = await get(`/fixtures?league=${leagueId}&season=${WC_SEASON}`);
  save("fixtures.json", data.response);
  console.log(`fixtures: ${data.response.length} (daily remaining ${dailyRemaining})`);
}

async function main(): Promise<void> {
  console.log("Harvesting WC 2026 data from API-Football (resume-safe, rate-limited)…");
  const leagueId = await resolveLeagueId();
  const teams = await harvestTeams(leagueId);
  await harvestSquads(teams);
  await harvestFixtures(leagueId);

  const fetched = teams.filter((t) => existsSync(join(SQUADS, `${t.id}.json`))).length;
  save("_meta.json", { season: WC_SEASON, leagueId, teams: teams.length, squadsFetched: fetched });
  console.log(
    `\nDone. Squads: ${fetched}/${teams.length}. Daily remaining ~${dailyRemaining}. ` +
      `${fetched < teams.length ? "Re-run to fetch the rest." : "Complete — snapshot is in raw/."}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
