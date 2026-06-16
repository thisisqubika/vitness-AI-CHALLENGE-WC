# React Native glossary (routing aid)

Short, one-paragraph definitions for the concepts that come up most often when deciding which upstream plugin to load. These are deliberately surface-level — when you need depth, the relevant marketplace plugin owns it.

## Runtime and architecture

**Hermes** — Meta's optimized JavaScript engine for React Native. Replaces JSC on most modern RN projects. Owns startup-time and memory characteristics; tuning lives in `react-native-best-practices@callstack-agent-skills`.

**JSI (JavaScript Interface)** — Low-level C++ API that lets native code expose synchronous methods to JS without the old asynchronous bridge. The foundation of the New Architecture. Conceptual overview lives in `skills@swmansion`.

**Fabric** — The New Architecture's renderer. Replaces the legacy paper renderer; gives synchronous layout, view flattening, and concurrent React support. Detailed guidance is in `skills@swmansion`.

**TurboModule** — JSI-backed native module system that replaces the legacy bridge-based modules. Codegen-driven, typed at the boundary. Lives in `skills@swmansion`; native-module authoring details for Expo projects are in `expo@expo-plugins` (expo-module).

**Worklet** — A JS function that runs on the UI thread (or an audio thread) via Reanimated/Worklets. Lets you write 60fps animations and gesture handlers without round-tripping through the JS thread. Lives in `skills@swmansion`.

## UI / rendering / lists

**FlashList** — Shopify's high-performance list component, a drop-in for `FlatList` with better recycling. Configuration and gotchas live in `react-native-best-practices@callstack-agent-skills`.

**Reanimated** — Software Mansion's animation library, JSI- and worklet-based. The animation system most production apps use. Lives in `skills@swmansion`.

**Gesture Handler** — Software Mansion's gesture system, also JSI-based. Pairs with Reanimated for fluid interactions. Lives in `skills@swmansion`.

## Expo concepts (cross-reference `mastering-expo-skill`)

**Expo Router** — File-system-based routing on top of React Navigation. Expo's recommended routing layer.

**EAS (Expo Application Services)** — Hosted build, submit, update, and workflow services. Replaces local Xcode/Gradle builds for most teams.

**Expo Updates / EAS Update** — OTA JS-bundle update mechanism. Used to push fixes without an app-store roundtrip.

**Dev Client** — A custom development build of an Expo app that includes your specific native modules (vs. Expo Go which only ships preselected modules).

## Tooling

**rn-diff-purge** — Community-maintained reference of file-by-file diffs between consecutive React Native template versions. Used by `upgrading-react-native@callstack-agent-skills` to script upgrades.

**Brownfield** — An existing native iOS or Android app where React Native is being introduced incrementally. Distinct from a greenfield RN-from-scratch project. Strategy lives in `react-native-brownfield-migration@callstack-agent-skills`.

## When a term isn't here

If the concept isn't in this glossary, it's almost certainly owned by one of the registered marketplace plugins — load whichever one matches the task category from `decision-tree.md`. Do not invent definitions; defer to the upstream skill.
