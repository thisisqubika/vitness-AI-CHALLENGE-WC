import type { PlayScript } from "@vitness/shared";

import data from "./retro-jugadas.json";

/**
 * Retro jugadas compiled from real StatsBomb data (see
 * supabase/seed/retro/compile-retro.ts). The play-script drives the
 * reconstruction; the server jugada_challenges view + submit-answer provide the
 * graded trivia. See ticket VIT-8.
 */
export interface TeamKit {
  flag: string;
  primary: string;
  secondary: string;
}

export interface RetroJugada {
  providerEventId: string;
  title: string;
  playScript: PlayScript;
  home?: TeamKit;
  away?: TeamKit;
}

export const RETRO_JUGADAS = data as unknown as RetroJugada[];

export function retroJugadaOfTheDay(): RetroJugada | null {
  return RETRO_JUGADAS[0] ?? null;
}

/** Look up a retro jugada by its providerEventId — used to resolve a golazo
 * card's unlocked historic moment (card.historicMomentId). */
export function retroJugadaById(providerEventId: string | undefined): RetroJugada | null {
  if (!providerEventId) return null;
  return RETRO_JUGADAS.find((j) => j.providerEventId === providerEventId) ?? null;
}
