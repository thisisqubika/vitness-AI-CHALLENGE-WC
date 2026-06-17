# VIT-3: Jugada 2D pitch — animated play reconstruction

> Build-order #2 from [`docs/CONCEPT.md`](../CONCEPT.md) (the renderer half). VIT-1
> defined the `PlayScript` contract; this animates it: tap a goal in the match
> room and watch the play redraw on a 2D pitch. The visual centerpiece.

## User Story

**As a** fan reviewing a goal
**I want** the play redrawn as a 2D animation — players and the ball moving across
the pitch to the goal
**So that** I relive what just happened (and, later, can be quizzed on who was
in the play).

## Scope

In:
- A Skia-rendered `JugadaPitch` component that animates a `PlayScript`: pitch
  markings, player dots (team-coloured, numbered), a moving ball, a goal flash,
  with play / replay controls.
- Pure interpolation of keyframe positions over `durationMs` (a small,
  unit-tested helper in `@vitness/shared`).
- Hand-authored demo `PlayScript`s for the ARG-MEX fixture goals, keyed by
  `providerEventId`.
- Wiring: tapping a goal row in the match room opens the reconstruction for that
  goal (overlay); goals without a script fall back gracefully.

Out (own later tickets):
- `compose-play` (LLM/template generation of play-scripts from live events) and
  the StatsBomb retro compiler — this ticket renders hand-authored scripts.
- "Who was in the play?" trivia (anonymous dots, dropdowns, scoring).
- Golazo sticker cards embedding the replay.

## Acceptance Criteria

### Scenario 1: Tap a goal, watch the reconstruction (happy path)

```gherkin
Given the match room shows a goal event that has a play-script
When the user taps that goal row
Then a 2D pitch opens and animates the play from first to last keyframe
And the ball and player dots move along their keyframe paths
And a goal flash plays at the end
And a replay control restarts the animation
```

### Scenario 2: Interpolation is correct and pure

```gherkin
Given a play-script with keyframes at t=0, t=0.5, t=1
When the interpolator is sampled at t=0.25
Then each actor and the ball are halfway between the t=0 and t=0.5 keyframes
And the helper has no rendering or platform dependency (unit-tested)
```

### Scenario 3: Goal without a script

```gherkin
Given a goal event with no matching play-script
When the user taps it
Then a graceful "reconstruction not available yet" state shows, not a crash
```

### Scenario 4: Renders on the demo target

```gherkin
Given the app runs on web (the demo target)
When a reconstruction plays
Then Skia renders the pitch and animation without errors
```

## Technical Context

### Current state
- `@vitness/shared` exports `PlayScript` (120×80 pitch, actors, keyframes with `t`, `ball`, per-actor positions, optional `event`).
- Match room renders an event feed (VIT-2); goal rows are present but inert.
- No Skia dependency yet.

### Proposed changes

**`@vitness/shared`:**
- `play-sampler.ts` — pure `samplePlay(script, t)` returning interpolated `{ ball, actors: Record<slotId, point> }` for `t ∈ [0,1]`, plus `interpolatePoint`. Unit-tested. (Rendering stays in the app; only math is shared.)

**Mobile:**
- `npx expo install @shopify/react-native-skia` (SDK-56-compatible; renders on web via CanvasKit).
- `src/components/jugada/jugada-pitch.tsx` — `Canvas` drawing pitch markings + animated ball/dots driven by a clock; props `{ script, onClose }`. Goal flash on the final keyframe; replay button.
- `src/data/demo-jugadas.ts` — hand-authored `PlayScript`s for the ARG-MEX goals (`arg-mex-e03`, `arg-mex-e06`, `arg-mex-e10`), keyed by `providerEventId`, validated by `playScriptSchema`.
- Match room: goal rows become tappable; tapping opens `JugadaPitch` in an overlay; goals without a script show the fallback.

### Architecture decisions

| Decision | Rationale |
|----------|-----------|
| Renderer consumes `PlayScript`; generation is separate | Same contract whether the script is hand-authored (now), LLM-composed (live), or StatsBomb-compiled (retro). Build/verify the renderer independently. |
| Sampler math in `@vitness/shared`, drawing in the app | Keeps interpolation pure + unit-testable; Skia stays app-only. |
| ~~Skia~~ → react-native-svg | Skia was the concept's choice, but on Expo SDK 56 web its render path runs on the Reanimated worklet runtime, which doesn't share the CanvasKit global (`PictureRecorder` undefined) — a bleeding-edge integration bug. For ~5 dots + a ball, SVG is more than sufficient, renders identically on web + native with no WASM/worklet fragility, and the pure sampler is unchanged. Revisit Skia later only if heavy GPU effects (e.g. golazo cards) need it. |
| Hand-authored demo scripts keyed by `providerEventId` | Lets the renderer ship + demo now; `compose-play` later writes the same shape to the `jugadas` table. |

## Out Of Scope / Edge Cases
- Script with one keyframe → render the static frame, no animation (guard).
- Very long/short `durationMs` → clamp playback to the schema's 1–30s bound.
- Web vs native Skia init differences → verify on web (demo target) this ticket.

## Definition Of Done
- `pnpm --filter mobile typecheck` + `pnpm test` pass (sampler unit tests added).
- Tapping a goal in the match room animates its reconstruction on web; replay works; non-scripted goal shows the fallback.
- Screenshot proof of the animated pitch.
- README: note Skia dependency and that demo jugadas are hand-authored pending `compose-play`.

## References
- [`docs/CONCEPT.md`](../CONCEPT.md) § La Jugada, § Play-script pipeline.
- `@vitness/shared` `PlayScript` (VIT-1).
- Expo 56 / Skia (per `apps/mobile/AGENTS.md`).

**BDD Scenarios**: 4
