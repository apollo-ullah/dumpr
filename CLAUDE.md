# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next.js dev server on http://localhost:3000.
- `npm run build && npm run start` — production mode (how the user actually runs it daily).
- `npm test` — runs Vitest once. `npm run test:watch` for watch mode.
- Single test file: `npx vitest run tests/notion.test.ts`. Single test: `npx vitest run -t "writes items"`.
- There is no lint script. TS strict mode is on; `next build` type-checks.

## Required environment

`lib/env.ts` parses `process.env` with Zod at module load — importing anything that touches Notion fails fast without these. Set in `.env.local`:

- `NOTION_TOKEN` — internal-integration token; the integration must be granted access to the Inbox database.
- `NOTION_DATA_SOURCE_ID` — Notion **data source** ID (not the database ID; the v5 SDK writes to data sources).

Claude Code OAuth (at `~/.claude/config`) is the auth path for the agent SDK — there is no `ANTHROPIC_API_KEY`. The agent runs on the user's Max subscription.

## Architecture

Local-only Next.js (App Router) GUI that wraps the `ady-operating-system` Claude Code skill. Flow: brain dump → Claude infers Notion rows → user previews/edits → write to Notion Inbox.

**The skill lives in the repo.** `lib/skill.ts` reads `skills/SKILL.md` (relative to repo root) at request time. If you change inference behavior, edit that file directly — it's the source of truth. The terminal Claude Code skill at `~/.claude/skills/ady-operating-system/SKILL.md` is a symlink to the repo file (Ady's local setup only; forkers don't need this). This app appends a JSON-output override block (`JSON_INSTRUCTIONS_TEMPLATE` in `lib/skill.ts`) to the SKILL.md content, which disables the skill's terminal-style preview/approval/tool-call behavior and forces a single JSON object.

**Two API routes, one screen.**
- `POST /api/process` — `lib/agent.ts` runs `query()` from `@anthropic-ai/claude-agent-sdk` with `allowedTools: []`, strips code fences, parses, validates against `ItemsResponseSchema`. Returns `{ today, items }`. Server attaches a UUID per item for React keys.
- `POST /api/write` — `lib/notion.ts` writes pages **sequentially, stopping on first failure**. Returns `{ written, failures }`. The single-screen client (`app/page.tsx`) uses the failure index to offer "retry from item N+1".

**Zod is the contract.** `lib/types.ts` enums (`DOMAIN_VALUES`, `PRIORITY_VALUES`, `TYPE_VALUES`, `EFFORT_VALUES`, `CAPTURE_STATUS_VALUES`) are duplicated verbatim inside the prompt template in `lib/skill.ts`. `CAPTURE_STATUS_VALUES` is the strict subset of statuses we assign at capture time (`Planned`, `Backlog`); the full set of valid Notion `Status` options (`Backlog`, `Planned`, `In Progress`, `Blocked`, `Done`, `Dropped`) is documented in the README schema and enforced by Notion itself. Changing an enum means changing both `lib/types.ts` and the literal list in the prompt template, plus the Notion select option in the database, plus `DOMAIN_ICONS` in `lib/notion.ts` if you add a domain.

**Notion property mapping gotchas** (`lib/notion.ts`):
- Property names: `Title`, `Type`, `Domain`, `Priority Level` (with space), `Effort`, `Status`, `Due Date`.
- Priority values use an **em-dash** (`–`), not a hyphen — Notion select options match exactly.
- `Why (1%)` and `Next Action` are intentionally **never written**. Don't add them. (User memory: these are Ady-intrinsic; inferring them adds friction.)
- Page icon is set per-row from `DOMAIN_ICONS`.
- `dueDate: null` means omit the property; don't send `{ date: null }`.

**`flags`** (`ItemFlagsSchema`) is the structured form of the skill's `?` low-confidence markers. The UI surfaces flagged cells for editing; high-confidence batches write through without prompting.

## Code conventions

- Path alias: `@/*` → repo root (configured in both `tsconfig.json` and `vitest.config.ts`).
- Tailwind v3 with a custom `warm-*` palette (`tailwind.config.ts`). Use these tokens; don't introduce ad-hoc hex.
- Tests mock the agent SDK and Notion client (see `tests/agent.test.ts`, `tests/notion.test.ts`) — do not hit live services in tests.
- Claude Code OAuth at `~/.claude/config` is part of the runtime contract. The agent SDK uses it instead of `ANTHROPIC_API_KEY`. Don't suggest moving OAuth into the repo or asking for an API key.

## Reference docs in the repo

- `docs/superpowers/specs/2026-05-04-brain-dump-gui-design.md` — design spec.
- `docs/superpowers/plans/2026-05-04-brain-dump-gui.md` — implementation plan.
