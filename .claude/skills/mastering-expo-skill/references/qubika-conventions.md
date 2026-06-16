# Qubika framework conventions for Expo projects

Conventions Qubika applies on top of upstream Expo guidance. Anything not listed here defers to the relevant sub-skill inside `expo@expo-plugins`.

## Stack detection (Phase 1)

Expo projects are classified by Phase 1's `structure-architecture-analyzer` as:

- `service.type === 'mobile'`
- `service.frameworks.main` = `"Expo"`
- `service.frameworks.additional` often contains `"expo-router"`, `"NativeWind"`, etc. when the corresponding dependencies are present in `package.json`

This skill is copied into Expo projects by Phase 5's existing skill-resolver based on those triggers. The framework's orchestrator is otherwise unaware of marketplace registration — that's owned by this skill.

A project may be detected as **both** Expo and bare-React-Native (when EAS is layered on top of a bare RN tree). In that case both `mastering-expo-skill` and `mastering-react-native-skill` are copied to the project, and each runs its own `scripts/register-marketplaces.mjs` to register the upstream marketplaces relevant to it.

## Settings registration (script-driven)

This skill ships `scripts/register-marketplaces.mjs`. The first time the skill is loaded in a project, check `.claude/settings.json` for `extraKnownMarketplaces["expo-plugins"]`; if it's missing, run the script:

```bash
# Run from the project root in the target repo, where Phase 5 has copied the skill into .claude/skills/:
node .claude/skills/mastering-expo-skill/scripts/register-marketplaces.mjs
# Or pass --cwd to target a different project root explicitly.
```

It writes (or deep-merges into) `.claude/settings.json`:

- `extraKnownMarketplaces["expo-plugins"]` → `expo/skills`
- `enabledPlugins["expo@expo-plugins"]` → `true`

The script is idempotent — re-running after the keys exist is a no-op. It never touches keys outside `extraKnownMarketplaces` and `enabledPlugins`, so developer customizations elsewhere in `settings.json` are preserved.

If the project is also bare-RN-flavored, run `mastering-react-native-skill/scripts/register-marketplaces.mjs` as well — it registers the Callstack and Software Mansion marketplaces.

## Build / run

| Task | Default |
|---|---|
| Install | `npm install` (or pnpm/yarn per project) |
| Dev server | `npx expo start` |
| iOS dev build | `npx expo run:ios` |
| Android dev build | `npx expo run:android` |
| Production build | `eas build` (per profile in `eas.json`) |
| Submit to stores | `eas submit` |
| OTA update | `eas update` |

`command-resolver` reads these defaults from `framework-config.json` for use in agent prompts. Override only when the project genuinely deviates.

## Test

| Level | Default |
|---|---|
| Unit | `npx jest` with `jest-expo` preset |
| Component | `@testing-library/react-native` |
| E2E | Detox or Maestro (project-specific; recorded in `framework-config.json`) |
| Visual | Maestro screenshot baseline; framework-wide `ui-visual-testing` applies |

`generate-test-cases` operates on Expo Router screens the same way it operates on web routes — the route path identifies the screen module.

## Lint / typecheck

- Default: `eslint .` + `tsc --noEmit`.
- Preserve `eslint-config-expo` when the project already extends it. Do not replace with the framework's generic TS ESLint config.
- Prettier defaults follow the framework standard unless the project has its own `.prettierrc`.

## CI

- **Prefer EAS Workflows** (`expo-cicd-workflows`) for Expo projects. They handle iOS/Android builds, OTA updates, and store submission natively.
- Fall back to Callstack's `github-actions` patterns only when EAS Workflows isn't viable for the project's CI provider.
- Artifact downloads via `gh` CLI follow `mastering-github-cli`.

## OTA / Update strategy

- `eas-update-insights` is the canonical place for crash-rate / OTA-distribution / payload-size analysis. Framework-wide observability does not replace it.
- When publishing OTA updates that change native config, the framework's PR workflow requires explicit acknowledgement in the PR description — `pr-reviewer` flags missing acknowledgement.

## Native modules

- New native modules use the Expo Module API (`expo-module`) by default, even on RN-flavored hybrid projects. Bare-RN TurboModule authoring is reserved for cases where Expo's module API genuinely doesn't fit.
- Config plugins (build-time native config mutations) are committed to the repo alongside their consumer module — do not ship config plugins independently.

## PR / docs / security

Framework-wide skills (`pr-reviewer`, `create-pr`, `doc-updater`, `security-review`, `code-quality-check`) apply unchanged. The `github` plugin from Callstack's marketplace remains disabled — see `mastering-react-native-skill/references/qubika-conventions.md` for the reasoning.
