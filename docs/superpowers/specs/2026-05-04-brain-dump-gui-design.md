# Brain-Dump GUI — Design Spec

**Date:** 2026-05-04
**Status:** Approved (design phase complete, ready for implementation plan)
**Skill it wraps:** `~/.claude/skills/ady-operating-system/SKILL.md` (Structured Capture mode)

---

## 1. Context & goal

Today, capturing into the Notion personal-OS Inbox requires opening Claude Code on a laptop and invoking the `ady-operating-system` skill via terminal. The skill works (calibrated end-to-end on 2026-05-04, single-mode scope), but the friction-of-opening is incompatible with habit formation: a brain dump tool that requires a terminal will lose to "I'll do it later" every time.

This spec is a **local web GUI** that wraps the existing skill, exposing it as a single-screen experience: type a P-level dump, see the inferred preview table, edit any low-confidence cells inline, write to Notion. Same brain (`SKILL.md`), different harness.

**Success criteria:**
- Lower the friction of opening to "click a bookmark, type, two clicks, done."
- The UI feel makes Ady *want* to open it (Notion-warm visual direction — soft, light, echoes the destination).
- Skill rules in `SKILL.md` remain the single source of truth.
- Zero per-token cost (use Max subscription via Agent SDK OAuth).

## 2. Scope

**In scope:**
- One screen, one job: textarea → preview table → write.
- Inline-editable cells in the preview table for any low-confidence inference.
- Notion-warm visual direction (soft cream background, sage accent, serif headlines, generous whitespace).
- Local-only on Ady's Mac. No hosting, no auth, no public exposure.
- Manual write trigger (no auto-write even on fully-confident batches).

**Out of scope (explicitly):**
- Phone access. (Considered: Tailscale would have made it trivial; Ady picked local-only.)
- History view, multi-dump browsing, search. Notion is the history.
- Settings UI. Config goes in `.env.local`.
- Modes other than Structured Capture. Quick Capture, Project Breakdown, Unstick, Weekly Review remain deferred per `project_ady_operating_system.md`.
- Cleanup / migration of existing Notion rows.
- Drafts of unwritten dumps, retry queues, optimistic UI, offline mode.

## 3. Locked decisions

| Decision | Pick | Why |
|---|---|---|
| Hosting | Local-only on Mac | Simplest. Phone deferred. |
| UI scope | One screen, one job | Notion is the history; second history view splits source of truth. |
| Edit flow for `?` cells | Inline editable cells | Faster than free-text re-prompting; one-click fix. |
| Framework | Next.js (App Router) + Tailwind + Radix primitives | Best React polish-per-effort; Radix gives accessible dropdowns/dialogs unstyled. |
| Visual direction | Notion-warm (Direction B from mockups) | Soft, light, familiar; echoes Notion's surface. |
| Backend invocation | Path A — thin Agent SDK call | Max billing via OAuth + clean structured JSON output. SKILL.md used as system prompt, not loaded as a runtime skill. |
| Write trigger | Always require click on "Write N to Inbox" | Cost of extra tap is zero; cost of unwanted Notion row is non-zero. Skill's "auto-write if no `?`" doesn't apply because the GUI already shows the preview. |
| E2E testing | Manual only (no Playwright for v1) | Single-user local tool with active manual review on every dump. |

## 4. Architecture

Single Next.js app, App Router, runs on `localhost:3000` via `npm run dev`. Three logical pieces:

**Frontend (one route, `/`):**
- Pure client-side React state. No global state library.
- Three states held by `app/page.tsx`: `dump: string`, `items: Item[] | null`, `phase: "input" | "processing" | "preview" | "writing" | "done"`.

**Backend (two API routes inside the same Next app):**
- `POST /api/process` — body `{ dump: string }`. Returns `{ today: string, items: Item[] }`.
- `POST /api/write` — body `{ items: Item[] }`. Returns `{ written: number, failures: WriteFailure[] }`.

**Server-side helpers (`/lib`):**
- `lib/skill.ts` — reads `~/.claude/skills/ady-operating-system/SKILL.md` once at server startup, caches, builds the JSON-augmented system prompt.
- `lib/agent.ts` — wraps the Claude Agent SDK call. OAuth'd against existing Claude Code login (Max subscription).
- `lib/notion.ts` — wraps `@notionhq/client`. Knows the data source ID. Maps `Item` → Notion property objects.

**Configuration (`.env.local`):**
- `NOTION_TOKEN` — internal integration token from Notion settings.
- `NOTION_DATA_SOURCE_ID` — `2d13ad1b-1fe7-8071-92a4-000bcd80335b` (from `reference_notion_inbox.md`).
- Claude OAuth comes from Claude Code's existing token store; Agent SDK picks it up automatically — no env var needed.

**Process model:**
- One `npm run dev` (or `npm run start` after `npm run build` for daily use). Single Next.js server. No external services beyond Anthropic + Notion APIs.

## 5. Data shapes

### `Item` (the contract between `/api/process`, the UI, and `/api/write`)

```ts
type Item = {
  id: string;                      // client-side uuid; React key only, not sent to Notion
  title: string;
  type: "Task" | "Project";
  domain:
    | "Personal Project" | "Heave" | "Agency" | "GDG Projects"
    | "Notion CL" | "Arena" | "Coursework" | "Family"
    | "Health" | "Deen" | "Admin" | "Money" | "Content"
    | "Career" | "Growth" | "Personal";
  priority: "P1 – Critical" | "P2 – Important" | "P3 – Normal" | "P4 – Low";
  effort: "Low" | "Medium" | "High";
  dueDate: string | null;          // ISO YYYY-MM-DD or null
  status: "Planned" | "Backlog";
  flags: {                         // which cells are low-confidence (replaces SKILL.md's "?" markdown)
    title?: boolean;
    type?: boolean;
    domain?: boolean;
    priority?: boolean;
    effort?: boolean;
    dueDate?: boolean;
    status?: boolean;
  };
};
```

`flags` is the structured equivalent of the trailing `?` convention in SKILL.md's markdown table preview. UI uses it to apply the dashed-orange underline treatment from the mockup and to swap to inline-edit mode.

Domain enum uses the dropdown options from `reference_notion_inbox.md` as of 2026-05-04. Claude's JSON output must contain one of these exact strings (case-sensitive). The Zod schema enforces this — if Claude returns a string outside the enum, the route returns 500 and the UI shows the "invalid output" banner. If the Notion dropdown changes (new domain added in Notion), update the enum here and in the JSON instruction block — the values must stay in sync.

### `WriteFailure`

```ts
type WriteFailure = {
  index: number;     // 0-based position in the original items array
  item: Item;        // the item that failed (for "Retry from #N" re-submission)
  error: string;     // surfaced as-is from Notion (e.g., "select option 'Notion CL' not found")
};
```

### API contracts

**`POST /api/process`**
```
Request:  { dump: string }
Response: { today: string, items: Item[] }   // today = YYYY-MM-DD (server clock)
Errors:   400 invalid body
          502 Anthropic upstream failure (network, rate limit, OAuth)
          500 Claude response failed Zod validation
```

**`POST /api/write`**
```
Request:  { items: Item[] }
Response: { written: number, failures: WriteFailure[] }
Errors:   400 invalid body
          (Notion errors are not 5xx — they're written into `failures` and returned 200)
```

## 6. Components

### Frontend (`/app`, `/components`)

- **`app/page.tsx`** — single page. Holds `dump`, `items`, `phase` state. Routes between `DumpForm`, `PreviewTable`, and the done state based on `phase`.
- **`components/DumpForm.tsx`** — Notion-warm textarea + Process button. Process disabled until non-whitespace content. ⌘↵ submits. POSTs to `/api/process`, on success sets `items` + `phase = "preview"`. Shows red error banner on failure with dump text retained.
- **`components/PreviewTable.tsx`** — renders the items table. Header row: `Today: YYYY-MM-DD`. Columns: `# | Title | Type | Domain | Priority | Effort | Due | Status` (no Next Action, no Why — both always blank per skill). Cells with `flags[field] = true` get the dashed-orange underline + click-to-edit affordance. Non-flagged cells are also editable (allow correcting confident-but-wrong inferences).
- **`components/EditableCell.tsx`** — wraps a single cell. Static display by default; on click, swaps to:
  - Title → `<input type="text">`
  - Due → `<input type="date">` (guarantees ISO format, no parsing)
  - Type / Domain / Priority / Effort / Status → Radix Select with the exact dropdown enum values
  - On change: updates parent item state, clears the corresponding flag.
- **`components/WriteBar.tsx`** — sticky bottom bar. Shows `Write N to Inbox` (sage button, primary) + `Discard` (text button). Disabled while writing. On success, shows the SKILL.md-style one-liner (`Wrote 4 items: 1 P1 Planned, 2 P2/P3 Planned, 1 P4 Backlog.`) + "New dump" button to reset.
- **`components/PartialFailureCallout.tsx`** — red callout shown when `failures` is non-empty. Lists the failing item title + Notion's error string. Two buttons: `Retry from #N` (re-POSTs items[N..] only) and `Discard remaining`.

### Backend (`/lib`)

- **`lib/skill.ts`**
  - `loadSkill(): string` — reads `~/.claude/skills/ady-operating-system/SKILL.md` once at module load, caches in module scope. **SKILL.md is read unmodified** — this app never writes to it. The terminal-invoked skill and the GUI both consume the same file. Fails the server boot if missing.
  - `buildSystemPrompt(today: string): string` — returns the unmodified SKILL.md content + a JSON instruction block **appended in memory only** (not written back to disk). The instruction block:
    - Defines today's date so date inference is deterministic.
    - Specifies the JSON schema (matching the `Item` shape above).
    - Overrides the SKILL.md "trailing `?`" rule with `flags` metadata (instructs Claude to set `flags[field] = true` for low-confidence cells instead of appending `?` to the cell value).
    - Instructs to omit the table preview and prose entirely — JSON only.
- **`lib/agent.ts`**
  - `processDump(dump: string): Promise<{ today: string, items: Item[] }>` — calls Claude via Agent SDK with the system prompt + dump as user message. Validates response against Zod `Item[]` schema. Throws on validation failure (caught by route → returns 500).
- **`lib/notion.ts`**
  - `writeItems(items: Item[]): Promise<{ written: number, failures: WriteFailure[] }>` — loops items in order. Builds property object per item (see mapping below). Calls `client.pages.create({ parent: { type: "data_source_id", data_source_id: env.NOTION_DATA_SOURCE_ID }, properties })`. Uses `data_source_id` (not `database_id`) — matches the value Ady already has in `reference_notion_inbox.md` and works correctly for the multi-source-aware Inbox database. Stops on first failure, returns partial result.
  - **Property mapping (the tested surface):**
    - `Title` → `title` property (rich_text in Notion's title format)
    - `Type` → select
    - `Domain` → select
    - `Priority Level` → select (em-dash strings, e.g. `P1 – Critical`)
    - `Effort` → select
    - `Due Date` → date with `start: ISO YYYY-MM-DD`, omitted if `dueDate === null`
    - `Status` → select
    - `Next Action` → **never set**
    - `Why (1%)` → **never set**

## 7. Data flow (5 phases)

**Phase 1 — Input.**
User types in `DumpForm`. Process button enabled when textarea has non-whitespace content. Submit (click or ⌘↵) → POST `/api/process` with `{ dump }`. Phase transitions to `"processing"` immediately; button shows spinner.

**Phase 2 — Process.**
Server side:
1. `POST /api/process` computes `today` as a YYYY-MM-DD string in the **server's local timezone** (using `Date.getFullYear/getMonth/getDate`, not `toISOString()` which is UTC and would roll forward at night). The server runs on Ady's Mac, so server-local = Ady-local.
2. Calls `processDump(dump)` → Agent SDK with cached SKILL.md + JSON instructions + today's date in system prompt + dump as user message.
3. Validates response against Zod `Item[]` schema.
4. Returns `{ today, items }` to client.

Client receives → sets `items` state, sets `today` state for the table header → phase = `"preview"`. Dump text is **kept** in client state (not cleared) so Discard returns to it.

**Phase 3 — Preview.**
`PreviewTable` renders the items in Notion-warm styling. Header row shows `Today: 2026-05-04` (from server response, **not** browser `Date()`).

User can:
- Click any cell → inline edit. Non-flagged cells are also editable (don't gate edits on the flag).
- On change, parent state updates the item AND clears `flags[field]`.
- Click `Discard` → phase = `"input"`, `items` cleared, dump text retained.
- Click `Write N to Inbox` → phase = `"writing"`.

**Phase 4 — Write.**
`POST /api/write` with `{ items }`. Server loops items in order, calls `notion.pages.create` for each. On any failure: stop, return `{ written: N, failures: [{index, item, error}] }`.

**Phase 5 — Done.**
- All-success: green strip with the SKILL.md-style one-liner + `New dump` button → reset to `"input"` with cleared dump.
- Partial-failure: green strip showing `Wrote N of M items.` + red `PartialFailureCallout` listing the failure + `Retry from #N` / `Discard remaining` actions.

## 8. Error handling

### Process errors (`/api/process` failed)

| Error class | UX |
|---|---|
| Network / Anthropic 5xx / rate limit | Red banner above textarea: `Couldn't process — try again.` Dump retained. No auto-retry. |
| Claude OAuth missing/expired | Banner: `Claude OAuth not found. Run `claude /login` in your terminal, then try again.` |
| Claude returned invalid JSON (Zod fails) | Banner: `Claude returned invalid output. Try again, or simplify the dump.` Server logs raw response for debugging. No automatic re-prompt. |

### Write errors (`/api/write` partial failure)

Server stops on first failure. Returns `{ written, failures }` with 200 (Notion errors are expected, not server errors).

UI surfaces partial-success state (Phase 5 above). Notion errors are surfaced as-is — the message tells the truth (`select option 'Notion CL' not found` → fix a dropdown name in the skill).

### Startup errors

Server refuses to start if missing:
- `~/.claude/skills/ady-operating-system/SKILL.md`
- `NOTION_TOKEN` env var
- `NOTION_DATA_SOURCE_ID` env var

Logs a clear error in the terminal that started it. These are setup errors, fix-once.

### Input boundary defenses

- Process button disabled until textarea has non-whitespace content.
- Date cells use `<input type="date">` → guarantees ISO.
- Dropdown cells use Radix Select with fixed enum options → can't pick invalid value.
- Title cell: free text, no validation.

## 9. Testing strategy

Three layers, lightweight on the bottom, manual on top.

### Layer 1 — Unit tests (vitest)

- **`lib/notion.ts` Item → property object mapper.** Highest-leverage tests in the project — if a property name or dropdown string is wrong, every write fails. Cover: each Domain dropdown value, each Priority em-dash string, each Status, ISO date format on `Due Date`, the "do NOT include Next Action or Why (1%)" rule. ~15 cases.
- **`lib/skill.ts` system prompt builder.** Smoke test: today's date is injected; JSON instruction block is appended after SKILL.md content; SKILL.md content itself isn't mutated.
- **Zod `Item` schema.** Accepts canonical happy-path JSON. Rejects bad enum values (e.g., `P1 - Critical` with hyphen instead of em-dash). Rejects malformed dates.

### Layer 2 — API route tests (vitest with mocked deps)

- `/api/process` with mocked Agent SDK returning canned JSON → verifies route returns `{today, items}`, returns 500 on Zod failure, returns 502 on upstream error.
- `/api/write` with mocked `@notionhq/client` → verifies stop-on-first-failure, correct `{written, failures}` shape, items 0..N written before failure at index N.

### Layer 3 — End-to-end

- **Manual happy path is the only E2E test.** Type the canonical SKILL.md example dump (4 items, P1–P4), verify the table renders with `Today` header, edit one cell (e.g., change a Domain dropdown), click Write, confirm 4 rows appeared in the real Inbox DB with correct properties.
- **No Playwright for v1.** Single-user local tool with active manual review on every dump = automated E2E is ceremony.

### Explicitly not tested

- React component rendering (visual is the test).
- Agent SDK internals (Anthropic's job).
- Notion API contract (Notion's job).

## 10. Aesthetic spec (Notion-warm)

Captured for the implementation phase. From mockup B:

- **Background:** `#fbf9f4` (warm cream).
- **Foreground text:** `#37352f` (Notion dark gray).
- **Muted text:** `#9b9889`.
- **Borders:** `#ece8df`.
- **Headline font:** Charter or Georgia (serif), `24px`, weight 600, letter-spacing -0.01em.
- **Body / UI font:** Söhne, Inter, or system sans-serif, `13–15px`.
- **Mono (for P-level chips, dates in textarea):** ui-monospace.
- **Primary action button:** `#7d9b76` (sage), white text, `7px` radius.
- **Secondary action button:** transparent, `#6e6a5e` text, `1px solid #ece8df`.
- **Surface cards:** white background, `10px` radius, `1px solid #ece8df`, soft shadow `0 1px 2px rgba(15,15,15,0.04)`.
- **Low-confidence cell treatment:** `#c98a55` (warm amber) text, `1px dashed #c98a55` underline.
- **P-level chips in textarea:** `#f1ede4` background, `#7d9b76` text, mono font, `4px` radius.
- **Spacing:** generous — `36px 44px` padding on the main card, `18px` margin between sections.

## 11. Setup checklist (for implementation phase)

1. `npx create-next-app@latest` with TypeScript, Tailwind, App Router, no `src/` directory.
2. Install: `@notionhq/client`, `@anthropic-ai/claude-agent-sdk`, `zod`, `@radix-ui/react-select`, `@radix-ui/react-dialog`, `vitest`, `@types/node`.
3. Create Notion internal integration → grant access to Inbox database → copy token to `.env.local`.
4. Verify Claude Code OAuth works (already set up).
5. Bookmark `http://localhost:3000` for one-click access.
