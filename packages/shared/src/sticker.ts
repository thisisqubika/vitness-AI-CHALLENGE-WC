import { z } from "zod";
import { StickerRaritySchema } from "./domain.ts";

/**
 * Sticker render payload — everything a procedural card needs to draw, stored in
 * stickers.meta so the app draws from one row with no joins. Factual data only
 * (name, number, position, team, flag, colours): original cards, no licensed
 * imagery. See docs/CONCEPT.md § The Collection and ticket VIT-5.
 */

export const StickerKindSchema = z.enum(["player", "moment", "motm", "golazo", "badge"]);
export type StickerKind = z.infer<typeof StickerKindSchema>;

export const TeamMetaSchema = z.object({
  code: z.string(),
  name: z.string(),
  flagEmoji: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
});
export type TeamMeta = z.infer<typeof TeamMetaSchema>;

export const StickerCardSchema = z.object({
  kind: StickerKindSchema,
  rarity: StickerRaritySchema,
  team: TeamMetaSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  playerName: z.string().optional(),
  shirtNumber: z.number().int().min(1).max(99).optional(),
  position: z.string().optional(),
  embeddedJugadaId: z.string().optional(),
  /** For golazo cards: the retro jugada (real historic goal of this player) that
   * owning the card unlocks. Matches a providerEventId in retro-jugadas.json. */
  historicMomentId: z.string().optional(),
  /** For badge cards: the WC 2026 group (e.g. "Group C"), used by the mega-album. */
  group: z.string().optional(),
});
export type StickerCard = z.infer<typeof StickerCardSchema>;

/** Hex accent per rarity for the card frame. */
export const RARITY_COLOR: Record<z.infer<typeof StickerRaritySchema>, string> = {
  common: "#888780",
  rare: "#378ADD",
  golazo: "#EF9F27",
};

export const RARITY_LABEL: Record<z.infer<typeof StickerRaritySchema>, string> = {
  common: "Common",
  rare: "Rare",
  golazo: "Golazo",
};
