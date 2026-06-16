---
name: testing-conventions
description: Project-specific testing conventions, fixtures, mocking rules, and examples
disable-model-invocation: false
version: 1.0
---

# Testing Conventions

## Testing Philosophy

No test runner is configured in the project yet — no jest, vitest, detox, or Deno test setup appears in any manifest's devDependencies. The conventions below define the intended approach when tests are introduced.

- Test pure business logic in `packages/shared` at the unit level — Zod schemas are deterministic and side-effect-free.
- Test Edge Functions with Deno's built-in test runner against a local Supabase stack (`supabase start`), not against mocks.
- Test mobile screens at the integration level with React Native Testing Library; avoid snapshot tests.

## Unit Test Patterns

Target `packages/shared` first — schema validation is the highest-value, lowest-cost test surface.

```typescript
// packages/shared/src/__tests__/answer.test.ts
import { answerSchema } from '../answer';

describe('answerSchema', () => {
  it('accepts valid input', () => {
    expect(() => answerSchema.parse({ questionId: 'abc-123', choice: 2 })).not.toThrow();
  });

  it('rejects missing choice', () => {
    expect(() => answerSchema.parse({ questionId: 'abc-123' })).toThrow();
  });
});
```

## Integration Test Patterns

Edge Functions must be tested against a running local Supabase stack, not mocked.

```typescript
// supabase/functions/submit-answer/index.test.ts  (Deno test runner)
import { assertEquals } from 'https://deno.land/std/assert/mod.ts';

Deno.test('submit-answer rejects unauthenticated requests', async () => {
  const res = await fetch('http://localhost:54321/functions/v1/submit-answer', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
});
```

## What NOT to Mock

- **Supabase client in Edge Functions** — mock/prod divergence causes failures that passing tests don't catch. Use `supabase start` instead.
- **Zod schemas** — schemas are pure; always test the real schema, never a stub.

## Coverage Expectations

- `packages/shared` schemas: 100% parse/reject coverage per schema.
- Edge Functions: at minimum, test the unauthenticated rejection path and one happy-path call.
- Mobile screens: test user-visible interactions; skip testing React Native framework internals.