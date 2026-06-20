import { createClient } from "@supabase/supabase-js";
import type { StickerCard } from "../../../packages/shared/src/index.ts";
import { WC2026_TEAMS } from "./wc2026-teams.ts";

/**
 * Seeds the 48 WC 2026 team-badge stickers for the mega-album (the
 * tournament-wide collection). Badges have no match_id, so open_pack includes
 * them in every roll — the mega-album fills as you open packs. Idempotent.
 * See ticket VIT-10.
 */

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? LOCAL_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows = WC2026_TEAMS.map((t, slot) => {
    const meta: StickerCard = {
      kind: "badge",
      rarity: "common",
      team: {
        code: t.code,
        name: t.name,
        flagEmoji: t.flag,
        primaryColor: t.primary,
        secondaryColor: t.secondary,
      },
      title: t.name,
      subtitle: t.group,
      group: t.group,
    };
    return {
      match_id: null,
      album_slot: slot,
      rarity: "common",
      title: t.name,
      subtitle: t.group,
      embedded_jugada_id: null,
      meta,
    };
  });

  await supabase.from("stickers").delete().is("match_id", null);
  const { error } = await supabase.from("stickers").insert(rows);
  if (error) {
    console.error(`mega-album insert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ seeded ${rows.length} team badges across ${new Set(WC2026_TEAMS.map((t) => t.group)).size} groups`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
