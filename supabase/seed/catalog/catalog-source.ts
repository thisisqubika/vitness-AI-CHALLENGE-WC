import type { TeamMeta } from "../../../packages/shared/src/index.ts";

/**
 * Hand-curated catalog source. Team display metadata + squads for the demo
 * teams, mirroring the ARG/MEX replay fixture lineups. The 48-team mega-album
 * structure (from openfootball) is a follow-up; this is enough for an accurate
 * match album now. Factual data only — see ticket VIT-5.
 */

export interface SquadPlayer {
  id: string;
  name: string;
  shirtNumber: number;
  position: string;
}

export interface TeamSquad {
  team: TeamMeta;
  players: SquadPlayer[];
}

export const ARGENTINA: TeamSquad = {
  team: { code: "ARG", name: "Argentina", flagEmoji: "🇦🇷", primaryColor: "#75AADB", secondaryColor: "#ffffff" },
  players: [
    { id: "arg-23", name: "Emiliano Martínez", shirtNumber: 23, position: "GK" },
    { id: "arg-26", name: "Nahuel Molina", shirtNumber: 26, position: "RB" },
    { id: "arg-13", name: "Cristian Romero", shirtNumber: 13, position: "CB" },
    { id: "arg-19", name: "Nicolás Otamendi", shirtNumber: 19, position: "CB" },
    { id: "arg-3", name: "Nicolás Tagliafico", shirtNumber: 3, position: "LB" },
    { id: "arg-7", name: "Rodrigo De Paul", shirtNumber: 7, position: "CM" },
    { id: "arg-5", name: "Leandro Paredes", shirtNumber: 5, position: "CM" },
    { id: "arg-20", name: "Alexis Mac Allister", shirtNumber: 20, position: "CM" },
    { id: "arg-11", name: "Ángel Di María", shirtNumber: 11, position: "RW" },
    { id: "arg-10", name: "Lionel Messi", shirtNumber: 10, position: "AM" },
    { id: "arg-9", name: "Julián Álvarez", shirtNumber: 9, position: "ST" },
  ],
};

export const MEXICO: TeamSquad = {
  team: { code: "MEX", name: "Mexico", flagEmoji: "🇲🇽", primaryColor: "#006847", secondaryColor: "#ffffff" },
  players: [
    { id: "mex-1", name: "Guillermo Ochoa", shirtNumber: 1, position: "GK" },
    { id: "mex-3", name: "César Montes", shirtNumber: 3, position: "CB" },
    { id: "mex-15", name: "Johan Vásquez", shirtNumber: 15, position: "CB" },
    { id: "mex-23", name: "Jesús Gallardo", shirtNumber: 23, position: "LB" },
    { id: "mex-19", name: "Jorge Sánchez", shirtNumber: 19, position: "RB" },
    { id: "mex-4", name: "Edson Álvarez", shirtNumber: 4, position: "DM" },
    { id: "mex-16", name: "Héctor Herrera", shirtNumber: 16, position: "CM" },
    { id: "mex-22", name: "Hirving Lozano", shirtNumber: 22, position: "RW" },
    { id: "mex-8", name: "Carlos Rodríguez", shirtNumber: 8, position: "AM" },
    { id: "mex-11", name: "Alexis Vega", shirtNumber: 11, position: "LW" },
    { id: "mex-9", name: "Raúl Jiménez", shirtNumber: 9, position: "ST" },
  ],
};

/** Star players who roll at higher rarity (the rest are common). */
export const RARE_PLAYER_IDS = new Set<string>([
  "arg-10", // Messi
  "arg-9", // Julián Álvarez
  "arg-11", // Di María
  "arg-23", // E. Martínez
  "mex-9", // Jiménez
  "mex-22", // Lozano
  "mex-1", // Ochoa
]);

export const DEMO_MATCH_ID = "wc2026-grp-arg-mex";
export const SQUADS: TeamSquad[] = [ARGENTINA, MEXICO];
