# dumpr — OSS Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the existing local Next.js brain-dump GUI to GitHub as MIT-licensed `dumpr`, with a forker-friendly README and a single source of truth for the skill file.

**Architecture:** No app behavior changes. Move `~/.claude/skills/ady-operating-system/SKILL.md` into the repo at `skills/SKILL.md`; rewrite `lib/skill.ts` to read from there. Scrub personal data from setup files. Add LICENSE. Rewrite README for forkers (schema doc + 3-place domain-customization instructions). Compress favicon/logo PNGs. Rename repo + package to `dumpr`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, `@anthropic-ai/claude-agent-sdk`, `@notionhq/client`, Tailwind v3, `pngquant` (one-time PNG compression).

**Spec:** `docs/superpowers/specs/2026-05-05-oss-launch-design.md`

## Files Touched

| Path | Action | Why |
|---|---|---|
| `app/api/stats/route.ts`, `components/DashboardStrip.tsx`, `lib/notion.ts`, `lib/types.ts`, `app/page.tsx`, `components/EditableCell.tsx`, `app/icon.png`, `public/logo.png`, `app/favicon.ico` (deleted), `CLAUDE.md` | Commit (currently uncommitted) | Land existing work before launch prep |
| `app/icon.png`, `public/logo.png` | Compress in place | Currently 568 KB each; trim to ~50 KB |
| `skills/SKILL.md` | Create (new) | Single source of truth (per spec Q3-A) |
| `lib/skill.ts` | Modify | Read from repo, not home dir |
| `~/.claude/skills/ady-operating-system/SKILL.md` | Replace with symlink | Ady's terminal Claude Code skill keeps working |
| `.env.local.example` | Modify | Strip Ady's data source ID |
| `CLAUDE.md` | Modify | Update line saying skill lives outside repo |
| `LICENSE` | Create | MIT |
| `docs/screenshot.png` | Create (manual screenshot) | README + X-post visual |
| `README.md` | Rewrite | Forker-facing setup + schema doc |
| `package.json` | Modify | `"foundation"` → `"dumpr"` |
| GitHub repo | Rename | `notion-ops` → `dumpr` |
| `.git/config` (remote) | Modify | Update URL after rename |

---

## Task 1: Land existing uncommitted work

**Files:**
- Modify: all uncommitted files in working tree (see `git status`)

- [ ] **Step 1: Confirm working tree state**

Run: `git status`
Expected: shows `M CLAUDE.md`, `D app/favicon.ico`, `M app/page.tsx`, `M components/EditableCell.tsx`, `M lib/notion.ts`, `M lib/types.ts`, `?? app/api/stats/`, `?? app/icon.png`, `?? components/DashboardStrip.tsx`, `?? public/logo.png`.

- [ ] **Step 2: Run tests to confirm green baseline**

Run: `npm test`
Expected: 33 tests pass.

- [ ] **Step 3: Stage and commit**

```bash
git add CLAUDE.md app/page.tsx components/EditableCell.tsx lib/notion.ts lib/types.ts \
        app/api/stats/route.ts app/icon.png components/DashboardStrip.tsx public/logo.png \
        app/favicon.ico
git commit -m "$(cat <<'EOF'
feat: dashboard strip + custom logo + favicon migration

Adds a top stats strip (P1-P4 counts, due-this-week, starving) backed
by a new /api/stats route that calls fetchStats(). Replaces the default
Next.js favicon with a per-app icon. Adds a logo.png for the header.
EOF
)"
```

- [ ] **Step 4: Verify clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Task 2: Compress favicon and logo PNGs

**Files:**
- Modify: `app/icon.png` (568 KB → ~50 KB)
- Modify: `public/logo.png` (568 KB → ~50 KB)

- [ ] **Step 1: Install pngquant if not already**

Run: `which pngquant || brew install pngquant`
Expected: prints a path or completes brew install.

- [ ] **Step 2: Compress both PNGs in place**

```bash
pngquant --quality=70-90 --skip-if-larger --force --output app/icon.png app/icon.png
pngquant --quality=70-90 --skip-if-larger --force --output public/logo.png public/logo.png
```

Expected: both files now significantly smaller. Run `ls -la app/icon.png public/logo.png` and confirm both are well under 200 KB.

- [ ] **Step 3: Visually verify quality**

Open both files in Preview (or any image viewer): `open app/icon.png public/logo.png`
Expected: no visible quality degradation. If quality is bad, re-run with `--quality=85-95` instead.

- [ ] **Step 4: Verify app still renders correctly**

Run: `npm run dev` (in another terminal), visit http://localhost:3000.
Expected: favicon shows correctly in browser tab, logo renders in header. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/icon.png public/logo.png
git commit -m "perf: compress icon.png and logo.png with pngquant (568KB→~50KB)"
```

---

## Task 3: Move SKILL.md into repo

**Files:**
- Create: `skills/SKILL.md` (verbatim copy from `~/.claude/skills/ady-operating-system/SKILL.md`)

- [ ] **Step 1: Create skills/ directory**

Run: `mkdir -p skills`
Expected: directory created or already exists.

- [ ] **Step 2: Copy SKILL.md from home to repo**

Run: `cp ~/.claude/skills/ady-operating-system/SKILL.md skills/SKILL.md`
Expected: file copied. Verify size matches: `wc -l skills/SKILL.md ~/.claude/skills/ady-operating-system/SKILL.md` should show identical line counts.

- [ ] **Step 3: Verify content with diff**

Run: `diff skills/SKILL.md ~/.claude/skills/ady-operating-system/SKILL.md`
Expected: no output (files identical).

- [ ] **Step 4: Commit**

```bash
git add skills/SKILL.md
git commit -m "feat: move ady-operating-system SKILL.md into repo at skills/SKILL.md"
```

---

## Task 4: Update lib/skill.ts to read from repo

**Files:**
- Modify: `lib/skill.ts:1-20`

- [ ] **Step 1: Run skill.test.ts to confirm baseline**

Run: `npx vitest run tests/skill.test.ts`
Expected: 6 tests pass (loadSkill returns content, contains "Structured Capture", buildSystemPrompt builds, etc.).

- [ ] **Step 2: Modify lib/skill.ts**

Replace the imports and `SKILL_PATH` constant. Current code:

```typescript
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SKILL_PATH = join(homedir(), ".claude/skills/ady-operating-system/SKILL.md");
```

New code:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL_PATH = join(process.cwd(), "skills/SKILL.md");
```

Update the error message inside `loadSkill()`:

Current:
```typescript
throw new Error(
  `Could not read SKILL.md at ${SKILL_PATH}. ` +
    `Ensure the ady-operating-system skill is installed. (${(err as Error).message})`
);
```

New:
```typescript
throw new Error(
  `Could not read SKILL.md at ${SKILL_PATH}. ` +
    `Expected at skills/SKILL.md in repo root. (${(err as Error).message})`
);
```

- [ ] **Step 3: Re-run tests to confirm green**

Run: `npx vitest run tests/skill.test.ts`
Expected: same 6 tests still pass — they read from `skills/SKILL.md` (created in Task 3) via the new path.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: 33 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/skill.ts
git commit -m "refactor: read SKILL.md from repo (skills/SKILL.md) instead of home dir"
```

---

## Task 5: Symlink Ady's home dir to repo (one-time, manual)

**Files:**
- Replace: `~/.claude/skills/ady-operating-system/SKILL.md` → symlink

This step preserves Ady's terminal Claude Code skill (which loads from `~/.claude/skills/`) using the repo as source of truth.

- [ ] **Step 1: Remove the existing home-dir SKILL.md**

Run: `rm ~/.claude/skills/ady-operating-system/SKILL.md`
Expected: file removed.

- [ ] **Step 2: Create symlink home → repo**

```bash
ln -s "$(pwd)/skills/SKILL.md" ~/.claude/skills/ady-operating-system/SKILL.md
```

(Run from the repo root so `$(pwd)` resolves to the absolute repo path.)

Expected: symlink created.

- [ ] **Step 3: Verify symlink**

Run: `ls -la ~/.claude/skills/ady-operating-system/SKILL.md`
Expected: line starts with `lrwxr-xr-x` and shows `-> /Users/adyanullah/Documents/GitHub/notion-ops/skills/SKILL.md` (or wherever the repo lives).

- [ ] **Step 4: Sanity-check by re-reading via symlink**

Run: `head -5 ~/.claude/skills/ady-operating-system/SKILL.md`
Expected: prints the first 5 lines of the SKILL.md content (proves the symlink resolves).

No commit — this is local filesystem state, not in the repo.

---

## Task 6: Scrub `.env.local.example`

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Replace contents**

Current contents:
```
NOTION_TOKEN=secret_xxx_paste_internal_integration_token_here
NOTION_DATA_SOURCE_ID=<your-data-source-uuid>
```

New contents:
```
NOTION_TOKEN=secret_xxx_paste_internal_integration_token_here
NOTION_DATA_SOURCE_ID=paste_your_data_source_id_here
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore: remove personal data source ID from .env.local.example"
```

---

## Task 7: Update `CLAUDE.md` for new skill location

**Files:**
- Modify: `CLAUDE.md:28` and `CLAUDE.md:50`

- [ ] **Step 1: Update the architecture paragraph (line 28)**

Find the line that starts with `**The skill lives outside the repo.**` and replace the whole paragraph:

Current:
```
**The skill lives outside the repo.** `lib/skill.ts` reads `~/.claude/skills/ady-operating-system/SKILL.md` from the user's home dir at request time. The repo has no copy. If you change inference behavior, the source of truth is that external SKILL.md; this app only appends a JSON-output override block (`JSON_INSTRUCTIONS_TEMPLATE` in `lib/skill.ts`) that disables the skill's terminal-style preview/approval/tool-call behavior and forces a single JSON object.
```

New:
```
**The skill lives in the repo.** `lib/skill.ts` reads `skills/SKILL.md` (relative to repo root) at request time. If you change inference behavior, edit that file directly — it's the source of truth. The terminal Claude Code skill at `~/.claude/skills/ady-operating-system/SKILL.md` is a symlink to the repo file (Ady's local setup only; forkers don't need this). This app appends a JSON-output override block (`JSON_INSTRUCTIONS_TEMPLATE` in `lib/skill.ts`) to the SKILL.md content, which disables the skill's terminal-style preview/approval/tool-call behavior and forces a single JSON object.
```

- [ ] **Step 2: Update the runtime-contract bullet (line 50)**

Find:
```
- The user's `~/.claude` directory is part of the runtime contract (skill file + OAuth). Don't suggest moving config into the repo.
```

Replace with:
```
- Claude Code OAuth at `~/.claude/config` is part of the runtime contract. The agent SDK uses it instead of `ANTHROPIC_API_KEY`. Don't suggest moving OAuth into the repo or asking for an API key.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect skill living in repo (skills/SKILL.md)"
```

---

## Task 8: Add LICENSE (MIT)

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Create LICENSE file**

Write the following to `LICENSE`:

```
MIT License

Copyright (c) 2026 Adyan Ullah

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

## Task 9: Capture screenshot (manual, Ady)

**Files:**
- Create: `docs/screenshot.png`

- [ ] **Step 1: Run the app**

```bash
npm run build && npm run start
```

- [ ] **Step 2: Capture a representative screenshot**

Visit http://localhost:3000. Either:
- Paste a small brain dump and capture mid-preview-edit (one cell highlighted/being edited), OR
- Capture the dashboard strip + dump-form view at rest.

Use macOS `Cmd+Shift+4` then space then click the window for a clean window screenshot, or `Cmd+Shift+4` then drag for a region.

Save to `docs/screenshot.png`.

- [ ] **Step 3: Verify**

Run: `ls -la docs/screenshot.png`
Expected: file exists, reasonably sized (~100-500 KB).

- [ ] **Step 4: Commit**

```bash
git add docs/screenshot.png
git commit -m "docs: add app screenshot for README"
```

---

## Task 10: Rewrite `README.md`

**Files:**
- Modify: `README.md` (full rewrite)

- [ ] **Step 1: Replace `README.md` contents**

```markdown
# dumpr

Type a brain dump → Claude parses it into Notion rows → review/edit → write.

![dumpr screenshot](docs/screenshot.png)

Built on the Claude Agent SDK. Uses your Claude Code OAuth, so there's no API
bill — inference runs on your Max subscription.

## Why

<!-- TODO(ady): write 3-5 sentences in your own voice. The personal-problem
hook from the X-post: capturing P1/P2/P3 brain dumps fast, the metadata
typing is the bottleneck, dumpr removes it. -->

## Setup

### 1. Notion database

Create a database with these 7 properties — exact names, case-sensitive:

| Property         | Type     | Options                                                  |
|------------------|----------|----------------------------------------------------------|
| `Title`          | Title    | —                                                        |
| `Type`           | Select   | `Task`, `Project`                                        |
| `Domain`         | Select   | (you choose — see step 3)                                |
| `Priority Level` | Select   | `P1 – Critical`, `P2 – Important`, `P3 – Normal`, `P4 – Low` ⚠ |
| `Effort`         | Select   | `Low`, `Medium`, `High`                                  |
| `Status`         | Select   | `Backlog`, `Planned`, `In Progress`, `Blocked`, `Done`, `Dropped` |
| `Due Date`       | Date     | —                                                        |

⚠ **Priority values use an em-dash (`–`), not a hyphen (`-`).** Copy-paste
the exact strings from the table above. Notion select options match exactly,
so a hyphen will silently fail with a write error like
`Domain "P1 - Critical" is not a valid option`.

### 2. Notion integration

1. Create an internal integration at <https://www.notion.so/profile/integrations>
   with capability **Insert content**.
2. Open your database → **…** menu → **Connections** → grant your integration
   access.
3. Copy the integration token (`secret_…`).
4. Find your **data source ID** (this is what the v5 SDK writes to — *not*
   the database ID). Open the database as a full page, then **…** menu →
   **Copy link to data source**, and pull the UUID from the copied URL.

### 3. Customize your domains (the personal axis)

Domains are the life-buckets that mean something to **you**. The repo ships
with the author's 16 domains (`Heave`, `GDG Projects`, `Coursework`, …) as
a working example — they will not match your life. Edit three places:

1. **`lib/types.ts`** — `DOMAIN_VALUES` array (the canonical list).
2. **`lib/notion.ts`** — `DOMAIN_ICONS` map (one emoji per domain;
   sets the per-page icon in Notion).
3. **`skills/SKILL.md`** — the "Domain inference" section near the bottom.
   This is what the AI uses to decide which domain a dump line belongs to.
   The most important of the three.

For each domain you set, also add it as a select option on the `Domain`
property in your Notion database, otherwise writes will fail.

### 4. Environment

Copy `.env.local.example` → `.env.local` and fill in your values:

```
NOTION_TOKEN=secret_<your token>
NOTION_DATA_SOURCE_ID=<your data source UUID>
```

### 5. Claude Code OAuth

This app uses your Claude Code OAuth — there's no `ANTHROPIC_API_KEY`,
inference runs on your Max subscription. If you don't already use Claude
Code:

```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

This creates `~/.claude/config`, which the agent SDK reads automatically.

### 6. Run

```bash
npm install
npm run build
npm run start
```

Open <http://localhost:3000> and bookmark it. For development:
`npm run dev`.

## How it works

`lib/skill.ts` reads `skills/SKILL.md`, appends a JSON-output override, and
sends both as a system prompt to Claude via `@anthropic-ai/claude-agent-sdk`.
The model returns a JSON array of typed items. Zod validates the shape, the
UI shows a preview table for inline editing, and on confirm the rows are
written to Notion sequentially via `@notionhq/client`. See
`docs/superpowers/specs/2026-05-04-brain-dump-gui-design.md` for the full
design.

## Tests

```bash
npm test
```

33 tests covering SKILL.md prompt assembly, Item → Notion property mapping,
batch writes with stop-on-first-failure, agent-SDK orchestration with JSON
validation, and both API routes. All tests mock the agent SDK and Notion
client — no live services touched.

## License

MIT. See `LICENSE`.
```

- [ ] **Step 2: Verify the screenshot link resolves**

Run: `ls -la docs/screenshot.png`
Expected: file exists (created in Task 9).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: forker-facing README with schema doc + 3-place customization steps"
```

---

## Task 11: Rename package in `package.json`

**Files:**
- Modify: `package.json:2`

- [ ] **Step 1: Change name field**

Current:
```json
"name": "foundation",
```

New:
```json
"name": "dumpr",
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: rename package foundation -> dumpr"
```

---

## Task 12: Rename GitHub repo and update local remote (manual, Ady)

**Files:**
- Modify: `.git/config` (remote URL)

- [ ] **Step 1: Rename via gh CLI**

Run: `gh repo rename dumpr --repo apollo-ullah/notion-ops`
Expected: prompts for confirmation, then renames. GitHub will auto-redirect
the old URL.

(Alternative: do it via GitHub web UI → repo Settings → top of page.)

- [ ] **Step 2: Update local remote URL**

```bash
git remote set-url origin https://github.com/apollo-ullah/dumpr.git
```

- [ ] **Step 3: Verify remote**

Run: `git remote -v`
Expected: both fetch and push show `https://github.com/apollo-ullah/dumpr.git`.

- [ ] **Step 4: Push everything**

Run: `git push origin main`
Expected: pushes all commits from Tasks 1–11.

---

## Task 13: Update GitHub repo description and topics

- [ ] **Step 1: Set description and homepage via gh CLI**

```bash
gh repo edit apollo-ullah/dumpr \
  --description "Brain-dump GUI for Notion. Type a dump, AI parses it into rows, review/edit, click write. Local Next.js app, runs on Claude Code OAuth (no API bill)."
```

- [ ] **Step 2: Add topics**

```bash
gh repo edit apollo-ullah/dumpr \
  --add-topic notion \
  --add-topic nextjs \
  --add-topic claude \
  --add-topic ai \
  --add-topic productivity \
  --add-topic claude-code \
  --add-topic agent-sdk
```

- [ ] **Step 3: Verify on github.com**

Visit <https://github.com/apollo-ullah/dumpr>. Expected: new name, description, and topics all show.

---

## Task 14: Validation pass — clone fresh, walk the README

This is the only way to know "ship-ready" actually means ship-ready.

- [ ] **Step 1: Clone the renamed repo into a scratch directory**

```bash
cd /tmp
git clone https://github.com/apollo-ullah/dumpr.git dumpr-fresh-test
cd dumpr-fresh-test
```

- [ ] **Step 2: Walk the README setup as a stranger would**

- Read README §1 — does the schema table make sense? Try creating a fresh
  Notion database following only the table.
- Read README §2 — find the integration page, create one, grant access,
  grab the data source ID.
- Read README §3 — confirm DOMAIN_VALUES, DOMAIN_ICONS, and the SKILL.md
  Domain section are easy to find and edit.
- Read README §4 — copy `.env.local.example` and fill in.
- Read README §5 — verify Claude Code is installed.
- Read README §6 — run install + build + start.

- [ ] **Step 3: Functional smoke test**

Open http://localhost:3000. Paste a 2-3 line dump. Click "Process".
Verify a preview table appears. Click "Write to Notion". Verify rows land
in your fresh Notion DB with correct properties + page icons.

- [ ] **Step 4: Note any gotchas the README missed**

If anything required a step the README didn't mention, go back to the
canonical repo and update README + commit + push before posting.

- [ ] **Step 5: Clean up scratch clone**

```bash
cd ..
rm -rf dumpr-fresh-test
```

- [ ] **Step 6: Mark launch ready**

The repo is now ready for Ady to write and post the X post. The post itself
is intentionally not in this plan — Ady writes it in his own voice using
the Q8-A angle (problem-first / personal).

---

## Self-Review Checklist

- [x] **Spec coverage:** Every line in the spec's "Build sequence" maps to a task above (Tasks 1-14 = spec steps 1-13 plus screenshot capture).
- [x] **Placeholders:** No "TBD" or "implement later". The README "Why" section has an explicit `<!-- TODO(ady) -->` marker that the spec called out as a deliberate user-supplied section.
- [x] **Type/path consistency:** `skills/SKILL.md` (Tasks 3, 4, 5, 7, 10) and `lib/skill.ts` (Task 4) match. CLAUDE.md (Task 7) matches the path used in lib/skill.ts (Task 4).
- [x] **Each task is self-contained:** Code blocks include all needed context. Engineer reading Task N out of order doesn't need Task N-1.
- [x] **Risks from spec are addressed:** Symlink direction explicit (Task 5), em-dash gotcha visually loud (Task 10), tests run after skill move (Task 4 step 4), PNG quality verification step (Task 2 step 3).
