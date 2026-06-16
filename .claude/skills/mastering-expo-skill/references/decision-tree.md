# Expo task → sub-skill decision tree

Expanded routing for when the SKILL.md decision matrix is ambiguous.

## Primary routing

```
Is the task Expo-managed UI work (screens, navigation, tabs, headers, animations)?
├── Yes → expo-building-native-ui (and its topic references: tabs.md, animations.md, etc.)
└── No  → continue

Is the task about EAS or CI/CD?
├── Building / submitting apps    → expo-deployment
├── Writing workflow YAML         → expo-cicd-workflows
├── Monitoring update health      → eas-update-insights
└── Otherwise                     → continue

Is the task about native modules?
├── Writing a custom one          → expo-module (+ config-plugin / lifecycle refs)
├── Embedding Jetpack Compose     → expo-ui-jetpack-compose
├── Embedding SwiftUI             → expo-ui-swift-ui
└── Otherwise                     → continue

Is the task about networking / data fetching?
├── Yes → expo-native-data-fetching (covers fetch, React Query, SWR, offline, Expo Router loaders)
└── No  → continue

Is the task about upgrading Expo SDK or migrating deprecated APIs?
├── Yes → expo-upgrade
└── No  → continue

Is the task about distributing a dev client?
├── Yes → expo-dev-client
└── No  → continue

Is the task about running web code in webviews?
├── Yes → expo-use-dom
└── No  → continue

Is the task about Tailwind / NativeWind setup?
├── Yes → expo-tailwind-setup
└── No  → load the SKILL.md matrix and pick the closest fit
```

## Overlap and tie-breaker rules

- **Dev client that ships a custom native module**: load `expo-module` first (the module is the harder part) and `expo-dev-client` for the distribution flow.
- **Expo Router screen that calls an API route in the same app**: load `expo-building-native-ui` for the screen and `expo-api-routes` for the endpoint. Add `expo-native-data-fetching` if the loader pattern matters.
- **Upgrading Expo SDK that bumps React to 19**: `expo-upgrade` covers it (its `references/react-19.md` and `references/react-compiler.md`). Do not separately load any non-Expo React skill — Expo's upgrade guidance is the authoritative path for the React bump in this context.
- **Migrating expo-av → expo-audio or expo-video**: `expo-upgrade/references/expo-av-to-audio.md` or `expo-av-to-video.md`. Not in `expo-building-native-ui`.

## Hybrid Expo + bare-RN projects

Rare but real: a project that runs `eas build` on a bare RN tree, or that imports bare-RN libraries inside an Expo managed app.

- If the work is on the EAS / OTA / deployment side, load Expo sub-skills.
- If the work is on the New Architecture, animations, gestures, or RN performance side, load the relevant `mastering-react-native-skill` plugin instead.
- When Phase 1's stack profile flags the project as both React Native and Expo, Phase 5 copies both hub skills. Each skill's `scripts/register-marketplaces.mjs` is then responsible for registering its own marketplaces — run both scripts from the project root.

## When no sub-skill fits

Some Expo tasks (very recent betas, niche third-party Expo modules) may not be covered. In those cases, read the official `docs.expo.dev` page directly and avoid inventing guidance. If the gap is recurring, raise it so the upstream Expo team can add a sub-skill.
