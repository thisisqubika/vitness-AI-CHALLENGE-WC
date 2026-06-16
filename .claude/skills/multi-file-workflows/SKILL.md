---
name: multi-file-workflows
description: Ordered checklists for cross-cutting changes — add screen, add edge function, add shared schema, add migration
disable-model-invocation: false
version: 1.0
---

# Multi-File Workflows

## Adding a New Mobile Screen

1. Create the screen at `apps/mobile/src/app/{route}.tsx`
2. Add any new hook at `apps/mobile/src/hooks/use-{name}.ts`
3. Add shared types or Zod schemas to `packages/shared/src/{schema-name}.ts` and re-export from `packages/shared/src/index.ts`

```typescript
// apps/mobile/src/app/{route}.tsx
import { View } from 'react-native';

export default function RouteScreen() {
  return <View />;
}
```

> **Gotcha**: Expo Router derives the URL segment from the filename. A directory creates a nested route segment automatically — name files accordingly.

## Adding a New Edge Function

1. Create `supabase/functions/{name}/index.ts`
2. Import CORS headers from `supabase/functions/_shared/cors.ts`
3. Import request/response schemas from `packages/shared/src/index.ts`
4. If new schema needed: add to `packages/shared/src/{schema-name}.ts`, re-export from `packages/shared/src/index.ts`
5. Test locally with `supabase functions serve {name}`

```typescript
// supabase/functions/{name}/index.ts
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  // TODO: validate JWT, parse body, implement logic

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

> **Gotcha**: Always handle the `OPTIONS` preflight. Missing it silently breaks all mobile requests to this function in production.

## Adding a New Shared Schema / Type

1. Create `packages/shared/src/{schema-name}.ts` with the Zod schema and inferred type
2. Re-export from `packages/shared/src/index.ts`

```typescript
// packages/shared/src/{schema-name}.ts
import { z } from 'zod';

export const myEntitySchema = z.object({
  id: z.string().uuid(),
});

export type MyEntity = z.infer<typeof myEntitySchema>;
```

> **Gotcha**: Export both the schema constant AND the inferred type. Mobile consumers need the type; Edge Functions need the schema for runtime `.parse()`.

## Adding a New Database Migration

1. Create `supabase/migrations/{YYYYMMDDHHmmss}_{description}.sql`
2. Run `supabase db reset` locally to apply and verify
3. If the schema change affects shared types, update `packages/shared/src/domain.ts`

```sql
-- supabase/migrations/{YYYYMMDDHHmmss}_{description}.sql
ALTER TABLE public.my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
```

> **Gotcha**: Migration filenames must be strictly ascending by timestamp. Out-of-order files cause `supabase db reset` to fail with a confusing error.