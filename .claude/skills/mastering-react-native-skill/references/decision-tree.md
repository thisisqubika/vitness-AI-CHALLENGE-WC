# React Native task → upstream plugin decision tree

Use this when the SKILL.md decision matrix isn't enough — typically for hybrid or overlapping cases.

## Primary routing

```
Is the project Expo (managed or expo-router)?
├── Yes → load mastering-expo-skill and route via its decision tree
└── No  → continue below

Is the task about upgrading React Native itself (rn-diff-purge, breaking deps)?
├── Yes → upgrading-react-native@callstack-agent-skills
└── No  → continue

Is the task about adding RN to an existing native iOS/Android app?
├── Yes → react-native-brownfield-migration@callstack-agent-skills
└── No  → continue

Is the task about animations, gestures, SVG, audio, multithreading, on-device AI?
├── Yes → skills@swmansion
└── No  → continue

Is the task about FPS, TTI, bundle size, memory leaks, re-renders, FlashList, Hermes?
├── Yes → react-native-best-practices@callstack-agent-skills
└── No  → continue

Is the task about CI builds for iOS simulator or Android emulator?
├── Yes → github-actions@callstack-agent-skills
└── No  → load mastering-react-native-skill's general orientation + ask the user
```

## Overlap and tie-breaker rules

- **Performance regression after an upgrade**: load `upgrading-react-native` *first* to confirm the upgrade itself is correct, then `react-native-best-practices` to investigate the perf path.
- **Animations that drop frames**: SWmansion's `skills` plugin owns the animation surface (Reanimated, Worklets); load it first. Drop to Callstack's perf plugin only when the bottleneck is on the JS thread or in bridge work, not in animation code.
- **Brownfield project on the New Architecture**: load `react-native-brownfield-migration` for the host-app integration and `skills@swmansion` separately for any New-Arch-specific guidance — they cover different layers.
- **EAS-built bare RN project**: this is rare but real. Use `github-actions@callstack-agent-skills` for the CI plumbing and `expo@expo-plugins` only for the EAS-specific steps (build profiles, credentials). Most of the project stays "bare RN."

## Plugins this skill does NOT route to

- `github@callstack-agent-skills` — generic gh-CLI / PR / branching patterns. Disabled in the Qubika framework default registration because we replace these with our framework-wide `pr-reviewer`, `create-pr`, and `mastering-github-cli` skills. Re-enable per-project only if a team explicitly opts in.
- React Navigation upstream skills (static-config migration, 6→7→8 upgrades) — currently published under `react-navigation` rather than the three marketplaces this framework registers. For now, fetch directly from upstream when the task arises; future framework versions may add a fourth marketplace.

## When no plugin fits

Some React Native tasks (codegen for custom CodePush flows, niche third-party libraries) are not covered by any of the registered marketplaces. In those cases:

1. Do not invent guidance.
2. Read the library's own documentation directly.
3. If the gap is recurring, surface it so we can evaluate adding another marketplace (or upstream a skill ourselves).
