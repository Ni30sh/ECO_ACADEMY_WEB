# Supabase Migration - Current Status

Status: complete and running
Date: March 30, 2026
Project: EcoVerse Academy

## What Is Verified

- Build passes (`npm run build`)
- Tests pass (`npm run test -- --run`)
- Runtime data flow is Supabase-backed for auth, missions, learn, leaderboard, profile, and teacher dashboards
- Mission step system hooks/components are wired and compiling
- App-level local storage usage has been removed
- Remaining localStorage usage is only Supabase Auth session persistence in the client config

## Important Note About Types

`src/integrations/supabase/types.ts` is currently in compatibility mode so the app stays stable while schema types are refreshed.

Why: the generated type file was out of sync with the latest tables (for example mission steps and badges-related tables), which caused editor/type errors.

## Regenerate Strict Types (Recommended Next)

1. Supabase CLI is installed in this repo as a dev dependency.

```bash
npm run supabase:types:gen
```

2. If you get `Access token not provided`, export a personal access token from Supabase dashboard:

```bash
set SUPABASE_ACCESS_TOKEN=YOUR_SUPABASE_ACCESS_TOKEN
```

3. Generate strict types to a temporary file:

```bash
npm run supabase:types:gen
```

4. Apply generated file only when non-empty:

```bash
npm run supabase:types:apply
```

5. Switch `src/integrations/supabase/client.ts` back to strict typing:

- Replace `createClient<any>(...)` with `createClient<Database>(...)`
- Re-introduce `import type { Database } from './types';`

6. Validate:

```bash
npm run build
npm run test -- --run
```

## Current Commands

```bash
npm run dev
npm run build
npm run test -- --run
```

## Summary

The migration is functionally complete and stable in development/build/test.
The only remaining hardening step is regenerating strict Supabase schema types and re-enabling full client typing.
