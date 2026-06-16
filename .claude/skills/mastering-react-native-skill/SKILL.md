---
name: mastering-react-native-skill
description: "Orientation skill for React Native and Expo projects. Routes work to upstream marketplace plugins from Callstack and Software Mansion that provide deep, expert-authored content on the New Architecture, performance optimization, upgrades, brownfield migration, navigation, and CI. Use for any React Native or Expo task: 'React Native', 'Expo', 'expo-router', 'New Architecture', 'Reanimated', 'Gesture Handler', 'react-native-svg', 'TurboModule', 'Fabric', 'JSI', 'Hermes', 'FlashList', 'Worklet', 'rn-diff-purge', 'brownfield', 'native module', 'iOS simulator build', 'Android emulator build', 'EAS', 'react-navigation', or any code task in a package.json that depends on react-native, expo, or expo-router. Provides a decision matrix to route to the right marketplace plugin and adds Qubika framework conventions on top."
trigger_mode: triggered
triggers: ["react-native", "expo", "expo-router", "react-navigation"]
compatible_languages: ["typescript", "javascript"]
---

# Mastering React Native (Qubika)

This skill is an **orientation layer** over React Native and Expo work. It does not contain the deep content itself — that lives in upstream marketplace plugins maintained by the actual ecosystem experts (Callstack, Software Mansion). Registration of those marketplaces in the target project's `.claude/settings.json` is performed by this skill's own setup script (`scripts/register-marketplaces.mjs`), run the first time the skill loads in a project — not by the framework's init pipeline. See "How upstream plugins reach the developer" below.

Use this skill to: (1) decide which upstream plugin to consult for a given task, (2) understand Qubika-specific conventions layered on top, (3) keep up with the upstream catalog without copying it into the framework.

## When to use

Trigger this skill whenever the working directory contains a `package.json` with `react-native`, `expo`, or `expo-router` as a dependency, or whenever the user mentions any of: React Native, Expo, New Architecture, Reanimated, Gesture Handler, TurboModule, Fabric, JSI, Hermes, FlashList, expo-router, React Navigation, EAS, or a related runtime/library.

If the task is Expo-flavored (EAS workflows, expo-module, expo-router, native-data-fetching, etc.), see also `mastering-expo-skill`.

## Decision matrix — task → upstream plugin

| Task | Plugin | Marketplace |
|---|---|---|
| New Architecture, Reanimated, Gesture Handler, SVG, audio, multithreading, on-device AI | `skills@swmansion` | `software-mansion-labs/skills` |
| FPS / TTI / bundle-size / memory-leak / re-render optimization, FlashList, Hermes tuning | `react-native-best-practices@callstack-agent-skills` | `callstackincubator/agent-skills` |
| Upgrading React Native (e.g. 0.75 → 0.76), `rn-diff-purge` template diffs | `upgrading-react-native@callstack-agent-skills` | `callstackincubator/agent-skills` |
| Adding React Native to an existing native iOS/Android app (brownfield) | `react-native-brownfield-migration@callstack-agent-skills` | `callstackincubator/agent-skills` |
| GitHub Actions for iOS simulator / Android emulator builds, artifact downloads | `github-actions@callstack-agent-skills` | `callstackincubator/agent-skills` |
| Anything Expo-flavored (EAS, Expo Router, expo-module, native-data-fetching, …) | `expo@expo-plugins` | `expo/skills` — see `mastering-expo-skill` |
| React Navigation upgrades or static-config migration (bare) | upstream `react-navigation/skills` (not yet in registered marketplaces) | `react-navigation/skills` |
| Expo Router (Expo projects) | `expo@expo-plugins` | `expo/skills` — see `mastering-expo-skill` |

If multiple plugins overlap (e.g. a performance task on a project mid-upgrade), load the most specific plugin first and escalate to the others as needed. The marketplaces namespace skills as `<marketplace>:<plugin>:<skill>` so collisions like `react-native-best-practices` between Callstack and Software Mansion coexist safely.

## How upstream plugins reach the developer

This skill ships a setup script that registers the Software Mansion and Callstack marketplaces in the target project's `.claude/settings.json` and enables the relevant plugins. It is idempotent and safe to re-run.

**The first time you load this skill in a project**, check whether the marketplaces are already registered by reading `.claude/settings.json`. If `extraKnownMarketplaces.swmansion` or `extraKnownMarketplaces["callstack-agent-skills"]` are missing, run the script from the **project root** (so it writes to the project's `.claude/settings.json`, not the skill folder's):

```bash
# From the project root (target repo), where Phase 5 has copied the skill to .claude/skills/:
node .claude/skills/mastering-react-native-skill/scripts/register-marketplaces.mjs

# Or explicitly point the script at the project root from anywhere:
node /path/to/.claude/skills/mastering-react-native-skill/scripts/register-marketplaces.mjs --cwd /path/to/project
```

The script accepts `--cwd <path>` to target a project root (defaults to the current working directory) and `--dry-run` to preview changes. It deep-merges keys, so any existing developer customizations elsewhere in `settings.json` are preserved. It refuses to write if `.claude/settings.json` exists but is not a JSON object.

**Claude-only feature.** Plugin marketplaces (`extraKnownMarketplaces` / `enabledPlugins`) are read by Claude Code; the Codex CLI ignores them. The script detects the project's provider (via `PROVIDER` env, presence of `.codex/` vs `.claude/`, or `OPENAI_API_KEY` vs `ANTHROPIC_API_KEY`) and exits early on Codex projects with a message. On a mixed project that uses both CLIs, rerun with `--force` to write `.claude/settings.json` regardless.

After the script runs, ask the developer to restart Claude Code in the project. They'll see a one-time trust prompt for each new marketplace, then plugins install into `~/.claude/plugins/`. From that point on, sub-skills like New Architecture animations or FlashList tuning auto-trigger by their own descriptions — this skill is only the index.

If the developer is on an Expo project, also load `mastering-expo-skill`, which ships its own script for the Expo marketplace.

## Qubika conventions for React Native projects

These are framework-level conventions the upstream plugins do not know about:

- **Stack detection**: Phase 1's `structure-architecture-analyzer` classifies an RN service as `service.type === 'mobile'` with `frameworks.main` set to `"React Native"` or `"Expo"`. Phase 5's `skill-resolver` uses those fields (via `extractDetectedStack` in `phase5/helpers/stack-detector.ts`) to decide which `mastering-*-skill` to copy into the project. Marketplace registration itself is then performed by this skill's setup script — it is not written server-side. Do not edit the discovered fields by hand.
- **Test commands**: `command-resolver` maps RN projects to `npx jest` for unit and `detox test` / Maestro for E2E unless `framework-config.json` overrides. Visual tests typically run against an iOS simulator snapshot baseline.
- **Build commands**: `npx react-native run-ios` / `run-android` for bare; `npx expo start` (or `eas build`) for managed. CI delegates to `github-actions@callstack-agent-skills` patterns.
- **Lint / typecheck**: defaults to `eslint .` + `tsc --noEmit`. Most RN projects ship with `@react-native/eslint-config` — leave the upstream config in place rather than replacing it with our standard TS lint rules.
- **PR / docs flow**: standard framework-wide `pr-reviewer`, `create-pr`, `doc-updater` skills apply unchanged.

## Reference files

- [decision-tree.md](references/decision-tree.md) — fuller decision tree with edge cases (Expo + bare hybrid, multi-platform monorepos, brownfield-mid-upgrade)
- [glossary.md](references/glossary.md) — one-paragraph definitions of Hermes, JSI, Fabric, TurboModule, Worklet, FlashList, Expo Router, EAS — to help triage which plugin owns a given concept
- [qubika-conventions.md](references/qubika-conventions.md) — full conventions list (test / lint / build / CI defaults) Qubika applies on top of upstream
- [upstream-index.md](references/upstream-index.md) — the current marketplace catalog: which plugin lives in which repo, what it covers, when to load it
- [scripts/register-marketplaces.mjs](scripts/register-marketplaces.mjs) — idempotent registration script (Node, no dependencies) that merges marketplace + plugin keys into `.claude/settings.json`

## License and attribution

This orientation skill is authored by Qubika. The upstream marketplace plugins it routes to are MIT-licensed and authored by their respective owners:

- Software Mansion — https://github.com/software-mansion-labs/skills
- Callstack — https://github.com/callstackincubator/agent-skills
- Expo — https://github.com/expo/skills (routed via `mastering-expo-skill`)

We do not copy upstream content. Updates to deep guidance come from re-running `/plugin update` against the registered marketplaces.
