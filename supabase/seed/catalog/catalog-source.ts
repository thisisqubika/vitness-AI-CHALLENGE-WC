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
  "eng-10", // Bellingham
  "eng-9", // Kane
  "eng-7", // Saka
  "fra-10", // Mbappé
  "fra-7", // Griezmann
  "ger-10", // Musiala
  "ger-17", // Wirtz
  "bra-11", // Vinícius Júnior
  "bra-7", // Raphinha
  "bra-9", // Endrick
  "esp-19", // Lamine Yamal
  "esp-26", // Pedri
  "por-7", // Ronaldo
  "por-8", // Bruno Fernandes
  "ned-4", // Van Dijk
  "ned-11", // Gakpo
]);

export const ENGLAND: TeamSquad = {
  team: { code: "ENG", name: "England", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", primaryColor: "#ffffff", secondaryColor: "#0a3b8c" },
  players: [
    { id: "eng-1", name: "Jordan Pickford", shirtNumber: 1, position: "GK" },
    { id: "eng-2", name: "Kyle Walker", shirtNumber: 2, position: "RB" },
    { id: "eng-5", name: "John Stones", shirtNumber: 5, position: "CB" },
    { id: "eng-6", name: "Marc Guéhi", shirtNumber: 6, position: "CB" },
    { id: "eng-3", name: "Luke Shaw", shirtNumber: 3, position: "LB" },
    { id: "eng-4", name: "Declan Rice", shirtNumber: 4, position: "DM" },
    { id: "eng-10", name: "Jude Bellingham", shirtNumber: 10, position: "CM" },
    { id: "eng-7", name: "Bukayo Saka", shirtNumber: 7, position: "RW" },
    { id: "eng-11", name: "Phil Foden", shirtNumber: 11, position: "AM" },
    { id: "eng-9", name: "Harry Kane", shirtNumber: 9, position: "ST" },
    { id: "eng-19", name: "Marcus Rashford", shirtNumber: 19, position: "LW" },
    { id: "eng-24", name: "Cole Palmer", shirtNumber: 24, position: "AM" },
  ],
};

export const FRANCE: TeamSquad = {
  team: { code: "FRA", name: "France", flagEmoji: "🇫🇷", primaryColor: "#1f3a93", secondaryColor: "#ffffff" },
  players: [
    { id: "fra-16", name: "Mike Maignan", shirtNumber: 16, position: "GK" },
    { id: "fra-5", name: "Jules Koundé", shirtNumber: 5, position: "RB" },
    { id: "fra-17", name: "William Saliba", shirtNumber: 17, position: "CB" },
    { id: "fra-4", name: "Dayot Upamecano", shirtNumber: 4, position: "CB" },
    { id: "fra-22", name: "Theo Hernández", shirtNumber: 22, position: "LB" },
    { id: "fra-8", name: "Aurélien Tchouaméni", shirtNumber: 8, position: "DM" },
    { id: "fra-25", name: "Eduardo Camavinga", shirtNumber: 25, position: "CM" },
    { id: "fra-7", name: "Antoine Griezmann", shirtNumber: 7, position: "AM" },
    { id: "fra-11", name: "Ousmane Dembélé", shirtNumber: 11, position: "RW" },
    { id: "fra-10", name: "Kylian Mbappé", shirtNumber: 10, position: "ST" },
    { id: "fra-20", name: "Bradley Barcola", shirtNumber: 20, position: "LW" },
    { id: "fra-12", name: "Randal Kolo Muani", shirtNumber: 12, position: "ST" },
  ],
};

export const GERMANY: TeamSquad = {
  team: { code: "GER", name: "Germany", flagEmoji: "🇩🇪", primaryColor: "#000000", secondaryColor: "#ffffff" },
  players: [
    { id: "ger-1", name: "Marc-André ter Stegen", shirtNumber: 1, position: "GK" },
    { id: "ger-6", name: "Joshua Kimmich", shirtNumber: 6, position: "RB" },
    { id: "ger-15", name: "Nico Schlotterbeck", shirtNumber: 15, position: "CB" },
    { id: "ger-4", name: "Jonathan Tah", shirtNumber: 4, position: "CB" },
    { id: "ger-18", name: "Maximilian Mittelstädt", shirtNumber: 18, position: "LB" },
    { id: "ger-23", name: "Robert Andrich", shirtNumber: 23, position: "DM" },
    { id: "ger-8", name: "Felix Nmecha", shirtNumber: 8, position: "CM" },
    { id: "ger-10", name: "Jamal Musiala", shirtNumber: 10, position: "AM" },
    { id: "ger-17", name: "Florian Wirtz", shirtNumber: 17, position: "AM" },
    { id: "ger-7", name: "Kai Havertz", shirtNumber: 7, position: "ST" },
    { id: "ger-19", name: "Leroy Sané", shirtNumber: 19, position: "RW" },
    { id: "ger-9", name: "Niclas Füllkrug", shirtNumber: 9, position: "ST" },
  ],
};

export const BRAZIL: TeamSquad = {
  team: { code: "BRA", name: "Brazil", flagEmoji: "🇧🇷", primaryColor: "#fcd116", secondaryColor: "#009739" },
  players: [
    { id: "bra-1", name: "Alisson", shirtNumber: 1, position: "GK" },
    { id: "bra-2", name: "Danilo", shirtNumber: 2, position: "RB" },
    { id: "bra-3", name: "Marquinhos", shirtNumber: 3, position: "CB" },
    { id: "bra-4", name: "Gabriel Magalhães", shirtNumber: 4, position: "CB" },
    { id: "bra-6", name: "Wendell", shirtNumber: 6, position: "LB" },
    { id: "bra-5", name: "Bruno Guimarães", shirtNumber: 5, position: "DM" },
    { id: "bra-8", name: "Lucas Paquetá", shirtNumber: 8, position: "CM" },
    { id: "bra-7", name: "Raphinha", shirtNumber: 7, position: "RW" },
    { id: "bra-10", name: "Rodrygo", shirtNumber: 10, position: "AM" },
    { id: "bra-11", name: "Vinícius Júnior", shirtNumber: 11, position: "LW" },
    { id: "bra-9", name: "Endrick", shirtNumber: 9, position: "ST" },
  ],
};

export const SPAIN: TeamSquad = {
  team: { code: "ESP", name: "Spain", flagEmoji: "🇪🇸", primaryColor: "#c60b1e", secondaryColor: "#ffc400" },
  players: [
    { id: "esp-23", name: "Unai Simón", shirtNumber: 23, position: "GK" },
    { id: "esp-2", name: "Dani Carvajal", shirtNumber: 2, position: "RB" },
    { id: "esp-14", name: "Aymeric Laporte", shirtNumber: 14, position: "CB" },
    { id: "esp-4", name: "Robin Le Normand", shirtNumber: 4, position: "CB" },
    { id: "esp-24", name: "Marc Cucurella", shirtNumber: 24, position: "LB" },
    { id: "esp-16", name: "Rodri", shirtNumber: 16, position: "DM" },
    { id: "esp-8", name: "Fabián Ruiz", shirtNumber: 8, position: "CM" },
    { id: "esp-26", name: "Pedri", shirtNumber: 26, position: "CM" },
    { id: "esp-19", name: "Lamine Yamal", shirtNumber: 19, position: "RW" },
    { id: "esp-17", name: "Nico Williams", shirtNumber: 17, position: "LW" },
    { id: "esp-9", name: "Álvaro Morata", shirtNumber: 9, position: "ST" },
  ],
};

export const PORTUGAL: TeamSquad = {
  team: { code: "POR", name: "Portugal", flagEmoji: "🇵🇹", primaryColor: "#da291c", secondaryColor: "#046a38" },
  players: [
    { id: "por-1", name: "Diogo Costa", shirtNumber: 1, position: "GK" },
    { id: "por-2", name: "Diogo Dalot", shirtNumber: 2, position: "RB" },
    { id: "por-3", name: "Rúben Dias", shirtNumber: 3, position: "CB" },
    { id: "por-4", name: "Gonçalo Inácio", shirtNumber: 4, position: "CB" },
    { id: "por-20", name: "Nuno Mendes", shirtNumber: 20, position: "LB" },
    { id: "por-6", name: "João Palhinha", shirtNumber: 6, position: "DM" },
    { id: "por-8", name: "Bruno Fernandes", shirtNumber: 8, position: "CM" },
    { id: "por-10", name: "Bernardo Silva", shirtNumber: 10, position: "AM" },
    { id: "por-7", name: "Cristiano Ronaldo", shirtNumber: 7, position: "ST" },
    { id: "por-21", name: "Diogo Jota", shirtNumber: 21, position: "ST" },
    { id: "por-11", name: "Rafael Leão", shirtNumber: 11, position: "LW" },
  ],
};

export const NETHERLANDS: TeamSquad = {
  team: { code: "NED", name: "Netherlands", flagEmoji: "🇳🇱", primaryColor: "#ff7f00", secondaryColor: "#21468b" },
  players: [
    { id: "ned-1", name: "Bart Verbruggen", shirtNumber: 1, position: "GK" },
    { id: "ned-22", name: "Denzel Dumfries", shirtNumber: 22, position: "RB" },
    { id: "ned-4", name: "Virgil van Dijk", shirtNumber: 4, position: "CB" },
    { id: "ned-3", name: "Stefan de Vrij", shirtNumber: 3, position: "CB" },
    { id: "ned-17", name: "Nathan Aké", shirtNumber: 17, position: "LB" },
    { id: "ned-6", name: "Jerdy Schouten", shirtNumber: 6, position: "DM" },
    { id: "ned-14", name: "Tijjani Reijnders", shirtNumber: 14, position: "CM" },
    { id: "ned-21", name: "Frenkie de Jong", shirtNumber: 21, position: "CM" },
    { id: "ned-11", name: "Cody Gakpo", shirtNumber: 11, position: "LW" },
    { id: "ned-10", name: "Memphis Depay", shirtNumber: 10, position: "ST" },
    { id: "ned-18", name: "Donyell Malen", shirtNumber: 18, position: "RW" },
  ],
};

export const DEMO_MATCH_ID = "wc2026-grp-arg-mex";
export const SQUADS: TeamSquad[] = [ARGENTINA, MEXICO];

/** Squads keyed by the team name as it appears in the openfootball snapshot,
 * for seeding who-scored trivia on real goals. */
export const SQUADS_BY_NAME: Record<string, TeamSquad> = {
  Argentina: ARGENTINA,
  Mexico: MEXICO,
  England: ENGLAND,
  France: FRANCE,
  Germany: GERMANY,
  Brazil: BRAZIL,
  Spain: SPAIN,
  Portugal: PORTUGAL,
  Netherlands: NETHERLANDS,
};
