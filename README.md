# Brain-Dump GUI

Local web wrapper around the `ady-operating-system` Claude Code skill. Type a P-level brain dump → preview the inferred Notion rows → click write.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For daily use:
```bash
npm run build && npm run start
```

Bookmark `http://localhost:3000`.

## First-time setup

1. **Notion integration.** Create an internal integration at https://www.notion.so/profile/integrations (capability: insert content). Open the Inbox database (`https://www.notion.so/2d13ad1b1fe780d3a569e9953ad1e8e7`) → "Add connections" → grant your integration access.

2. **`.env.local`.** Copy `.env.local.example` → `.env.local` and paste your token:
   ```
   NOTION_TOKEN=secret_<your integration token>
   NOTION_DATA_SOURCE_ID=2d13ad1b-1fe7-8071-92a4-000bcd80335b
   ```

3. **Claude Code OAuth.** Should already be active if you use Claude Code. Verify with `ls ~/.claude/config`. If missing, run `claude /login`.

## Tests

```bash
npm test
```

33 tests covering: SKILL.md prompt building, Item → Notion property mapping, batch writes with stop-on-first-failure, agent SDK orchestration with JSON validation, both API routes.

## Spec & plan

- Design spec: `docs/superpowers/specs/2026-05-04-brain-dump-gui-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-04-brain-dump-gui.md`

## Architecture

Single Next.js (App Router) app, runs locally only.

- `lib/skill.ts` — reads `~/.claude/skills/ady-operating-system/SKILL.md`, appends a JSON-output instruction block.
- `lib/agent.ts` — calls Claude via `@anthropic-ai/claude-agent-sdk` (OAuth → Max subscription, no per-token bill), validates response with Zod.
- `lib/notion.ts` — maps `Item` → Notion property objects, writes via `@notionhq/client`. Stops on first failure.
- `app/api/process/route.ts` — POST `{ dump }` → `{ today, items }`.
- `app/api/write/route.ts` — POST `{ items }` → `{ written, failures }`.
- `app/page.tsx` — single-screen orchestrator (input → preview → done).
- `components/` — DumpForm, PreviewTable, EditableCell, WriteBar, PartialFailureCallout.
