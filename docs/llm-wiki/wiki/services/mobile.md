---
document_type: service
summary: 'I need to use the Write tool. Let me write the file:'
last_updated: '2026-06-15T14:50:02.906Z'
tags:
  - service
  - typescript
  - mobile
  - expo
  - react-native
service_id: mobile
---
I need to use the Write tool. Let me write the file:

```
## Purpose

`mobile` (`apps/mobile`) is the primary user-facing surface of VITNESS...
```

Let me just write it using the correct approach — a single Write call to the file path. The Read tool cannot create directories; I need to use the Write tool which I haven't called yet. Let me do that now.

The content is fully synthesized. Here is the final markdown body for `docs/llm-wiki/wiki/services/mobile.md`:

---

## Purpose

`mobile` (`apps/mobile`) is the primary user-facing surface of VITNESS. It is an Expo 56 + React Native 0.85 application targeting iOS, Android, and web. It consumes the Supabase backend (Postgres via PostgREST, Auth, Realtime, and Edge Functions) through the Supabase JS client, and imports shared Zod schemas and domain types from [[shared]] (`@vitness/shared`) for compile-time contract safety across the client/server boundary.

## Public API / Surface

Mobile is a client application — it exposes no HTTP endpoints or programmatic API surface. Its user-facing entry points are Expo Router screens registered under `apps/mobile/src/app/`:

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/index.tsx` (`HomeScreen`) | Home / landing screen |
| `/explore` | `src/app/explore.tsx` (`TabTwoScreen`) | Explore / feature showcase screen |
| _(layout)_ | `src/app/_layout.tsx` | Root layout — injects `ThemeProvider`, `AnimatedSplashOverlay`, and `AppTabs` |

The tab navigator surfaces two tabs: **Home** (`/`) and **Explore** (`/explore`). New screens are added by creating files under `src/app/`; Expo Router derives the URL segment from the filename automatically.

## Internal Architecture

The app is organised into five layers inside `apps/mobile/src/`:

```
src/
├── app/          Expo Router screens and root layout (entry points)
├── components/   Shared React Native components
│   └── ui/       Primitive UI sub-components (Collapsible, etc.)
├── hooks/        Custom React hooks
├── constants/    Theme tokens (Colors, Fonts, Spacing) and platform constants
└── assets/       Static images and fonts
```

Key structural nodes by coupling score (from graph analysis):

- `TabTwoScreen` (`explore.tsx`) — hub score 47; aggregates the most component dependencies.
- `ThemedText` (`components/themed-text.tsx`) — hub score 40 and highest betweenness; used by virtually every screen and component.
- `ThemedView` (`components/themed-view.tsx`) — hub score 18; background-colour container wrapping most layouts.
- `Collapsible` (`components/ui/collapsible.tsx`) — hub score 17; accordion primitive.
- `useTheme` (`hooks/use-theme.ts`) — second-highest bridge score; supplies the active colour palette to all themed components.

Platform overrides follow the `.web.tsx` suffix convention: `app-tabs.web.tsx` ships a custom horizontal tab bar for web while `app-tabs.tsx` uses the native Expo Router `Tabs` API on iOS/Android.

## Request Lifecycle

A typical user interaction that calls a Supabase Edge Function:

1. **User action** triggers a React event handler inside a screen component.
2. **Supabase JS client** issues an HTTPS POST to `/functions/v1/{name}`, attaching the session JWT as `Authorization: Bearer`.
3. **Edge Function** (see [[supabase]]) validates the JWT via `supabase.auth.getUser()`, parses the request body against the shared Zod schema from `@vitness/shared`, executes business logic, and returns JSON.
4. **Screen** receives the JSON response and updates React state, triggering a re-render.

For read-only data (fixture results, user game state), the app queries Postgres directly through PostgREST — no Edge Function is involved. RLS policies enforce that queries return only rows owned by the authenticated user.

## Data Layer

Mobile owns no local persistent data store beyond in-process React state. All persistent data lives in Postgres (owned by [[supabase]]). The mobile app accesses it via:

- **PostgREST** — reads and simple writes through the Supabase JS client's `.from()` API.
- **Edge Functions** — writes requiring server-side validation or grading logic (e.g., `submit-answer`).
- **Supabase Auth** — session and identity; JWT stored by the Supabase JS client in secure storage.
- **Supabase Realtime** — available via SDK; specific subscriptions not determined by analysis.

## Configuration

Specific build-time environment variable names (Supabase project URL, anon key) are not determined by analysis — they are typically injected via `expo-constants` / `app.config.js`. The app reads no environment variables directly at runtime; all secrets are embedded at build time or retrieved from Supabase Auth's session storage after sign-in.

## Integrations

| Integration | Direction | Protocol | Notes |
|-------------|-----------|----------|-------|
| [[supabase]] Postgres (PostgREST) | outbound | HTTPS/REST | Read/write user and game data |
| [[supabase]] Auth | outbound | HTTPS | Sign-in, session management, JWT issuance |
| [[supabase]] Edge Functions | outbound | HTTPS | Custom business logic (e.g., `submit-answer`) |
| [[shared]] (`@vitness/shared`) | compile-time import | pnpm workspace | Shared Zod schemas and domain types |

The mobile app never calls the API-Football external service directly; sports fixture data is upserted into Postgres by the [[supabase]] poller Edge Function and consumed through PostgREST queries.

## Service-Specific Patterns

**File-based routing via Expo Router** — each file under `src/app/` maps to a URL route. The root layout (`_layout.tsx`) composes the `ThemeProvider`, splash animation, and tab navigator; screen files are leaf nodes in this tree. A directory creates a nested route segment automatically.

**`.web.tsx` platform overrides** — components with meaningfully different web and native implementations are split into `{name}.tsx` (native) and `{name}.web.tsx` (web). Metro picks the correct variant at bundle time. Observed in `app-tabs` and `animated-icon`.

**Themed component wrappers** — `ThemedText` and `ThemedView` encapsulate colour-scheme awareness behind a `type` prop that maps to entries in the `Colors` token table (`constants/theme.ts`). Screens consume these wrappers rather than calling `useColorScheme` directly.

**`useTheme` hook** — a thin adapter over `useColorScheme` that normalises the `'unspecified'` return value to `'light'` and resolves the active colour palette from the `Colors` token table (`hooks/use-theme.ts:9`). All themed components depend on this hook.

**Reanimated v4 Keyframe animations** — animated splash and icon sequences are authored with the `Keyframe` API from `react-native-reanimated` v4. Worklet callbacks use `scheduleOnRN` from `react-native-worklets` to schedule React state updates from the worklet thread after animation completion (`components/animated-icon.tsx:36`).

**`@vitness/shared` schema consumption** — shared Zod schemas are imported from the `@vitness/shared` workspace package rather than duplicated locally. This keeps the mobile payload shape and the Edge Function parse step in sync through a single source of truth; see [[shared]] for schema authoring conventions.
