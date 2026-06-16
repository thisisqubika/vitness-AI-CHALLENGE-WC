---
name: code-conventions
description: Project-specific coding conventions, gotchas, and WRONG/CORRECT examples
disable-model-invocation: false
version: 1.0
---

# Code Conventions

## Naming Conventions

- **Files:** kebab-case for all files (`themed-text.tsx`, `use-theme.ts`, `play-script.ts`). Consistent with Expo Router's file-based routing expectations.
- **React hooks:** prefix filename with `use-` and identifier with `use` (`use-theme.ts` → `useTheme`).
- **Platform overrides:** use `.web.tsx` suffix for web-specific component implementations alongside the native `.tsx` file.
- **Zod schemas:** name the exported constant with a `Schema` suffix in camelCase (`playScriptSchema`); export the inferred TypeScript type alongside it.
- **Edge Functions:** one function per directory; entry point is always `index.ts`.

## Validation Rules

Zod 4 (in `packages/shared`) is the single validation library. All schemas shared across the mobile ↔ edge function boundary are defined in `packages/shared/src/` and re-exported from `packages/shared/src/index.ts`.

```typescript
// WRONG — schema defined only inside the edge function; mobile has no contract
// supabase/functions/submit-answer/index.ts
const answerSchema = z.object({ questionId: z.string(), choice: z.number() });
```

```typescript
// CORRECT — shared schema consumed by both sides
// packages/shared/src/answer.ts
import { z } from 'zod';
export const answerSchema = z.object({ questionId: z.string(), choice: z.number() });
export type Answer = z.infer<typeof answerSchema>;

// supabase/functions/submit-answer/index.ts
import { answerSchema } from '../../packages/shared/src/index.ts';
const body = answerSchema.parse(await req.json());
```

## Gotchas

### Web Platform Overrides Must Have Identical Props

Expo resolves `.web.tsx` at bundle time. Divergent prop interfaces cause runtime errors on one platform while the other succeeds silently.

```typescript
// WRONG — web variant adds a prop the native version doesn't accept
// components/animated-icon.web.tsx
export function AnimatedIcon({ name, color, size, loop }: Props) { ... }
// components/animated-icon.tsx
export function AnimatedIcon({ name, color, size }: Props) { ... }
```

```typescript
// CORRECT — shared Props type imported by both files
// components/animated-icon.types.ts
export interface AnimatedIconProps { name: string; color: string; size: number; }
// components/animated-icon.tsx  (and .web.tsx)
import type { AnimatedIconProps } from './animated-icon.types';
export function AnimatedIcon(props: AnimatedIconProps) { ... }
```

### Edge Functions Must Validate JWT on Every Authenticated Request

Skipping validation allows unauthenticated callers to write game data.

```typescript
// WRONG — trusts a client-supplied header
const userId = req.headers.get('x-user-id');
```

```typescript
// CORRECT — extract user from verified JWT
const token = req.headers.get('Authorization')?.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token ?? '');
if (error || !user) return new Response('Unauthorized', { status: 401 });
```

## Code-Style Conventions

- Use `import type` for type-only imports — prevents accidental value imports in Deno edge environments.
- Keep Edge Function handlers under 80 lines; extract business logic to helper functions — Deno cold-start time scales with bundle complexity.
- Sort imports: built-ins → third-party → workspace (`packages/`) → local — mirrors standard TypeScript project conventions.