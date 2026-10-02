# Agent usage

> Draft written with the agent from the session history. **Review and edit before submitting.** The sections marked _TODO_ need your own words; reviewers check this file for authenticity.

## Tools

- **Claude (chat):** design and planning; produced the build kit (stack, schema, algorithms, phase prompts). _TODO: model/version you used._
- **Claude Code (VS Code extension), Claude Opus 5.5:** implementation, phase by phase, with each diff reviewed before moving on.
- **Gemini 2.5 Flash:** the runtime LLM inside the app (not used for coding).

## Representative prompts

1. _Phase 2:_ "Implement pure functions in `lib/`: `package.ts`, `hash.ts`, `checks.ts`, `diff.ts`, `staleness.ts`, `citations.ts`, `brief.ts` (template-based markdown assembly with gating). Follow these rules exactly: [checks, staleness, guardrails]. Write the Vitest tests listed. No database access in these files."
2. _Phase 3:_ "Implement these routes using the lib functions. Validate request bodies with Zod. Use the error shape `{error:{code,message,details}}`. Creating a version must run the checks, store the item hashes, and carry over statements with the staleness logic, all in a Prisma transaction. No route other than readiness may modify readiness."
3. _Phase 4:_ "Can we use a Google Gemini API key with `gemini-2.5-flash`?" Then: implement `lib/llm/` with a provider interface, strict schemas with no status fields, retry once with validation errors, citation validation, persist the AnalysisRun, 60s timeout.
4. _Phase 5:_ "Build the pages… every data view needs loading, empty, error-with-retry and success states", followed by "can we make the UI better?" (visual polish).
5. _Before submitting:_ "add rate limit" (public demo with no login, to protect the Gemini quota) and "make one more sample so that I can use the feature of compare".

## Delegated vs mine

| Delegated to the agent | Decided or redesigned by me |
|---|---|
| Scaffolding, Prisma schema, all `lib/` code and tests, API routes, LLM layer, UI components, CI, seed, README draft | The overall design (stable IDs, hashing, human-only readiness, template brief) came from my planning session |
| | Database: chose Neon over Supabase; Singapore region; Postgres only (no Neon Auth, storage, functions) |
| | LLM: switched the provider from Anthropic/OpenAI to Gemini 2.5 Flash |
| | _TODO: anything you changed by hand or pushed back on_ |

## Agent mistakes and corrections (running log)

- **Scaffold failed:** `create-next-app .` rejected the folder name "Aggroso" (capital letter). The agent scaffolded into a subfolder and moved the files up.
- **TypeScript target:** `Map`/`Set` iteration errors. The agent added `"target": "ES2020"`, but `tsc` kept failing because of a stale `tsconfig.tsbuildinfo`; deleting it fixed the problem.
- **Invalid route export:** the agent first exported a Zod schema from a `route.ts`. Next.js rejects non-handler exports from route files at build time; the agent caught this itself and made it module-private.
- **Font bug from the scaffold:** `globals.css` forced `font-family: Arial`, overriding the Geist font. Found during the UI polish pass.
- **Theme colours never applied:** the shadcn setup wrote colour variables in `oklch()` format, but `tailwind.config.ts` wrapped them as `hsl(var(--x))`. That's invalid CSS, so every themed colour (backgrounds, primary buttons, borders, muted text) silently fell back to browser defaults. The agent didn't catch it while building the UI, because it couldn't see the rendered page. I reported that the UI "has no theme", and inspecting the generated CSS found the cause; the fix maps colours with `color-mix(in oklch, var(--x) …)` so opacity modifiers keep working.
- **Layout shift between tabs:** I noticed the page shifting when switching tabs. The cause was the scrollbar appearing and disappearing between long and short tabs; fixed with `scrollbar-gutter: stable`.
- **Hung background test:** the first Gemini smoke test ran in the background and produced no output. It was rerun in the foreground and passed (3.4s).
- **Gaps in the original kit that the agent flagged and fixed:**
  - `Statement.runId` had no relation to its run.
  - There was no field for risk severity or the uncited flag.
  - Prompt traceability was weak, so a prompt hash was added.
  - Without a "latest version only" rule, old versions' reviews could be mutated.
  - There was no way to clear staleness without re-running the AI, so editing a stale statement now re-confirms it.
- **Avoided pitfalls from the kit's checklist:**
  - The brief is template-built, not LLM-built.
  - Version creation is transactional.
  - Old versions are never mutated.
  - No approval field exists in the AI schema.
  - No test was weakened to make it pass.
- _TODO: suggestions you rejected, and why._

## Verification

- Reviewed each phase's diff before continuing.
- `npm test` (51 tests), `npm run lint` and `npm run typecheck` are green at every phase; `next build` succeeds.
- Smoke-tested the API against Neon: checks on the sample, validation errors, brief blocked, v2 staleness, compare, and the old-version lock.
- Ran the sample through real Gemini: 17–20 statements, 0 invalid citations, about 4s. It caught all planted problems.
- Confirmed `.env` is git-ignored and that no keys appear in logs.
- _TODO: manual UI test of the full flow on the deployed URL, Vercel logs checked, `git log -p` checked for secrets._
