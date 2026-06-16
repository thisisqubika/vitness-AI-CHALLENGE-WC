# Qubika framework conventions for React Native projects

Conventions Qubika applies on top of upstream guidance. Anything not listed here defers to the upstream marketplace plugin for its area.

## Stack detection (Phase 1)

React Native and Expo projects are classified by Phase 1's `structure-architecture-analyzer` as services with `type: 'mobile'`. The analyzer sets:

- `service.type === 'mobile'`
- `service.frameworks.main` = `"React Native"` (bare) or `"Expo"` (managed / expo-router)
- `service.frameworks.additional` may include `"expo-router"`, `"Reanimated"`, `"Gesture Handler"`, etc. when manifest dependencies are present

This skill is copied into mobile projects by Phase 5's existing skill-resolver based on those triggers. The framework's orchestrator is otherwise unaware of marketplace registration — that's owned by this skill.

## Settings registration (script-driven)

This skill ships `scripts/register-marketplaces.mjs`. The first time the skill is loaded in a project, check `.claude/settings.json` for `extraKnownMarketplaces.swmansion` and `extraKnownMarketplaces["callstack-agent-skills"]`; if either is missing, run the script:

```bash
# Run from the project root in the target repo, where Phase 5 has copied the skill into .claude/skills/:
node .claude/skills/mastering-react-native-skill/scripts/register-marketplaces.mjs
# Or pass --cwd to target a different project root explicitly.
```

It writes (or deep-merges into) `.claude/settings.json`:

- `extraKnownMarketplaces.swmansion` → `software-mansion-labs/skills`
- `extraKnownMarketplaces["callstack-agent-skills"]` → `callstackincubator/agent-skills`
- `enabledPlugins`: `skills@swmansion`, `react-native-best-practices@callstack-agent-skills`, `upgrading-react-native@callstack-agent-skills`, `react-native-brownfield-migration@callstack-agent-skills`, `github-actions@callstack-agent-skills`

The script is idempotent — re-running it after the keys exist is a no-op. It never touches keys outside `extraKnownMarketplaces` and `enabledPlugins`, so developer customizations elsewhere in `settings.json` are preserved.

For Expo projects, `mastering-expo-skill` ships its own script for the `expo-plugins` marketplace.

## Build / run

| Task | Bare RN | Expo (managed) |
|---|---|---|
| Install | `npm install` (or pnpm/yarn per project) | same |
| iOS run | `npx react-native run-ios` | `npx expo run:ios` or `npx expo start` |
| Android run | `npx react-native run-android` | `npx expo run:android` or `npx expo start` |
| Production build | Xcode / Gradle | `eas build` |

The framework's `command-resolver` infers these defaults from `framework-config.json`. Override only when the project genuinely deviates (e.g. custom Fastlane lanes).

## Test

| Level | Default |
|---|---|
| Unit | `npx jest` (with `@react-native/babel-preset`) |
| Component | `@testing-library/react-native` on top of Jest |
| E2E | Detox or Maestro — project-specific; `framework-config.json` records which one |
| Visual | iOS simulator snapshot (or Maestro screenshot) baseline; framework-wide `ui-visual-testing` skill applies |

`generate-test-cases` works against RN screens the same way it does against web — the screen module path replaces a route path.

## Lint / typecheck

- Default: `eslint .` + `tsc --noEmit`.
- Preserve `@react-native/eslint-config` when the project already extends it. Do not replace with the generic TS ESLint config the framework uses elsewhere.
- Prettier defaults follow the framework's standard config unless the project has its own `.prettierrc`.

## CI

- Use `github-actions@callstack-agent-skills` for iOS simulator and Android emulator workflows.
- Artifact downloads via `gh` CLI follow the patterns in `mastering-github-cli` (framework-wide skill) — those compose cleanly with Callstack's composite-action templates.
- Do **not** enable Callstack's `github` plugin (PR / branching / review patterns). The framework's `pr-reviewer`, `create-pr`, and `mastering-github-cli` skills replace it.

## PR / docs / security

Framework-wide skills apply unchanged on React Native projects:

- `pr-reviewer`, `create-pr`, `doc-updater`, `security-review`, `code-quality-check`
- `mastering-git-cli`, `mastering-github-cli`
- `start-task`, `analyze-requirements`, `implement-ticket`

No RN-specific overrides exist for these flows today. If one becomes necessary, add it here rather than forking the framework-wide skill.
