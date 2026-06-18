import { createClient } from "@supabase/supabase-js";
import type { StickerCard } from "../../../packages/shared/src/index.ts";
import { SQUADS, RARE_PLAYER_IDS, DEMO_MATCH_ID } from "./catalog-source.ts";

/**
 * Builds the sticker catalog from the curated squads and seeds the stickers
 * table. Player cards (rarity by standout heuristic) plus the demo match's MOTM
 * and golazo (linked to the winning goal's jugada). Each row carries a
 * StickerCard render payload in meta so the app draws from one row. Idempotent
 * per match. See ticket VIT-5.
 */

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

interface StickerRow {
  match_id: string;
  album_slot: number;
  rarity: string;
  title: string;
  subtitle: string;
  embedded_jugada_id: string | null;
  meta: StickerCard;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? LOCAL_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: golazoJugada } = await supabase
    .from("jugadas")
    .select("id")
    .eq("provider_event_id", "arg-mex-e10")
    .maybeSingle();

  const rows: StickerRow[] = [];
  let slot = 0;

  for (const squad of SQUADS) {
    for (const p of squad.players) {
      const rarity = RARE_PLAYER_IDS.has(p.id) ? "rare" : "common";
      rows.push({
        match_id: DEMO_MATCH_ID,
        album_slot: slot++,
        rarity,
        title: p.name,
        subtitle: `${p.position} · ${squad.team.name}`,
        embedded_jugada_id: null,
        meta: {
          kind: "player",
          rarity,
          team: squad.team,
          title: p.name,
          subtitle: `${p.position} · ${squad.team.name}`,
          playerName: p.name,
          shirtNumber: p.shirtNumber,
          position: p.position,
        },
      });
    }
  }

  const arg = SQUADS[0]!;
  rows.push({
    match_id: DEMO_MATCH_ID,
    album_slot: slot++,
    rarity: "rare",
    title: "Player of the Match",
    subtitle: "Lionel Messi",
    embedded_jugada_id: null,
    meta: {
      kind: "motm",
      rarity: "rare",
      team: arg.team,
      title: "Player of the Match",
      subtitle: "Lionel Messi",
      playerName: "Lionel Messi",
      shirtNumber: 10,
      position: "AM",
    },
  });

  rows.push({
    match_id: DEMO_MATCH_ID,
    album_slot: slot++,
    rarity: "golazo",
    title: "Messi · 76' winner",
    subtitle: "Golazo",
    embedded_jugada_id: golazoJugada?.id ?? null,
    meta: {
      kind: "golazo",
      rarity: "golazo",
      team: arg.team,
      title: "Messi · 76' winner",
      subtitle: "Golazo",
      embeddedJugadaId: golazoJugada?.id ?? undefined,
    },
  });

  await supabase.from("stickers").delete().eq("match_id", DEMO_MATCH_ID);
  const { error } = await supabase.from("stickers").insert(rows);
  if (error) {
    console.error(`catalog insert failed: ${error.message}`);
    process.exit(1);
  }

  const byRarity = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.rarity] = (acc[r.rarity] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✓ seeded ${rows.length} stickers for ${DEMO_MATCH_ID}:`, JSON.stringify(byRarity));
  console.log(`  golazo linked to jugada: ${golazoJugada?.id ?? "(none — seed jugadas first)"}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
