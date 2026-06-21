import { useEffect, useRef, useState } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  PITCH_LENGTH,
  PITCH_WIDTH,
  samplePlay,
  activeEventAt,
  type PlayScript,
} from "@vitness/shared";

const HOME_COLOR = "#3FA7FF";
const AWAY_COLOR = "#FF7A59";
const BALL_COLOR = "#ffffff";
const LINE = "rgba(255,255,255,0.55)";
const ACCENT = "#16C47F";

interface Props {
  script: PlayScript;
  width: number;
  height: number;
  playToken: number;
  revealed?: boolean;
  onComplete?: () => void;
}

/**
 * Draws and animates a PlayScript on a 2D pitch with react-native-svg. Time is
 * driven by requestAnimationFrame; positions come from the pure samplePlay()
 * helper, so this component only maps pitch coordinates (120×80) to pixels and
 * paints. SVG renders identically on web and native with no WASM dependency.
 * A short ball trail, mown stripes and a goal flash sell the reconstruction.
 */
export default function JugadaCanvas({ script, width, height, playToken, revealed = true, onComplete }: Props) {
  const [t, setT] = useState(0);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    startRef.current = null;
    doneRef.current = false;
    let raf = 0;
    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / script.durationMs);
      setT(next);
      if (next < 1) {
        raf = requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, playToken]);

  const sx = (x: number) => (x / PITCH_LENGTH) * width;
  const sy = (y: number) => (y / PITCH_WIDTH) * height;

  const frame = samplePlay(script, t);
  const event = activeEventAt(script, t);
  const isGoal = event === "goal";
  const isShot = event === "shot";
  const attackingHome = script.attackingSide === "home";
  const goalX = attackingHome ? width : 0;

  // A few ghost positions behind the ball for a motion trail.
  const trail = [0.05, 0.1, 0.16].map((dt) => samplePlay(script, Math.max(0, t - dt)).ball);

  const stripes = 7;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1f9d52" />
          <Stop offset="1" stopColor="#147a3c" />
        </LinearGradient>
        <RadialGradient id="goalGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={isGoal ? ACCENT : "#ffffff"} stopOpacity={isGoal ? 0.55 : 0.16} />
          <Stop offset="1" stopColor={ACCENT} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#grass)" />

      {/* mown stripes */}
      {Array.from({ length: stripes }).map((_, i) =>
        i % 2 === 0 ? (
          <Rect key={`s${i}`} x={(width / stripes) * i} y={0} width={width / stripes} height={height} fill="#ffffff" opacity={0.04} />
        ) : null,
      )}

      {/* goal-mouth glow on the attacking side */}
      <Rect x={goalX === 0 ? -width * 0.18 : width * 0.82} y={height * 0.22} width={width * 0.36} height={height * 0.56} fill="url(#goalGlow)" />

      {/* field markings */}
      <Rect x={2} y={2} width={width - 4} height={height - 4} rx={6} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Line x1={width / 2} y1={2} x2={width / 2} y2={height - 2} stroke={LINE} strokeWidth={1.5} />
      <Circle cx={width / 2} cy={height / 2} r={height * 0.16} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Circle cx={width / 2} cy={height / 2} r={2.5} fill={LINE} />
      <Rect x={width - sx(18)} y={sy(22)} width={sx(18)} height={sy(36)} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={0} y={sy(22)} width={sx(18)} height={sy(36)} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={width - sx(6)} y={sy(30)} width={sx(6)} height={sy(20)} fill="none" stroke={LINE} strokeWidth={1.5} />
      <Rect x={0} y={sy(30)} width={sx(6)} height={sy(20)} fill="none" stroke={LINE} strokeWidth={1.5} />

      {/* shot/goal emphasis ring */}
      {isShot || isGoal ? (
        <Circle cx={sx(frame.ball.x)} cy={sy(frame.ball.y)} r={isGoal ? 26 : 16} fill="none" stroke={isGoal ? ACCENT : "#ffffff"} strokeWidth={2} opacity={0.7} />
      ) : null}

      {/* player shadows */}
      {script.actors.map((actor) => {
        const p = frame.actors[actor.slotId];
        if (!p) return null;
        return <Ellipse key={`sh-${actor.slotId}`} cx={sx(p.x)} cy={sy(p.y) + 9} rx={9} ry={3} fill="rgba(0,0,0,0.28)" />;
      })}

      {/* players */}
      {script.actors.map((actor) => {
        const p = frame.actors[actor.slotId];
        if (!p) return null;
        const isScorer = actor.role === "scorer";
        return (
          <G key={actor.slotId}>
            {isScorer && revealed ? (
              <Circle cx={sx(p.x)} cy={sy(p.y)} r={13} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.85} />
            ) : null}
            <Circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={10}
              fill={actor.team === "home" ? HOME_COLOR : AWAY_COLOR}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            {revealed && actor.shirtNumber !== undefined ? (
              <SvgText x={sx(p.x)} y={sy(p.y) + 3.5} fontSize={10} fontWeight="bold" fill="#0b1320" textAnchor="middle">
                {actor.shirtNumber}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {/* ball trail */}
      {trail.map((b, i) => (
        <Circle key={`tr${i}`} cx={sx(b.x)} cy={sy(b.y)} r={3.5} fill={BALL_COLOR} opacity={0.18 * (trail.length - i)} />
      ))}

      {/* ball */}
      <Circle cx={sx(frame.ball.x)} cy={sy(frame.ball.y)} r={isGoal ? 6 : 4.5} fill={BALL_COLOR} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
    </Svg>
  );
}
