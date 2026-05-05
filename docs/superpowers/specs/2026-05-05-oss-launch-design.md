# dumpr — OSS launch design

**Date:** 2026-05-05
**Owner:** Adyan Ullah
**Status:** Approved (brainstorming complete; pending writing-plans)
**Effort:** ~half day

## Goal

Ship the existing local Next.js brain-dump GUI to GitHub as an MIT-licensed
open-source project, rename it to `dumpr`, and make the repo presentable
enough to support an X-post launch (lean-A signal). Forkers should be able
to clone, set up their own Notion DB, and run the app following the README,
without us pre-building Notion templates or domain-config systems.

## Non-goals (deliberately out of scope)

- No duplicatable Notion template — schema doc in README is the setup path.
- No domain-config file / JSON-based taxonomy — keeping personal taxonomy
  in code as the live example, with documented edit points.
- No setup CLI / scaffolding script.
- No demo GIF or video — one static screenshot.
- No hosted version, Vercel deploy, or multi-tenant model. Local-only
  remains a feature.
- No automated `pngquant`/build-step image optimization — one-time manual
  compression of `app/icon.png` and `public/logo.png`.

## Decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Launch outcome | C — lean-A signal, polish what's visible, don't engineer customization away |
| Q2 | Public framing | B — neutral framing, Ady's taxonomy as the live example |
| Q3 | SKILL.md location | A — single source of truth in `skills/SKILL.md` (Ady symlinks home-dir to it) |
| Q4 | Notion DB setup path | Plain schema doc in README; forkers create their own DB |
| Q5 | Demo asset | B — one static screenshot |
| Q6 | Name | `dumpr` (rename `notion-ops` → `dumpr`) |
| Q7 | License | MIT |
| Q8 | X-post angle | A — problem-first / personal (post text drafted by Ady, not in this spec) |

## Pre-launch cleanup

Before any rename or OSS-prep work, land the existing uncommitted changes
as a single coherent commit so the launch starts from a clean tree:

- `app/api/stats/route.ts`, `components/DashboardStrip.tsx`,
  `lib/notion.ts` (`fetchStats`), `lib/types.ts`, `app/page.tsx`,
  `components/EditableCell.tsx`, `app/icon.png`, `public/logo.png`,
  removal of `app/favicon.ico`, `CLAUDE.md` doc updates.

Then compress the two PNGs in place with `pngquant` (target ~50 KB each,
visual quality preserved):

- `app/icon.png` (favicon, loaded on every request)
- `public/logo.png` (used in header)

Both files are currently 568 KB and identical.

## Identity & rename

- GitHub: rename repo `apollo-ullah/notion-ops` → `apollo-ullah/dumpr`
  via repo settings. GitHub auto-redirects the old URL.
- Update local git remote to the new URL.
- `package.json`: `"name": "foundation"` → `"name": "dumpr"`.
- README h1: `# dumpr — brain-dump GUI for Notion, powered by Claude Code`.
- GitHub repo description: "Brain-dump GUI for Notion. Type a dump, AI parses
  it into rows, review/edit, click write. Local Next.js app, runs on
  Claude Code OAuth (no API bill)."
- GitHub topics: `notion`, `nextjs`, `claude`, `ai`, `productivity`,
  `claude-code`, `agent-sdk`.

## Code surface changes

### Skill relocation

Move the skill from `~/.claude/skills/ady-operating-system/SKILL.md` into
the repo at `skills/SKILL.md`. Verbatim copy — content stays as Ady's live
taxonomy (per Q2-B).

Rewrite `lib/skill.ts`:

- Replace `homedir()`-based `SKILL_PATH` with a path resolved relative to
  the repo. Use `path.join(process.cwd(), "skills/SKILL.md")` (Next.js
  runs from repo root in dev and prod).
- Update the error message: "Could not read SKILL.md at `<path>`. The
  file should exist at `skills/SKILL.md` in the repo. If you've edited
  it, check for a typo in the path."

Update tests in `tests/skill.test.ts` (and any others referencing the
home-dir path) to mock the new path.

### Ady's local migration (one-time, post-merge)

After the change lands, Ady runs once on his machine:

```bash
rm ~/.claude/skills/ady-operating-system/SKILL.md
ln -s /absolute/path/to/dumpr/skills/SKILL.md \
      ~/.claude/skills/ady-operating-system/SKILL.md
```

This keeps his terminal Claude Code skill working, with the repo as the
single source of truth. Document this step in the spec but **not** in
the public README (forkers don't need it).

### Personal-data scrub

- `.env.local.example`:
  ```
  NOTION_TOKEN=secret_paste_your_internal_integration_token
  NOTION_DATA_SOURCE_ID=paste_your_data_source_id
  ```
- README: remove the link to Ady's personal Inbox URL; replace with
  generic "your Inbox database".
- `CLAUDE.md`: update the line that says SKILL.md lives at
  `~/.claude/skills/ady-operating-system/SKILL.md` — it now lives at
  `skills/SKILL.md` in the repo.

## Files to add at repo root

- `LICENSE` — MIT, `Copyright (c) 2026 Adyan Ullah`. Use the standard
  template from <https://choosealicense.com/licenses/mit/>.
- `docs/screenshot.png` — one screenshot of the app mid-preview-edit
  (the visual peak of the UI). Embedded at the top of the README.

## README rewrite

Full rewrite to the structure below. Old README is currently 57 lines and
written for Ady; new one is forker-facing.

```
# dumpr

Type a brain dump → Claude parses it into Notion rows → review/edit → write.

![screenshot](docs/screenshot.png)

Built on the Claude Agent SDK. Uses your Claude Code OAuth, so there's no
API bill — inference runs on your Max subscription.

## Why
[3-5 sentences: the personal-problem hook. Ady writes this himself in his
own voice — leave a `<!-- TODO: Ady's hook -->` placeholder until he does.]

## Setup

### 1. Notion database
Create a database with these 7 properties (exact names — case-sensitive):

| Property         | Type     | Options                                                |
|------------------|----------|--------------------------------------------------------|
| Title            | title    | —                                                      |
| Type             | select   | Task, Project                                          |
| Domain           | select   | (you choose — see step 3)                              |
| Priority Level   | select   | P1 – Critical, P2 – Important, P3 – Normal, P4 – Low ⚠ |
| Effort           | select   | Low, Medium, High                                      |
| Status           | select   | Backlog, Planned, In Progress, Blocked, Done, Dropped  |
| Due Date         | date     | —                                                      |

⚠ **Priority values use an em-dash (`–`), not a hyphen (`-`).** Copy-paste
the exact strings — Notion select options match exactly. If your write
fails with `Domain "X" is not a valid option`, the option name doesn't
match exactly.

### 2. Notion integration
1. Create an internal integration at <https://www.notion.so/profile/integrations>
   with capability "Insert content".
2. Open your database → **…** menu → **Connections** → grant your integration
   access.
3. Copy the integration token.
4. Find your **data source ID** (not database ID — the v5 SDK writes to data
   sources). Open the database → **…** menu → **Copy link to data source**
   and pull the UUID from the URL.

### 3. Customize your domains
Domains are the personal axis — the life-buckets that mean something to
**you**. The repo ships with the author's 16 domains as a working example
(`Heave`, `GDG Projects`, `Coursework`, `Family`, …). Edit three places
to match your life:

1. **`lib/types.ts`** — `DOMAIN_VALUES` array.
2. **`lib/notion.ts`** — `DOMAIN_ICONS` map (one emoji per domain).
3. **`skills/SKILL.md`** — the "Domain inference" section, where the AI
   learns how to map your dump phrases to your domains. Most important
   of the three.

Make sure each domain you set is also added as a select option on the
`Domain` property in Notion.

### 4. Environment
Copy `.env.local.example` → `.env.local`:
```
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=your-uuid
```

### 5. Claude Code OAuth
This app uses your Claude Code OAuth (`~/.claude/config`) — no
`ANTHROPIC_API_KEY`, inference runs on your Max subscription. If you
haven't set up Claude Code:

```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

### 6. Run
```bash
npm install
npm run build
npm run start
```

Open <http://localhost:3000> and bookmark it.

## How it works
[3-4 sentences: skill prompt → Claude Agent SDK → JSON → Zod-validated
preview → Notion write. Link to docs/superpowers/specs/ for the original
design spec.]

## Tests
```bash
npm test
```
33 tests — mocked agent SDK and Notion client, no live services.

## License
MIT. See `LICENSE`.
```

## Validation step (Nyquist)

Before posting, verify the OSS path actually works end-to-end:

1. Clone the renamed repo into a fresh directory (not the worktree).
2. Walk through the README setup steps as if you were a stranger.
3. Build a fresh Notion DB with the 7 properties.
4. Run the app, dump 3-5 lines, review and write.
5. Confirm rows land correctly.

If any step blocks, fix it in the README *before* the X post. This is
the only way to know "ship-ready" actually means ship-ready.

## Risks / edge cases

- **Test breakage from skill path change.** `tests/skill.test.ts` mocks
  `readFileSync`. New path means mock setup updates. Likely 5-min fix.
- **Symlink direction matters.** Ady's symlink is *home → repo*, not
  repo → home. Reversed direction breaks the moment the repo is moved.
- **Forkers without Claude Code installed** will hit a confusing OAuth
  error. README setup §5 spells out the install step explicitly.
- **Em-dash mistakes** are the most likely source of write failures. The
  README warning + the schema table need to be visually loud.
- **PNG compression risk.** `pngquant -Q` defaults can be lossy. Inspect
  output side-by-side against the original before committing.

## Build sequence

1. Commit existing uncommitted dashboard/logo work.
2. Compress PNGs.
3. Move `SKILL.md` into repo, update `lib/skill.ts`, update tests, run
   `npm test` to confirm green.
4. Update Ady's local symlink (one command).
5. Scrub personal data from `.env.local.example`, `README.md`, `CLAUDE.md`.
6. Add `LICENSE`.
7. Capture screenshot to `docs/screenshot.png`.
8. Rewrite README per the structure above (Ady fills in "Why" section).
9. Rename package in `package.json`.
10. Rename GitHub repo `notion-ops` → `dumpr`, update local remote, push.
11. Update GitHub repo description and topics.
12. Run the validation step (clone fresh, walk the README).
13. Ady writes and posts the X post.
