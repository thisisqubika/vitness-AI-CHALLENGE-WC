# VIT-7: Every goal watchable (Track A) + who-scored trivia

> Make every real WC 2026 goal open into a 2D reconstruction. Accurate on-field
> positions for 2026 don't exist in any free source (only StatsBomb 360 for
> historic matches — that's Track B / retro). So 2026 reconstructions are
> **stylized**: real scorer + minute anchor a deterministic template; supporting
> players are anonymous. Honestly framed as "reconstruction", never tracking.

## Scope (Track A)

In:
- **Phase 1 — watchability:** a pure `composePlayScript(goalEvent)` in
  `@vitness/shared` that deterministically builds a valid PlayScript from a goal
  event (scorer, minute, team). The match room composes a reconstruction for any
  goal that has no hand-authored jugada, so **every goal is watchable**
  (watch-only: animation + replay, no quiz). Free, offline, no AI.
- **Phase 2 — who-scored trivia for real goals:** expand curated squads to
  marquee teams; seed server-side jugada challenges for real goals whose scoring
  team has a curated squad (distractors from the squad — per the chosen design).
  Goals without a squad stay watch-only.

Out (Track B / later):
- StatsBomb retro mode + the rich positional questions (who was closest, who got
  dribbled past) + the year slider — those need real 360 freeze-frame data and
  are factual only on historic matches.
- Curating all 48 squads (Phase 2 starts with marquee teams, expands over time).

## Acceptance Criteria

### Scenario 1: Any real goal opens a reconstruction (Phase 1)
```gherkin
Given a finished real match with goal events (e.g. Mexico 2-0 South Africa)
When the user taps a goal's "Watch"
Then a 2D pitch animates a stylized reconstruction ending in a goal
And the scorer is the finisher; supporting players are anonymous dots
And it is labelled a reconstruction (not real tracking)
And a replay control restarts it
```

### Scenario 2: Composition is deterministic and valid (Phase 1)
```gherkin
Given the same goal event
When composePlayScript runs twice
Then it returns the identical PlayScript (no randomness)
And the script validates against PlayScriptSchema
And the attacking direction matches the scoring team's side (home → right, away → left)
```

### Scenario 3: Who-scored trivia where we have the squad (Phase 2)
```gherkin
Given a real goal by a team with a curated squad
When the user opens it
Then the dots are anonymous and a "who scored?" question shows squad-based options
And submit-answer grades it server-side and awards coins/packs
Given a goal by a team without a curated squad
Then the goal is watch-only (no quiz), not an error
```

### Scenario 4: The ARG-MEX showcase is unchanged
```gherkin
Given the hand-authored ARG-MEX jugadas exist
When a showcase goal is opened
Then its richer authored reconstruction + trivia are used, not the generic composer
```

## Technical Context

### Current state
- Real goals seeded in `match_events` (VIT-5 data refresh); tapping them shows the
  graceful "reconstruction not available yet" fallback (no jugada).
- Hand-authored ARG-MEX jugadas drive the showcase (VIT-3/VIT-4).
- `PlayScript` schema, `samplePlay`, `JugadaCanvas`, `JugadaTrivia` exist.
- Curated squads: ARG/MEX only (`catalog-source.ts`).

### Proposed changes

**Phase 1 (watchability):**
- `packages/shared/compose-play.ts`: `composePlayScript(input)` — deterministic
  template library (open-play / counter / header / wing cross), selected by a
  hash of `providerEventId`; scorer as finisher, anonymous teammates + defender +
  keeper; mirrored by attacking side. Pure, unit-tested, schema-valid.
- Match room overlay: if a hand-authored/server jugada exists → use it (showcase
  / trivia). Else, for a goal event → compose a watch-only reconstruction
  (animation + replay + "reconstruction" label). Every goal becomes watchable.

**Phase 2 (real-goal trivia):**
- Expand `catalog-source.ts` with real squads for marquee teams (BRA, FRA, ESP,
  ENG, GER, POR, NED, USA, …).
- Extend the jugada seed: for finished real matches, create a server jugada per
  goal whose scoring team has a curated squad — `play_script` from the composer,
  `distractors` = same-team squad options, `answer_key` = scorer. Reuses the
  existing `jugada_challenges` view + `submit-answer` grading.

### Architecture decisions

| Decision | Rationale |
|----------|-----------|
| 2026 reconstructions are stylized, client-composed | No free positional data for 2026; composing client-side makes every goal watchable with zero seed/DB/AI cost. Honest "reconstruction" framing. |
| Composition is a pure shared fn, deterministic | Same goal always looks the same; unit-testable; reusable client + server. |
| Trivia stays server-authoritative (jugada_challenges + submit-answer) | The answer key never reaches the client — unchanged from VIT-4. |
| Rich positional questions deferred to Track B (StatsBomb) | They're only factual with real freeze-frame data (historic). Faking them on 2026 would make the app dishonest. |
| Distractors from curated squads | Chosen design; start marquee teams, expand. Non-squad teams → watch-only. |

## Out Of Scope / Edge Cases
- Own goals / penalties: template variants; penalties skip the build-up.
- Goal with unknown scorer name: still watchable (anonymous finisher).
- A team with no squad: watch-only, no quiz (graceful).

## Definition Of Done
- `pnpm --filter mobile typecheck` + `pnpm test` pass (composePlayScript unit tests).
- On web: tap a real goal (e.g. Mexico v South Africa) → stylized reconstruction plays + replay; ARG-MEX showcase still uses authored jugadas; a real goal with a curated squad shows who-scored trivia.
- README note on stylized vs retro (real) reconstructions.

## References
- [`docs/CONCEPT.md`](../CONCEPT.md) § La Jugada, § Play-script pipeline, § Data providers.
- VIT-3 (renderer), VIT-4 (trivia), VIT-5 (real data).

**BDD Scenarios**: 4
