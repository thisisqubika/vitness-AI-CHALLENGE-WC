import { useEffect, useRef, useState } from "react";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import {
  PITCH_LENGTH,
  PITCH_WIDTH,
  samplePlay,
  activeEventAt,
  type PlayScript,
} from "@vitness/shared";

const HOME_COLOR = "#85B7EB";
const AWAY_COLOR = "#F0997B";
const BALL_COLOR = "#ffffff";
const LINE = "rgba(255,255,255,0.7)";
const GRASS = "#15803d";

interface Props {
  script: PlayScript;
  width: number;
  height: number;
  playToken: number;
}

/**
 * Draws and animates a PlayScript on a 2D pitch with react-native-svg. Time is
 * driven by requestAnimationFrame; positions come from the pure samplePlay()
 * helper, so this component only maps pitch coordinates (120×80) to pixels and
 * paints. SVG renders identically on web and native with no WASM dependency.
 */
export default function JugadaCanvas({ script, width, height, playToken }: Props) {
  const [t, setT] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let raf = 0;
    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / script.durationMs);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [script, playToken]);

  const sx = (x: number) => (x / PITCH_LENGTH) * width;
  const sy = (y: number) => (y / PITCH_WIDTH) * height;

  const frame = samplePlay(script, t);
  const isGoal = activeEventAt(script, t) === "goal";

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={GRASS} />
      <Rect x={2} y={2} width={width - 4} height={height - 4} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke={LINE} strokeWidth={1.5} />
      <Circle cx={width / 2} cy={height / 2} r={height * 0.14} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={width - sx(18)} y={sy(22)} width={sx(18)} height={sy(36)} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={0} y={sy(22)} width={sx(18)} height={sy(36)} fill="none" stroke={LINE} strokeWidth={1.5} />

      {isGoal ? (
        <Circle cx={sx(frame.ball.x)} cy={sy(frame.ball.y)} r={20} fill="rgba(255,255,255,0.4)" />
      ) : null}

      {script.actors.map((actor) => {
        const p = frame.actors[actor.slotId];
        if (!p) return null;
        return (
          <Circle
            key={actor.slotId}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={9}
            fill={actor.team === "home" ? HOME_COLOR : AWAY_COLOR}
            stroke={LINE}
            strokeWidth={1.5}
          />
        );
      })}

      {script.actors.map((actor) => {
        const p = frame.actors[actor.slotId];
        if (!p || actor.shirtNumber === undefined) return null;
        return (
          <SvgText
            key={`n-${actor.slotId}`}
            x={sx(p.x)}
            y={sy(p.y) + 3}
            fontSize={9}
            fill="#04283f"
            textAnchor="middle">
            {actor.shirtNumber}
          </SvgText>
        );
      })}

      <Circle cx={sx(frame.ball.x)} cy={sy(frame.ball.y)} r={isGoal ? 6 : 4} fill={BALL_COLOR} />
    </Svg>
  );
}
