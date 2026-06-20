/**
 * The real WC 2026 group draw (from the openfootball snapshot): 48 teams across
 * 12 groups, with display metadata (flag, kit colours) for the mega-album badge
 * cards. Names match the openfootball team names exactly. Factual data only.
 * See ticket VIT-10 (mega-album).
 */

export interface TournamentTeam {
  name: string;
  code: string;
  flag: string;
  group: string;
  primary: string;
  secondary: string;
}

export const WC2026_TEAMS: TournamentTeam[] = [
  { name: "Mexico", code: "MEX", flag: "🇲🇽", group: "Group A", primary: "#006847", secondary: "#ffffff" },
  { name: "South Africa", code: "RSA", flag: "🇿🇦", group: "Group A", primary: "#007a4d", secondary: "#ffb612" },
  { name: "South Korea", code: "KOR", flag: "🇰🇷", group: "Group A", primary: "#c8102e", secondary: "#003478" },
  { name: "Czech Republic", code: "CZE", flag: "🇨🇿", group: "Group A", primary: "#11457e", secondary: "#d7141a" },
  { name: "Canada", code: "CAN", flag: "🇨🇦", group: "Group B", primary: "#d52b1e", secondary: "#ffffff" },
  { name: "Bosnia & Herzegovina", code: "BIH", flag: "🇧🇦", group: "Group B", primary: "#002395", secondary: "#ffec00" },
  { name: "Qatar", code: "QAT", flag: "🇶🇦", group: "Group B", primary: "#8a1538", secondary: "#ffffff" },
  { name: "Switzerland", code: "SUI", flag: "🇨🇭", group: "Group B", primary: "#d52b1e", secondary: "#ffffff" },
  { name: "Brazil", code: "BRA", flag: "🇧🇷", group: "Group C", primary: "#fcd116", secondary: "#009739" },
  { name: "Morocco", code: "MAR", flag: "🇲🇦", group: "Group C", primary: "#c1272d", secondary: "#006233" },
  { name: "Haiti", code: "HAI", flag: "🇭🇹", group: "Group C", primary: "#00209f", secondary: "#d21034" },
  { name: "Scotland", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "Group C", primary: "#0065bd", secondary: "#ffffff" },
  { name: "USA", code: "USA", flag: "🇺🇸", group: "Group D", primary: "#0a3161", secondary: "#b31942" },
  { name: "Paraguay", code: "PAR", flag: "🇵🇾", group: "Group D", primary: "#d52b1e", secondary: "#0038a8" },
  { name: "Australia", code: "AUS", flag: "🇦🇺", group: "Group D", primary: "#00843d", secondary: "#ffcd00" },
  { name: "Turkey", code: "TUR", flag: "🇹🇷", group: "Group D", primary: "#e30a17", secondary: "#ffffff" },
  { name: "Germany", code: "GER", flag: "🇩🇪", group: "Group E", primary: "#000000", secondary: "#ffffff" },
  { name: "Curaçao", code: "CUW", flag: "🇨🇼", group: "Group E", primary: "#002b7f", secondary: "#f9e814" },
  { name: "Ivory Coast", code: "CIV", flag: "🇨🇮", group: "Group E", primary: "#f77f00", secondary: "#009e60" },
  { name: "Ecuador", code: "ECU", flag: "🇪🇨", group: "Group E", primary: "#ffd100", secondary: "#0072ce" },
  { name: "Netherlands", code: "NED", flag: "🇳🇱", group: "Group F", primary: "#ff7f00", secondary: "#21468b" },
  { name: "Japan", code: "JPN", flag: "🇯🇵", group: "Group F", primary: "#000091", secondary: "#bc002d" },
  { name: "Sweden", code: "SWE", flag: "🇸🇪", group: "Group F", primary: "#006aa7", secondary: "#fecc00" },
  { name: "Tunisia", code: "TUN", flag: "🇹🇳", group: "Group F", primary: "#e70013", secondary: "#ffffff" },
  { name: "Belgium", code: "BEL", flag: "🇧🇪", group: "Group G", primary: "#e30613", secondary: "#fdda24" },
  { name: "Egypt", code: "EGY", flag: "🇪🇬", group: "Group G", primary: "#ce1126", secondary: "#000000" },
  { name: "Iran", code: "IRN", flag: "🇮🇷", group: "Group G", primary: "#239f40", secondary: "#da0000" },
  { name: "New Zealand", code: "NZL", flag: "🇳🇿", group: "Group G", primary: "#000000", secondary: "#ffffff" },
  { name: "Spain", code: "ESP", flag: "🇪🇸", group: "Group H", primary: "#c60b1e", secondary: "#ffc400" },
  { name: "Cape Verde", code: "CPV", flag: "🇨🇻", group: "Group H", primary: "#003893", secondary: "#cf2027" },
  { name: "Saudi Arabia", code: "KSA", flag: "🇸🇦", group: "Group H", primary: "#006c35", secondary: "#ffffff" },
  { name: "Uruguay", code: "URU", flag: "🇺🇾", group: "Group H", primary: "#7b9fd4", secondary: "#001489" },
  { name: "France", code: "FRA", flag: "🇫🇷", group: "Group I", primary: "#1f3a93", secondary: "#ffffff" },
  { name: "Senegal", code: "SEN", flag: "🇸🇳", group: "Group I", primary: "#00853f", secondary: "#fdef42" },
  { name: "Iraq", code: "IRQ", flag: "🇮🇶", group: "Group I", primary: "#ce1126", secondary: "#000000" },
  { name: "Norway", code: "NOR", flag: "🇳🇴", group: "Group I", primary: "#ba0c2f", secondary: "#00205b" },
  { name: "Argentina", code: "ARG", flag: "🇦🇷", group: "Group J", primary: "#75AADB", secondary: "#ffffff" },
  { name: "Algeria", code: "ALG", flag: "🇩🇿", group: "Group J", primary: "#006233", secondary: "#ffffff" },
  { name: "Austria", code: "AUT", flag: "🇦🇹", group: "Group J", primary: "#ed2939", secondary: "#ffffff" },
  { name: "Jordan", code: "JOR", flag: "🇯🇴", group: "Group J", primary: "#007a3d", secondary: "#ce1126" },
  { name: "Portugal", code: "POR", flag: "🇵🇹", group: "Group K", primary: "#da291c", secondary: "#046a38" },
  { name: "DR Congo", code: "COD", flag: "🇨🇩", group: "Group K", primary: "#007fff", secondary: "#f7d618" },
  { name: "Uzbekistan", code: "UZB", flag: "🇺🇿", group: "Group K", primary: "#1eb53a", secondary: "#0099b5" },
  { name: "Colombia", code: "COL", flag: "🇨🇴", group: "Group K", primary: "#ffcd00", secondary: "#003087" },
  { name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "Group L", primary: "#ffffff", secondary: "#0a3b8c" },
  { name: "Croatia", code: "CRO", flag: "🇭🇷", group: "Group L", primary: "#ff0000", secondary: "#ffffff" },
  { name: "Ghana", code: "GHA", flag: "🇬🇭", group: "Group L", primary: "#006b3f", secondary: "#fcd116" },
  { name: "Panama", code: "PAN", flag: "🇵🇦", group: "Group L", primary: "#005293", secondary: "#d21034" },
];
