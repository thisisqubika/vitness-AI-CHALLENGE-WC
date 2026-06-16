# Expo glossary (routing aid)

Surface-level definitions for Expo concepts that affect routing. Depth lives in the relevant upstream sub-skill.

## Platform and SDK

**Expo SDK** — Versioned bundle of Expo's JavaScript libraries and native modules. Upgrades are typically one major-version step at a time; covered by `expo-upgrade`.

**Expo Router** — File-system-based routing on top of React Navigation. Default routing layer in modern Expo apps. UI patterns live in `expo-building-native-ui`; data-loading patterns in `expo-native-data-fetching/references/expo-router-loaders.md`.

**Expo Go** — Pre-built sandbox app from Expo for quickly running JS-only Expo projects without a custom native build. Limited to whatever native modules Expo Go ships; once you need anything custom, switch to a Dev Client.

**Dev Client** — A custom development build that includes your specific native modules. Replacement for Expo Go when the project needs custom native code. Lives in `expo-dev-client`.

## EAS (Expo Application Services)

**EAS Build** — Hosted iOS/Android build service. Replaces local Xcode/Gradle. Covered by `expo-deployment`.

**EAS Submit** — Submits built artifacts to App Store Connect and Google Play. Part of `expo-deployment`.

**EAS Update** — OTA JavaScript bundle delivery. Push fixes without re-submitting to the stores. Health monitoring lives in `eas-update-insights`.

**EAS Workflows** — Hosted CI/CD: YAML-defined pipelines that chain `eas build`, `eas update`, custom scripts, etc. Replaces hand-rolled GitHub Actions for most Expo teams. Covered by `expo-cicd-workflows`.

## Native modules and UI bridges

**expo-module** — Expo's framework for writing native modules in Swift / Kotlin / TypeScript. Wraps JSI under a more ergonomic API than the bare RN TurboModule path. Lives in `expo-module`.

**Config Plugin** — Build-time plugin that mutates native iOS/Android config (Info.plist, AndroidManifest.xml, Gradle, Podfile) during prebuild. Required for many native modules. Lives in `expo-module/references/config-plugin.md`.

**@expo/ui (Jetpack Compose)** — Renders Jetpack Compose views inside an Expo app on Android. Lives in `expo-ui-jetpack-compose`.

**@expo/ui (SwiftUI)** — Renders SwiftUI views inside an Expo app on iOS. Lives in `expo-ui-swift-ui`.

**Expo DOM components** — Runs web code (HTML/CSS/JS) inside Expo via dedicated webviews; declared with the `'use dom'` directive. Lives in `expo-use-dom`.

## UI / styling

**NativeWind** — Tailwind CSS for React Native, v5 paired with Tailwind v4. Style React Native components with Tailwind utility classes. Setup lives in `expo-tailwind-setup`.

**Native Tabs** — Expo's tab navigation primitives, distinct from React Navigation's tab navigator. Setup lives in `expo-upgrade/references/native-tabs.md` (introduced as part of SDK upgrades) and `expo-building-native-ui/references/tabs.md`.

## Networking and data

**Expo Router loaders** — Server-loader pattern (similar to Remix loaders) for data fetching tied to a route. Covered by `expo-native-data-fetching/references/expo-router-loaders.md`.

**Expo API Routes** — Server endpoints colocated with your Expo app, deployed via EAS Hosting. Covered by `expo-api-routes`.

## Migration / deprecation

**expo-av → expo-audio / expo-video** — Recent split of the legacy expo-av media package into focused modules. Migration paths in `expo-upgrade/references/expo-av-to-audio.md` and `expo-av-to-video.md`.

## When a term isn't here

If a concept isn't in this glossary, defer to the matching sub-skill from `decision-tree.md` or the official `docs.expo.dev` page. Do not invent definitions.
