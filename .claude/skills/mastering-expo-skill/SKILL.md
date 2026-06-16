---
name: mastering-expo-skill
description: "Orientation skill for Expo projects. Routes work to the upstream expo@expo-plugins marketplace plugin, which bundles all 13 Expo sub-skills (EAS workflows, deployment, Expo Router, expo-module, dev-client, native data fetching, Tailwind/NativeWind, Expo UI for Jetpack Compose and SwiftUI, expo-dom, upgrading Expo SDK, EAS Update insights). Use for any Expo task: 'Expo', 'expo-router', 'EAS', 'EAS Update', 'EAS Submit', 'EAS Workflows', 'expo-module', 'expo-dev-client', 'expo-tailwind', 'NativeWind', 'expo-deployment', 'native-data-fetching', 'expo-use-dom', 'expo-ui', 'expo-jetpack-compose', 'expo-swiftui', 'upgrading-expo', 'expo-av to expo-audio', 'expo-av to expo-video', or when the working directory contains a package.json with expo or expo-router as a dependency. Adds Qubika framework conventions on top."
trigger_mode: triggered
triggers: ["expo", "expo-router", "eas"]
compatible_languages: ["typescript", "javascript"]
---

# Mastering Expo (Qubika)

This skill is the orientation layer for Expo work. The deep content lives in the upstream `expo@expo-plugins` marketplace plugin — a single plugin that internally organizes 13 sub-skills covering everything from EAS workflows to native-module authoring. This skill helps you decide which sub-skill to consult and applies Qubika-specific conventions.

For non-Expo React Native work (bare RN, upgrade, brownfield, performance, animations), see `mastering-react-native-skill`.

## When to use

Trigger this skill whenever the working directory contains a `package.json` with `expo` or `expo-router` as a dependency, or when the user mentions EAS, Expo Router, expo-module, expo-dev-client, NativeWind, expo-ui (Jetpack Compose / SwiftUI), expo-dom, native-data-fetching, EAS Update, EAS Submit, EAS Workflows, or Expo SDK upgrades.

## Decision matrix — task → upstream sub-skill

The upstream `expo` plugin bundles all 13 sub-skills under one install. After the plugin is installed (registered by running this skill's `scripts/register-marketplaces.mjs` the first time the skill loads in a project — see below), each sub-skill auto-triggers from its own description. The table below is for human / model routing when the auto-trigger is ambiguous.

| Task | Sub-skill (within `expo@expo-plugins`) |
|---|---|
| Building screens, navigation, tabs, sheets, headers, search, gradients, icons, animations | `expo-building-native-ui` (+ its references for tabs, animations, etc.) |
| API routes (server endpoints inside an Expo app) | `expo-api-routes` |
| Tailwind / NativeWind v5 setup with Tailwind v4 | `expo-tailwind-setup` |
| Jetpack Compose views inside Expo (Android) | `expo-ui-jetpack-compose` |
| SwiftUI views inside Expo (iOS) | `expo-ui-swift-ui` |
| Running web code inside webviews via Expo DOM components | `expo-use-dom` |
| Writing a native Expo module (Swift / Kotlin / TS) | `expo-module` |
| Building / distributing a development client | `expo-dev-client` |
| Networking, React Query / SWR / caching / offline / Expo Router loaders | `expo-native-data-fetching` |
| Monitoring EAS Update health: crash rates, OTA distribution, payload size | `eas-update-insights` |
| Writing EAS Workflow YAML (CI/CD) | `expo-cicd-workflows` |
| App Store / Play Store deployment, TestFlight | `expo-deployment` |
| Upgrading Expo SDK; migrating expo-av → expo-audio/expo-video; New Architecture rollout; React 19 / React Compiler readiness | `expo-upgrade` |

Most of these sub-skills are auto-triggerable once the `expo@expo-plugins` plugin is installed. Use this table to disambiguate when a task crosses categories (e.g. "set up a dev client that talks to a local API route" → `expo-dev-client` + `expo-api-routes`).

## How the upstream plugin reaches the developer

This skill ships a setup script that registers the Expo marketplace in the target project's `.claude/settings.json` and enables the `expo` plugin. It is idempotent and safe to re-run.

**The first time you load this skill in a project**, check `.claude/settings.json` for `extraKnownMarketplaces["expo-plugins"]`. If it's missing, run the script from the **project root** (so it writes to the project's `.claude/settings.json`, not the skill folder's):

```bash
# From the project root (target repo), where Phase 5 has copied the skill to .claude/skills/:
node .claude/skills/mastering-expo-skill/scripts/register-marketplaces.mjs

# Or explicitly point the script at the project root from anywhere:
node /path/to/.claude/skills/mastering-expo-skill/scripts/register-marketplaces.mjs --cwd /path/to/project
```

The script accepts `--cwd <path>` and `--dry-run`. It deep-merges keys, so developer customizations elsewhere in `settings.json` are preserved. It refuses to write if `.claude/settings.json` exists but is not a JSON object.

**Claude-only feature.** Plugin marketplaces (`extraKnownMarketplaces` / `enabledPlugins`) are read by Claude Code; the Codex CLI ignores them. The script detects the project's provider (via `PROVIDER` env, presence of `.codex/` vs `.claude/`, or `OPENAI_API_KEY` vs `ANTHROPIC_API_KEY`) and exits early on Codex projects with a message. On a mixed project that uses both CLIs, rerun with `--force` to write `.claude/settings.json` regardless.

The merged result looks like:

```json
{
  "extraKnownMarketplaces": {
    "expo-plugins": { "source": { "source": "github", "repo": "expo/skills" } }
  },
  "enabledPlugins": {
    "expo@expo-plugins": true
  }
}
```

After it runs, ask the developer to restart Claude Code. They'll see a one-time trust prompt and the `expo` plugin will install under `~/.claude/plugins/`. From then on, the 13 sub-skills auto-trigger by their own descriptions; this skill becomes the index.

If the project is also bare-RN-flavored (e.g. an EAS-built bare RN tree), additionally load `mastering-react-native-skill` and run its `scripts/register-marketplaces.mjs` for the Callstack + Software Mansion marketplaces.

## Qubika conventions for Expo projects

- **Stack detection**: Phase 1 classifies an Expo project as `service.type === 'mobile'` with `frameworks.main === 'Expo'` and typically `frameworks.additional` containing `'expo-router'`. Phase 5's `extractDetectedStack` in `phase5/helpers/stack-detector.ts` reads those fields to drive `mastering-expo-skill` selection in `skill-resolver`; the stack profile written by Phase 1 is the single source of truth.
- **Build / run defaults**: `npx expo start` for dev, `eas build` for production. The framework's `command-resolver` reads these defaults from `framework-config.json` and uses them in agent prompts; override only when the project genuinely deviates.
- **Test defaults**: `npx jest` for unit, Detox or Maestro for E2E (project-specific; recorded in `framework-config.json`).
- **CI**: prefer EAS Workflows (`expo-cicd-workflows`) over hand-rolled GitHub Actions for Expo projects. Only fall back to Callstack's `github-actions` patterns when EAS Workflows isn't viable.
- **OTA / Update strategy**: `eas-update-insights` is the canonical place for crash-rate and OTA-distribution analysis; framework-wide observability tooling does not replace it.
- **PR / docs / security**: framework-wide skills (`pr-reviewer`, `create-pr`, `doc-updater`, `security-review`, `code-quality-check`) apply unchanged on Expo projects.

## Reference files

- [decision-tree.md](references/decision-tree.md) — fuller routing tree, edge cases (Expo + bare RN hybrid, multi-target monorepos)
- [glossary.md](references/glossary.md) — EAS / Updates / Dev Client / Expo Router / expo-module / EAS Workflows definitions
- [qubika-conventions.md](references/qubika-conventions.md) — full conventions list (test / lint / build / CI / OTA defaults) Qubika applies on top of upstream
- [scripts/register-marketplaces.mjs](scripts/register-marketplaces.mjs) — idempotent registration script (Node, no dependencies) that merges marketplace + plugin keys into `.claude/settings.json`

## License and attribution

Authored by Qubika. The upstream `expo@expo-plugins` marketplace plugin and its 13 sub-skills are MIT-licensed and authored by the Expo team — https://github.com/expo/skills. We do not copy upstream content; updates come from re-running `/plugin update`.
