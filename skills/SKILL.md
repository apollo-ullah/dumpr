---
name: ady-operating-system
description: Use when Ady is dumping tasks, todos, or items for triage into his Notion personal OS. Triggers AGGRESSIVELY on any message that opens with "P1" / "P2" / "P3" / "P4" as a line header followed by items, or contains phrases like "capture this", "add to inbox", "dump this", "process this brain dump", "process this", "triage this", "add these tasks", "throw these in". Over-trigger is preferred — false positives are cheap, missed captures are expensive. If unsure whether to trigger, trigger.
---

# Ady's Operating System

Personal task-routing skill. Parses Ady's brain dumps, infers all Notion fields, previews a table, then batch-writes to the Notion inbox database. Approval is only required when at least one inferred cell is low-confidence (flagged `?`); fully-confident batches write through without asking.

## Modes

This skill is architected to support multiple capture/processing modes. **Only one is implemented today** — the others are designed but deferred until the first one is calibrated end-to-end.

| Mode | Status | Purpose |
|---|---|---|
| Structured Capture | implemented | Parse P-level brain dumps into fully-typed Notion rows |
| Quick Capture | future | Single-line drive-by items, minimal inference |
| Project Breakdown | future | Decompose a project into sub-tasks |
| Unstick | future | Review stalled items, propose next moves |
| Weekly Review | future | End-of-week sweep + planning |

If Ady invokes a future mode, reply: *"That mode isn't implemented yet — only Structured Capture is live. Want to capture something instead?"* and stop.

---

## Mode: Structured Capture

### Input format

Lines grouped under P-level headers. Each header applies to every following line until the next header.

```
P1
need to submit notion event proposal by may 7th
P2
need to install my mom's windshield wipers, lets do it friday
P3
need to buy protein powder, lets do saturday after work
P4
need to find new gym shoes for next month
```

### Workflow (strict order)

1. Parse each line into an item carrying its inherited P-level.
2. Infer every required field (see Field Rules below).
3. Render a markdown **table preview** — one row per item, one column per field.
4. Flag uncertain inferences with a trailing `?` in the cell. A `?` = low confidence; no `?` = high confidence.
5. **Confidence gate:**
   - If **any cell in the table carries `?`** → ask exactly: **`Approve and write? (y / edit / cancel)`** and wait. Branch:
     - `y` → write.
     - `edit` → accept overrides, regenerate table, re-evaluate the gate (if all `?` flags are now resolved, write directly; otherwise re-ask).
     - `cancel` → discard, zero writes.
   - If **every cell is confident (no `?` anywhere)** → write directly. Do not ask.
6. Write via `mcp__plugin_Notion_notion__notion-create-pages`, one page per item, all fields set.
7. After write → one-line confirmation: e.g. `Wrote 4 items: 1 P1 Planned, 2 P2/P3 Planned, 1 P4 Backlog.`

**Hard rule:** always show the table preview before writing. Never skip the preview, even on a fully-confident batch — Ady should still see what landed. The approval question itself is only required when at least one `?` is present.

**Confidence calibration:** be honest. If a domain match is ambiguous, an effort cue is missing, a date is implied not stated, or a Why is a guess — flag it `?`. Auto-writing on bad inferences is worse than asking. When in doubt, flag.

### Field rules

#### Title
Light cleanup only. Fix typos. Capitalize proper nouns (`notion → Notion`, `bmw → BMW`, `quran → Quran`, names). **Preserve Ady's voice** — do not rewrite for tone or style.

#### Type
Default `Task`. Use `Project` only when the line clearly describes multi-step work (`build client portal v2`, `ship Heave website redesign`).

#### Domain
Inferred from keyword match (case-insensitive). First match wins; if two domains tie, mark with `?`.

| Keywords | Domain |
|---|---|
| had an idea, had another idea, project idea, side project, build a [thing] app, build an [thing] app, build out [a/this] [thing] app | Personal Project |
| Heave, client portal, Heave website | Heave |
| agency, my agency, agency website, agency portfolio, testimonials, client work | Agency |
| GDG, Build with AI, Uni-Verse | GDG Projects |
| Notion event, Notion proposal, Campus Leader, CL event | Notion CL |
| Arena | Arena |
| comp310, math324, comp251, school, course, exam, lecture | Coursework |
| Mom, Nanu, Dad, Aisha, Ariana | Family |
| gym, protein, creatine, lift, cardio, shoes, workout, sleep, food, nutrition | Health |
| Quran, dua, Umrah, prayer, Ramadan, salah, deen, Allah | Deen |
| BMW, M340i, car, lease, wipers, detail, windshield | Admin |
| RRSP, FHSA, tax, income, invoice, savings, WealthSimple | Money |
| video, blog, post, thread, podcast, newsletter, content | Content |
| client lead, Klaviyo, automation pitch, recruiting, interview | Career |
| learn X, read book, course on Y, study X, neetcode | Growth |
| (default — friends, life admin, anything unmatched) | Personal |

#### Priority Level
From the P-header. **Exact dropdown strings (with em-dashes — `–`, not `-`):**

| Header | Value |
|---|---|
| P1 | `P1 – Critical` |
| P2 | `P2 – Important` |
| P3 | `P3 – Normal` |
| P4 | `P4 – Low` |

#### Effort
| Cue | Effort |
|---|---|
| `buy`, `call`, `email`, `install`, `submit`, `send` | Low |
| `draft`, `write`, `review`, `research`, `plan`, `schedule` | Medium |
| `build`, `ship`, `launch`, `design from scratch`, multi-step | High |
| unclear | Medium with `?` |

#### Due Date
Resolve to **absolute ISO (`YYYY-MM-DD`)** using today's date. Never write fuzzy strings.

| Cue | Resolution |
|---|---|
| `by [date]` / `due [date]` | exact date |
| weekday name (`friday`, `saturday`) | next occurrence from today |
| `this week` / `this weekend` | upcoming Sunday |
| `next week` | today + 7 |
| `next month` | first day of next month → also flips Status to `Backlog` |
| `tomorrow` | today + 1 |
| `asap` / `right away` | today + 1 (same as `tomorrow`) |
| `eventually` / `someday` / `when I have time` | no Due Date, Status = `Backlog` |
| (no date cue) | derive from priority: P1 → today + 1, P2 → today + 7, P3 → today + 14, P4 → today + 30. **Always flag as low confidence** (`flags.dueDate = true` in JSON, trailing `?` in markdown). |

#### Next Action
**Always leave blank.** Do not infer, do not write the property. If a task is well-scoped, the title itself is the action — a separate Next Action field is redundant. If a task is too vague to act on without a Next Action, it's too vague to capture; let Ady refine it himself.

#### Why (1%)
**Always leave blank.** Do not infer, do not write the property. The "why" is intrinsic to Ady — inferring it adds friction and bloats the row. If a meaningful Why exists, Ady will fill it in himself.

#### Status

| Condition | Status |
|---|---|
| P1 / P2 / P3 with concrete date | `Planned` |
| P1 / P2 / P3 without date | `Planned` (urgency implies near-term) |
| P4 with vague date (`next month`, `eventually`) | `Backlog` |
| Any `eventually` / `someday` / `when I have time` | `Backlog` |

**Never `Inbox` for structured captures.** Inbox is reserved for the future Quick Capture mode.

### Table preview format

Header line first: `Today: YYYY-MM-DD` (so date resolution is auditable).

Then a markdown table with columns:

`# | Title | Type | Domain | Priority | Effort | Due | Status`

One row per parsed item. Trailing `?` on any inferred cell that's a guess. **Next Action and Why (1%) are not columns** — both are always left blank in Notion.

### Notion write

- Tool: `mcp__plugin_Notion_notion__notion-create-pages`
- One page per item.
- All inferred fields as properties.
- Exact dropdown strings only — no improvising.
- If a write fails, stop the batch, report which item failed, do not retry blindly.

### Hard rules

- Show the table **before** writing. Always.
- If any cell carries `?`, never write without explicit `y` on the latest preview.
- If no cell carries `?`, write directly — don't ask.
- Exact dropdown strings only.
- Preserve voice in titles — typos and proper-noun caps only.
- All dates → absolute ISO before write.

---

## Out of scope (for now)

- Cleanup or migration of existing Notion rows.
- Any mode other than Structured Capture.
- Writing without showing the preview table first.

When Structured Capture is calibrated and trusted, the next mode gets built. Not before.
