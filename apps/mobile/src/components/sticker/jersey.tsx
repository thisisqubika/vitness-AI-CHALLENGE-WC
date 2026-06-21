import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

/**
 * A procedural football shirt drawn in a team's colours, with the shirt number
 * across the front — the player card's hero element (replaces the bare number).
 * Body = primary colour, collar + sleeve cuffs = secondary, number auto-picks a
 * dark or light fill for contrast against the body. Original artwork, no
 * licensed kits. See ticket VIT-5 (sticker catalog).
 */

const SHIRT =
  "M35 18 L48 24 Q60 34 72 24 L85 18 L112 32 L104 52 L92 48 L92 106 L28 106 L28 48 L16 52 L8 32 Z";
const COLLAR = "M51 23 L60 33 L69 23 L64 21 Q60 26 56 21 Z";
const LEFT_CUFF = "M8 32 L16 52 L21 49 L13 30 Z";
const RIGHT_CUFF = "M112 32 L104 52 L99 49 L107 30 Z";

/** Relative luminance (0 dark – 1 light) of a #rgb / #rrggbb colour. */
function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function Jersey({
  primary,
  secondary,
  number,
  size = 74,
}: {
  primary: string;
  secondary: string;
  number?: number;
  size?: number;
}) {
  const numberFill = luminance(primary) > 0.6 ? "#16181c" : "#ffffff";

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d={SHIRT} fill={primary} stroke="rgba(0,0,0,0.35)" strokeWidth={3} strokeLinejoin="round" />
      <Path d={LEFT_CUFF} fill={secondary} />
      <Path d={RIGHT_CUFF} fill={secondary} />
      <Path d={COLLAR} fill={secondary} />
      {number !== undefined ? (
        <SvgText
          x={60}
          y={82}
          fill={numberFill}
          fontSize={36}
          fontWeight="bold"
          textAnchor="middle"
        >
          {number}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// The shirt artwork spans roughly y 18–106 (≈88 tall), centred near (60, 62).
const SHIRT_H = 88;
const SHIRT_CX = 60;
const SHIRT_CY = 62;

/**
 * The same jersey artwork as {@link Jersey}, but rendered as a `<G>` to be
 * embedded inside an existing `<Svg>` (e.g. the pitch reconstruction), centred
 * at (cx, cy) and scaled to `size` px tall. Lets the replay markers reuse the
 * album kit instead of a separate marker style.
 */
export function JerseyShape({
  cx,
  cy,
  size = 22,
  primary,
  secondary,
  number,
  flag,
  showNumber = true,
  highlight = false,
  accent = "#16C47F",
}: {
  cx: number;
  cy: number;
  size?: number;
  primary: string;
  secondary: string;
  number?: number;
  flag?: string;
  showNumber?: boolean;
  highlight?: boolean;
  accent?: string;
}) {
  const s = size / SHIRT_H;
  const tx = cx - SHIRT_CX * s;
  const ty = cy - SHIRT_CY * s;
  const numberFill = luminance(primary) > 0.6 ? "#16181c" : "#ffffff";
  const showNum = showNumber && number !== undefined;
  return (
    <G>
      {highlight ? <Circle cx={cx} cy={cy} r={size * 0.62} fill="none" stroke={accent} strokeWidth={2} opacity={0.9} /> : null}
      <G transform={`translate(${tx} ${ty}) scale(${s})`}>
        <Path d={SHIRT} fill={primary} stroke="rgba(0,0,0,0.35)" strokeWidth={3} strokeLinejoin="round" />
        <Path d={LEFT_CUFF} fill={secondary} />
        <Path d={RIGHT_CUFF} fill={secondary} />
        <Path d={COLLAR} fill={secondary} />
        {showNum ? (
          <SvgText x={60} y={82} fill={numberFill} fontSize={36} fontWeight="bold" textAnchor="middle">
            {number}
          </SvgText>
        ) : flag ? (
          // the country flag identifies the team while players stay anonymous
          <SvgText x={60} y={84} fontSize={44} textAnchor="middle">
            {flag}
          </SvgText>
        ) : null}
      </G>
    </G>
  );
}
