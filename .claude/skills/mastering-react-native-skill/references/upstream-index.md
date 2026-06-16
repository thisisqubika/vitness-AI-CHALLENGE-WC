# Upstream marketplace catalog (React Native ecosystem)

Snapshot of the marketplaces this skill routes to. Authoritative content lives upstream; this index is for routing only.

## Software Mansion — `software-mansion-labs/skills`

- Marketplace ID (in `enabledPlugins`): `swmansion`
- License: MIT
- Repository: https://github.com/software-mansion-labs/skills

| Plugin | Enabled by default | Covers |
|---|---|---|
| `skills` | yes | React Native New Architecture: animations (Reanimated), gestures (Gesture Handler), SVG, audio (`react-native-audio-api`), multithreading (Worklets), on-device AI (ExecuTorch), rich text (`react-native-enriched`), Radon IDE debugging |
| (other plugins published under this marketplace) | no | Not enabled by default. Evaluate per-project if a plugin becomes relevant. |

The single `skills` plugin internally bundles multiple deep sub-skills (organized by category — animations/, audio/, gestures/, multithreading/, etc.). Sub-skills auto-trigger from their own descriptions once the plugin is installed.

## Callstack — `callstackincubator/agent-skills`

- Marketplace ID (in `enabledPlugins`): `callstack-agent-skills`
- License: MIT
- Repository: https://github.com/callstackincubator/agent-skills

| Plugin | Enabled by default | Covers |
|---|---|---|
| `react-native-best-practices` | yes | Performance optimization: FPS, TTI, bundle size, memory, re-renders, FlashList, Hermes tuning |
| `upgrading-react-native` | yes | Version upgrades via `rn-diff-purge`, dependency bumps, breaking-change handling |
| `react-native-brownfield-migration` | yes | Incremental RN adoption in existing native iOS/Android apps |
| `github-actions` | yes | iOS simulator + Android emulator CI workflows, artifact downloads |
| `github` | **no** | Generic gh CLI / PR / branching patterns. Framework supplies its own equivalent skills; do not re-enable without an explicit team decision. |

Callstack's marketplace publishes 5 distinct plugins. The Qubika default enables 4 of them and excludes `github`.

## Expo — `expo/skills`

Routed via `mastering-expo-skill`. See its `references/upstream-index.md` for details.

- Marketplace ID (in `enabledPlugins`): `expo-plugins`
- License: MIT
- Repository: https://github.com/expo/skills
- Single canonical plugin: `expo` (bundles all 13 Expo sub-skills)

## Plugins NOT currently in the framework's auto-registration

- React Navigation upstream skills (static-config migration, 6→7→8 upgrades). Published under `react-navigation` rather than one of the three registered marketplaces. Fetch directly when the task arises. Future framework versions may add this as a fourth marketplace.

## Updating this catalog

When upstream publishes a new plugin or deprecates an existing one:

1. Update the `MARKETPLACES` map in `scripts/register-marketplaces.mjs` (the runtime source of truth — this is the script that writes settings).
2. Update this file to keep the routing index in sync.
3. Update the decision matrix in `SKILL.md` if the new plugin changes how tasks should be routed.

Do not copy upstream skill content into this repo at any step.
