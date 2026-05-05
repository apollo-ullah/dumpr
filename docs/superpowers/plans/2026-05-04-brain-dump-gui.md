# Brain-Dump GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local Next.js web app at `localhost:3000` that wraps the existing `ady-operating-system` Claude Code skill — typing a P-level brain dump produces an inline-editable preview table that writes to the Notion Inbox database on confirmation.

**Architecture:** Single Next.js app (App Router). Backend has two API routes: `/api/process` (calls Claude via Agent SDK with SKILL.md as system prompt, returns JSON Items) and `/api/write` (writes Items to Notion via `@notionhq/client`). Frontend is one screen with three phases (input → preview → done) and inline-editable cells for low-confidence inferences. Notion-warm visual direction. SKILL.md is read unmodified — it's the rules document, not a runtime skill.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, React 18, `@notionhq/client`, `@anthropic-ai/claude-agent-sdk` (OAuth via Claude Code Max), `zod`, `@radix-ui/react-select`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-05-04-brain-dump-gui-design.md` — single source of truth for design decisions.

---

## File structure (responsibility map)

```
notion-ops/
├── app/
│   ├── layout.tsx                          # Root layout (foundation)
│   ├── globals.css                         # Notion-warm Tailwind tokens (foundation)
│   ├── page.tsx                            # Single-screen orchestrator (Phase 3)
│   └── api/
│       ├── process/route.ts                # POST /api/process (Phase 3)
│       └── write/route.ts                  # POST /api/write (Phase 3)
├── components/
│   ├── DumpForm.tsx                        # Textarea + Process button (Worktree 4)
│   ├── PreviewTable.tsx                    # Items table + Today header (Worktree 5)
│   ├── EditableCell.tsx                    # Click-to-edit cell wrapper (Worktree 5)
│   ├── WriteBar.tsx                        # Sticky write/discard bar (Worktree 4)
│   └── PartialFailureCallout.tsx           # Red callout for partial Notion failures (Worktree 4)
├── lib/
│   ├── types.ts                            # Item, WriteFailure, Zod schemas (foundation)
│   ├── env.ts                              # Validated env vars (foundation)
│   ├── skill.ts                            # SKILL.md reader + system prompt builder (Worktree 1)
│   ├── notion.ts                           # Item → property mapper + writeItems (Worktree 2)
│   └── agent.ts                            # Agent SDK wrapper + processDump (Worktree 3)
├── tests/
│   ├── skill.test.ts                       # Worktree 1
│   ├── notion.test.ts                      # Worktree 2
│   ├── agent.test.ts                       # Worktree 3
│   ├── api.process.test.ts                 # Phase 3
│   └── api.write.test.ts                   # Phase 3
├── .env.local                              # NOTION_TOKEN, NOTION_DATA_SOURCE_ID (foundation)
├── package.json                            # All deps installed in foundation
├── tsconfig.json                           # (from create-next-app)
├── tailwind.config.ts                      # Notion-warm colors (foundation)
├── postcss.config.mjs                      # (from create-next-app)
├── next.config.mjs                         # (from create-next-app)
├── vitest.config.ts                        # (foundation)
└── README.md                               # How to run + bookmark setup (Phase 4)
```

**Why this split:** Each lib module has one responsibility. UI components are split into "leaves with no internal state coupling" (DumpForm, WriteBar, PartialFailureCallout — Worktree 4) and "the editable table cluster" (EditableCell + PreviewTable — Worktree 5). Worktrees never touch each other's files; foundation provides stubs so imports always resolve.

---

## Execution strategy (worktree topology)

**Phase 0 — Foundation (single worktree, sequential).** Scaffold the project, install all dependencies (so no parallel worktree needs to touch `package.json`), define types, write env validator, create stubs for every lib + component file (so imports resolve in parallel branches). Merge to `main`.

**Phase 1 — Parallel implementation (5 worktrees branched from foundation `main`).** Each worktree owns a non-overlapping set of files. Run all 5 simultaneously via `subagent-driven-development`:

| Worktree | Branch name | Owns |
|---|---|---|
| W1 | `lib-skill` | `lib/skill.ts`, `tests/skill.test.ts` |
| W2 | `lib-notion` | `lib/notion.ts`, `tests/notion.test.ts` |
| W3 | `lib-agent` | `lib/agent.ts`, `tests/agent.test.ts` |
| W4 | `ui-leaves` | `components/DumpForm.tsx`, `components/WriteBar.tsx`, `components/PartialFailureCallout.tsx` |
| W5 | `ui-table` | `components/EditableCell.tsx`, `components/PreviewTable.tsx` |

After all 5 merge cleanly to `main`, proceed.

**Phase 2 — Integration (single worktree, sequential).** Wire API routes, compose `app/page.tsx`, hook everything to the actual lib modules.

**Phase 3 — Manual E2E + polish.** Run real dump against real Notion, README, bookmark.

---

# Phase 0 — Foundation (sequential, one worktree)

**Branch:** `foundation` off `main`. Merge to `main` when complete. All later worktrees branch from `main` after this merges.

### Task 0.1: Scaffold Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next-env.d.ts`

- [ ] **Step 1: Run create-next-app non-interactively in current directory**

Run from project root:
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --no-eslint \
  --import-alias "@/*" \
  --use-npm \
  --yes
```

Expected: scaffold completes, `package.json` + `app/` + `tsconfig.json` exist.

- [ ] **Step 2: Verify scaffold runs**

Run:
```bash
npm run dev -- --port 3000 &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "scaffold: next.js + typescript + tailwind"
```

---

### Task 0.2: Install runtime + dev dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Pin Tailwind to v3** (the plan's `tailwind.config.ts` shape assumes v3; create-next-app may have installed v4)

```bash
npm uninstall tailwindcss @tailwindcss/postcss
npm install --save-dev tailwindcss@^3 postcss autoprefixer
```

If `postcss.config.mjs` was generated for v4 (uses `@tailwindcss/postcss`), overwrite it for v3:

```bash
cat > postcss.config.mjs <<'EOF'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
EOF
```

- [ ] **Step 2: Install runtime deps**

```bash
npm install @notionhq/client @anthropic-ai/claude-agent-sdk zod @radix-ui/react-select
```

- [ ] **Step 3: Install dev deps**

```bash
npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 4: Verify installs landed**

```bash
node -e "console.log(Object.keys(require('./package.json').dependencies).sort())"
```

Expected output (order may differ):
```
['@anthropic-ai/claude-agent-sdk', '@notionhq/client', '@radix-ui/react-select', 'next', 'react', 'react-dom', 'zod']
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs
git commit -m "deps: pin tailwind v3, add notion, agent sdk, zod, radix select, vitest"
```

---

### Task 0.3: Configure Tailwind with Notion-warm tokens

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts`**

Write to `tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: "#fbf9f4",
          surface: "#ffffff",
          fg: "#37352f",
          muted: "#9b9889",
          border: "#ece8df",
          chip: "#f1ede4",
          sage: "#7d9b76",
          amber: "#c98a55",
        },
      },
      fontFamily: {
        serif: ["Charter", "Georgia", "serif"],
        sans: ["ui-sans-serif", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        warm: "0 1px 2px rgba(15, 15, 15, 0.04)",
      },
      borderRadius: {
        warm: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Replace `app/globals.css`**

Write to `app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #fbf9f4;
  color: #37352f;
  -webkit-font-smoothing: antialiased;
  font-family: ui-sans-serif, "Inter", system-ui, sans-serif;
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "style: notion-warm tailwind tokens"
```

---

### Task 0.4: Define types in `lib/types.ts`

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create the file**

Write to `lib/types.ts`:
```ts
import { z } from "zod";

export const DOMAIN_VALUES = [
  "Personal Project",
  "Heave",
  "Agency",
  "GDG Projects",
  "Notion CL",
  "Arena",
  "Coursework",
  "Family",
  "Health",
  "Deen",
  "Admin",
  "Money",
  "Content",
  "Career",
  "Growth",
  "Personal",
] as const;

export const PRIORITY_VALUES = [
  "P1 – Critical",
  "P2 – Important",
  "P3 – Normal",
  "P4 – Low",
] as const;

export const TYPE_VALUES = ["Task", "Project"] as const;
export const EFFORT_VALUES = ["Low", "Medium", "High"] as const;
export const STATUS_VALUES = ["Planned", "Backlog"] as const;

export const ItemFlagsSchema = z
  .object({
    title: z.literal(true).optional(),
    type: z.literal(true).optional(),
    domain: z.literal(true).optional(),
    priority: z.literal(true).optional(),
    effort: z.literal(true).optional(),
    dueDate: z.literal(true).optional(),
    status: z.literal(true).optional(),
  })
  .strict();

export const ItemSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(TYPE_VALUES),
    domain: z.enum(DOMAIN_VALUES),
    priority: z.enum(PRIORITY_VALUES),
    effort: z.enum(EFFORT_VALUES),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    status: z.enum(STATUS_VALUES),
    flags: ItemFlagsSchema.default({}),
  })
  .strict();

export const ItemsResponseSchema = z
  .object({
    items: z.array(ItemSchema),
  })
  .strict();

export type Item = z.infer<typeof ItemSchema> & { id: string };
export type ItemFlags = z.infer<typeof ItemFlagsSchema>;

export type WriteFailure = {
  index: number;
  item: Item;
  error: string;
};

export type WriteResult = {
  written: number;
  failures: WriteFailure[];
};
```

Note: `Item.id` is added client-side (not part of the JSON contract from Claude). Server-side code that builds `Item[]` from Claude's response should generate uuids before returning to the client.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: Item, flags, write result + zod schemas"
```

---

### Task 0.5: Create env validator in `lib/env.ts`

**Files:**
- Create: `lib/env.ts`
- Create: `.env.local.example`
- Modify: `.gitignore` (verify `.env.local` is present — already added in spec phase)

- [ ] **Step 1: Create `lib/env.ts`**

Write to `lib/env.ts`:
```ts
import { z } from "zod";

const EnvSchema = z.object({
  NOTION_TOKEN: z.string().min(1, "NOTION_TOKEN is required"),
  NOTION_DATA_SOURCE_ID: z.string().min(1, "NOTION_DATA_SOURCE_ID is required"),
});

export const env = EnvSchema.parse({
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
});
```

This module crashes the server boot at import time if either env var is missing — matches spec's "Server refuses to start" rule.

- [ ] **Step 2: Create `.env.local.example`**

Write to `.env.local.example`:
```
NOTION_TOKEN=secret_xxx_paste_internal_integration_token_here
NOTION_DATA_SOURCE_ID=2d13ad1b-1fe7-8071-92a4-000bcd80335b
```

- [ ] **Step 3: Confirm `.env.local` is gitignored**

```bash
grep -E "^\.env" .gitignore
```

Expected: `.env` and `.env.local` lines present.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts .env.local.example
git commit -m "config: env validator + .env.local.example"
```

---

### Task 0.6: Configure vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

Write to `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: Add test scripts to `package.json`**

Run:
```bash
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
```

- [ ] **Step 3: Verify**

```bash
npm test 2>&1 | head -5
```

Expected: vitest runs and reports no test files found (or "No test files found"). Not an error.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "test: vitest config + scripts"
```

---

### Task 0.7: Create stubs for parallel worktrees

**Why:** Parallel worktrees must not break imports for each other. Foundation creates every file the integration phase will import, with `throw new Error("not implemented")` bodies. Each parallel worktree replaces its stub with the real implementation.

**Files:**
- Create: `lib/skill.ts`, `lib/notion.ts`, `lib/agent.ts`
- Create: `components/DumpForm.tsx`, `components/PreviewTable.tsx`, `components/EditableCell.tsx`, `components/WriteBar.tsx`, `components/PartialFailureCallout.tsx`

- [ ] **Step 1: Create `lib/skill.ts` stub**

Write to `lib/skill.ts`:
```ts
export function loadSkill(): string {
  throw new Error("lib/skill.ts not implemented (Worktree 1)");
}

export function buildSystemPrompt(_today: string): string {
  throw new Error("lib/skill.ts not implemented (Worktree 1)");
}
```

- [ ] **Step 2: Create `lib/notion.ts` stub**

Write to `lib/notion.ts`:
```ts
import type { Item, WriteResult } from "./types";

export function itemToProperties(_item: Item): Record<string, unknown> {
  throw new Error("lib/notion.ts not implemented (Worktree 2)");
}

export async function writeItems(_items: Item[]): Promise<WriteResult> {
  throw new Error("lib/notion.ts not implemented (Worktree 2)");
}
```

- [ ] **Step 3: Create `lib/agent.ts` stub**

Write to `lib/agent.ts`:
```ts
import type { Item } from "./types";

export type ProcessResult = {
  today: string;
  items: Omit<Item, "id">[];
};

export async function processDump(_dump: string): Promise<ProcessResult> {
  throw new Error("lib/agent.ts not implemented (Worktree 3)");
}
```

- [ ] **Step 4: Create component stubs**

Write to `components/DumpForm.tsx`:
```tsx
type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

export function DumpForm(_props: Props) {
  return null;
}
```

Write to `components/EditableCell.tsx`:
```tsx
import type { Item } from "@/lib/types";

type Props = {
  item: Item;
  field: keyof Omit<Item, "id" | "flags">;
  onChange: (next: Partial<Item>) => void;
};

export function EditableCell(_props: Props) {
  return null;
}
```

Write to `components/PreviewTable.tsx`:
```tsx
import type { Item } from "@/lib/types";

type Props = {
  today: string;
  items: Item[];
  onItemChange: (index: number, next: Partial<Item>) => void;
};

export function PreviewTable(_props: Props) {
  return null;
}
```

Write to `components/WriteBar.tsx`:
```tsx
type Props = {
  count: number;
  onWrite: () => void;
  onDiscard: () => void;
  writing: boolean;
};

export function WriteBar(_props: Props) {
  return null;
}
```

Write to `components/PartialFailureCallout.tsx`:
```tsx
import type { WriteFailure } from "@/lib/types";

type Props = {
  failures: WriteFailure[];
  onRetry: (fromIndex: number) => void;
  onDiscard: () => void;
};

export function PartialFailureCallout(_props: Props) {
  return null;
}
```

- [ ] **Step 5: Verify everything compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/ components/
git commit -m "stubs: lib + component signatures (filled by parallel worktrees)"
```

---

### Task 0.8: Merge foundation to main

- [ ] **Step 1: Push and merge**

```bash
git checkout main
git merge foundation --no-ff -m "merge: foundation phase complete"
```

Foundation done. Phase 1 worktrees can now branch from `main`.

---

# Phase 1 — Parallel implementation (5 worktrees)

All 5 worktrees branch from the same `main` commit (post-foundation). Each is a fresh subagent run. Merge order doesn't matter (no overlapping files).

---

## Worktree 1 — `lib/skill.ts`

**Branch:** `lib-skill` off `main` (post-foundation).
**Owns:** `lib/skill.ts`, `tests/skill.test.ts`

### Task W1.1: Write failing tests

**Files:**
- Create: `tests/skill.test.ts`

- [ ] **Step 1: Write tests**

Write to `tests/skill.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadSkill, buildSystemPrompt } from "@/lib/skill";

describe("loadSkill", () => {
  it("returns SKILL.md content as a non-empty string", () => {
    const skill = loadSkill();
    expect(skill).toBeTypeOf("string");
    expect(skill.length).toBeGreaterThan(100);
  });

  it("includes the structured-capture mode header", () => {
    const skill = loadSkill();
    expect(skill).toMatch(/Structured Capture/);
  });
});

describe("buildSystemPrompt", () => {
  it("includes today's date verbatim", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/2026-05-04/);
  });

  it("includes SKILL.md content", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/Structured Capture/);
  });

  it("appends JSON output instructions after SKILL.md", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    const skillIdx = prompt.indexOf("Structured Capture");
    const jsonIdx = prompt.indexOf("RESPONSE FORMAT OVERRIDE");
    expect(skillIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(skillIdx);
  });

  it("instructs Claude to use flags object instead of trailing ?", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/flags/);
    expect(prompt).toMatch(/instead of/i);
  });

  it("specifies the JSON schema with all enum values", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/Personal Project/);
    expect(prompt).toMatch(/P1 – Critical/);
    expect(prompt).toMatch(/Planned/);
    expect(prompt).toMatch(/Backlog/);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- tests/skill.test.ts
```

Expected: every test fails with `lib/skill.ts not implemented (Worktree 1)` (the stub throws).

---

### Task W1.2: Implement `lib/skill.ts`

**Files:**
- Modify: `lib/skill.ts`

- [ ] **Step 1: Replace the stub with the implementation**

Write to `lib/skill.ts`:
```ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SKILL_PATH = join(homedir(), ".claude/skills/ady-operating-system/SKILL.md");

let cached: string | null = null;

export function loadSkill(): string {
  if (cached !== null) return cached;
  try {
    cached = readFileSync(SKILL_PATH, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read SKILL.md at ${SKILL_PATH}. ` +
        `Ensure the ady-operating-system skill is installed. (${(err as Error).message})`
    );
  }
  return cached;
}

const JSON_INSTRUCTIONS_TEMPLATE = `

---
RESPONSE FORMAT OVERRIDE
---
Today's date: {{TODAY}}

You are being invoked from a web GUI, not a terminal. Override the SKILL.md output format as follows:

1. Do NOT render a markdown table preview.
2. Do NOT ask any approval question ("Approve and write?").
3. Do NOT call any tool. Do NOT attempt to write to Notion.
4. Respond with ONLY a JSON object matching the schema below — no prose, no code fences, no commentary.

Schema:

{
  "items": [
    {
      "title": string,
      "type": "Task" | "Project",
      "domain": "Personal Project" | "Heave" | "Agency" | "GDG Projects" | "Notion CL" | "Arena" | "Coursework" | "Family" | "Health" | "Deen" | "Admin" | "Money" | "Content" | "Career" | "Growth" | "Personal",
      "priority": "P1 – Critical" | "P2 – Important" | "P3 – Normal" | "P4 – Low",
      "effort": "Low" | "Medium" | "High",
      "dueDate": "YYYY-MM-DD" | null,
      "status": "Planned" | "Backlog",
      "flags": { "title"?: true, "type"?: true, "domain"?: true, "priority"?: true, "effort"?: true, "dueDate"?: true, "status"?: true }
    }
  ]
}

Set "flags[field]: true" instead of appending "?" to a cell — same meaning, structured form. Omit a flag entirely if the cell is high-confidence. Always include the "flags" key (use {} if all confident).

Every other rule in SKILL.md still applies — domain inference, priority em-dashes (–, not hyphen), date resolution to ISO from "Today's date" above, Title voice preservation (typos + proper-noun caps only), Next Action and Why (1%) are NOT fields in the JSON (they are deliberately omitted).
`;

export function buildSystemPrompt(today: string): string {
  return loadSkill() + JSON_INSTRUCTIONS_TEMPLATE.replace("{{TODAY}}", today);
}
```

- [ ] **Step 2: Run tests, verify they pass**

```bash
npm test -- tests/skill.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/skill.ts tests/skill.test.ts
git commit -m "feat: lib/skill.ts reads SKILL.md + builds JSON-augmented system prompt"
```

---

## Worktree 2 — `lib/notion.ts`

**Branch:** `lib-notion` off `main` (post-foundation).
**Owns:** `lib/notion.ts`, `tests/notion.test.ts`

### Task W2.1: Write failing tests for `itemToProperties`

**Files:**
- Create: `tests/notion.test.ts`

- [ ] **Step 1: Write tests**

Write to `tests/notion.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { itemToProperties, writeItems } from "@/lib/notion";
import type { Item } from "@/lib/types";

const baseItem: Item = {
  id: "test-1",
  title: "Submit Notion event proposal",
  type: "Task",
  domain: "Notion CL",
  priority: "P1 – Critical",
  effort: "Low",
  dueDate: "2026-05-07",
  status: "Planned",
  flags: {},
};

describe("itemToProperties", () => {
  it("maps Title as a Notion title property", () => {
    const props = itemToProperties(baseItem);
    expect(props.Title).toEqual({
      title: [{ text: { content: "Submit Notion event proposal" } }],
    });
  });

  it("maps Type as a select property", () => {
    expect(itemToProperties({ ...baseItem, type: "Task" }).Type).toEqual({
      select: { name: "Task" },
    });
    expect(itemToProperties({ ...baseItem, type: "Project" }).Type).toEqual({
      select: { name: "Project" },
    });
  });

  it("maps Domain as a select property with exact dropdown name", () => {
    const cases = [
      "Personal Project", "Heave", "Agency", "GDG Projects", "Notion CL",
      "Arena", "Coursework", "Family", "Health", "Deen", "Admin",
      "Money", "Content", "Career", "Growth", "Personal",
    ] as const;
    for (const domain of cases) {
      const props = itemToProperties({ ...baseItem, domain });
      expect(props.Domain).toEqual({ select: { name: domain } });
    }
  });

  it("maps Priority Level using em-dash strings", () => {
    expect(itemToProperties({ ...baseItem, priority: "P1 – Critical" })["Priority Level"])
      .toEqual({ select: { name: "P1 – Critical" } });
    expect(itemToProperties({ ...baseItem, priority: "P4 – Low" })["Priority Level"])
      .toEqual({ select: { name: "P4 – Low" } });
  });

  it("maps Effort as a select property", () => {
    for (const effort of ["Low", "Medium", "High"] as const) {
      expect(itemToProperties({ ...baseItem, effort }).Effort).toEqual({
        select: { name: effort },
      });
    }
  });

  it("maps Status as a select property", () => {
    expect(itemToProperties({ ...baseItem, status: "Planned" }).Status).toEqual({
      select: { name: "Planned" },
    });
    expect(itemToProperties({ ...baseItem, status: "Backlog" }).Status).toEqual({
      select: { name: "Backlog" },
    });
  });

  it("maps Due Date as a date property when set", () => {
    expect(itemToProperties({ ...baseItem, dueDate: "2026-05-07" })["Due Date"])
      .toEqual({ date: { start: "2026-05-07" } });
  });

  it("omits Due Date entirely when dueDate is null", () => {
    const props = itemToProperties({ ...baseItem, dueDate: null });
    expect(props["Due Date"]).toBeUndefined();
  });

  it("never includes Next Action or Why (1%)", () => {
    const props = itemToProperties(baseItem);
    expect(props["Next Action"]).toBeUndefined();
    expect(props["Why (1%)"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify they fail**

```bash
npm test -- tests/notion.test.ts -t "itemToProperties"
```

Expected: every test fails with `lib/notion.ts not implemented (Worktree 2)`.

---

### Task W2.2: Implement `itemToProperties`

**Files:**
- Modify: `lib/notion.ts`

- [ ] **Step 1: Replace the `itemToProperties` stub**

Write to `lib/notion.ts` (overwrite, but `writeItems` will be filled in next task):
```ts
import { Client } from "@notionhq/client";
import type { Item, WriteFailure, WriteResult } from "./types";
import { env } from "./env";

export function itemToProperties(item: Item): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    Title: { title: [{ text: { content: item.title } }] },
    Type: { select: { name: item.type } },
    Domain: { select: { name: item.domain } },
    "Priority Level": { select: { name: item.priority } },
    Effort: { select: { name: item.effort } },
    Status: { select: { name: item.status } },
  };

  if (item.dueDate !== null) {
    properties["Due Date"] = { date: { start: item.dueDate } };
  }

  return properties;
}

let _client: Client | null = null;
function getClient(): Client {
  if (_client === null) {
    _client = new Client({ auth: env.NOTION_TOKEN });
  }
  return _client;
}

export async function writeItems(items: Item[]): Promise<WriteResult> {
  let written = 0;
  const failures: WriteFailure[] = [];
  const client = getClient();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await client.pages.create({
        parent: { data_source_id: env.NOTION_DATA_SOURCE_ID } as never,
        properties: itemToProperties(item) as never,
      });
      written++;
    } catch (err) {
      failures.push({
        index: i,
        item,
        error: (err as Error).message ?? String(err),
      });
      break;
    }
  }

  return { written, failures };
}
```

(The `as never` casts work around the `@notionhq/client` types not yet enumerating `data_source_id` in their parent union — runtime supports it per Notion API version 2026-03-11.)

- [ ] **Step 2: Run `itemToProperties` tests, verify they pass**

```bash
npm test -- tests/notion.test.ts -t "itemToProperties"
```

Expected: all `itemToProperties` tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/notion.ts tests/notion.test.ts
git commit -m "feat: itemToProperties maps Item to Notion property objects"
```

---

### Task W2.3: Write failing tests for `writeItems`

**Files:**
- Modify: `tests/notion.test.ts`

- [ ] **Step 1: Append `writeItems` tests**

Append to `tests/notion.test.ts`:
```ts

vi.mock("@notionhq/client", () => {
  const mockCreate = vi.fn();
  return {
    Client: vi.fn().mockImplementation(() => ({
      pages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

vi.mock("@/lib/env", () => ({
  env: { NOTION_TOKEN: "test_token", NOTION_DATA_SOURCE_ID: "test_ds_id" },
}));

import * as notionMock from "@notionhq/client";
const mockCreate = (notionMock as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;

describe("writeItems", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("writes all items when none fail", async () => {
    mockCreate.mockResolvedValue({});
    const items: Item[] = [
      { ...baseItem, id: "1", title: "one" },
      { ...baseItem, id: "2", title: "two" },
      { ...baseItem, id: "3", title: "three" },
    ];

    const result = await writeItems(items);

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.written).toBe(3);
    expect(result.failures).toEqual([]);
  });

  it("stops on first failure and returns partial result", async () => {
    mockCreate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("select option 'Notion CL' not found"))
      .mockResolvedValueOnce({});

    const items: Item[] = [
      { ...baseItem, id: "1", title: "one" },
      { ...baseItem, id: "2", title: "two" },
      { ...baseItem, id: "3", title: "three" },
    ];

    const result = await writeItems(items);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.written).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toEqual({
      index: 1,
      item: items[1],
      error: "select option 'Notion CL' not found",
    });
  });

  it("returns zero written + first failure if very first item fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("auth"));
    const items: Item[] = [{ ...baseItem, id: "1" }];

    const result = await writeItems(items);

    expect(result.written).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].index).toBe(0);
  });

  it("calls Notion with the correct data_source_id parent", async () => {
    mockCreate.mockResolvedValue({});
    await writeItems([{ ...baseItem, id: "1" }]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { data_source_id: "test_ds_id" },
      })
    );
  });
});
```

- [ ] **Step 2: Run, verify the new tests pass**

```bash
npm test -- tests/notion.test.ts
```

Expected: all tests pass (the implementation in W2.2 already covers writeItems).

- [ ] **Step 3: Commit**

```bash
git add tests/notion.test.ts
git commit -m "test: writeItems happy path + stop-on-first-failure"
```

---

## Worktree 3 — `lib/agent.ts`

**Branch:** `lib-agent` off `main` (post-foundation).
**Owns:** `lib/agent.ts`, `tests/agent.test.ts`

### Task W3.1: Write failing tests

**Files:**
- Create: `tests/agent.test.ts`

- [ ] **Step 1: Write tests**

Write to `tests/agent.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (args: unknown) => queryMock(args),
}));

vi.mock("@/lib/skill", () => ({
  loadSkill: () => "SKILL CONTENT",
  buildSystemPrompt: (today: string) => `SYSTEM_PROMPT today=${today}`,
}));

import { processDump } from "@/lib/agent";

function asyncIterableOf<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of values) yield v;
    },
  };
}

const validJson = JSON.stringify({
  items: [
    {
      title: "Submit proposal",
      type: "Task",
      domain: "Notion CL",
      priority: "P1 – Critical",
      effort: "Low",
      dueDate: "2026-05-07",
      status: "Planned",
      flags: {},
    },
  ],
});

describe("processDump", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns today + items on valid JSON response", async () => {
    queryMock.mockReturnValue(
      asyncIterableOf([
        { type: "result", result: validJson, total_cost_usd: 0 },
      ])
    );

    const result = await processDump("P1\nsubmit proposal");

    expect(result.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Submit proposal");
  });

  it("passes the dump as the user prompt", async () => {
    queryMock.mockReturnValue(
      asyncIterableOf([{ type: "result", result: validJson, total_cost_usd: 0 }])
    );

    await processDump("MY DUMP TEXT");

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "MY DUMP TEXT" })
    );
  });

  it("passes the system prompt built with today's date", async () => {
    queryMock.mockReturnValue(
      asyncIterableOf([{ type: "result", result: validJson, total_cost_usd: 0 }])
    );

    await processDump("dump");

    const callArg = queryMock.mock.calls[0][0];
    expect(callArg.options.systemPrompt).toMatch(/SYSTEM_PROMPT today=\d{4}-\d{2}-\d{2}/);
    expect(callArg.options.allowedTools).toEqual([]);
  });

  it("strips code fences from the response before parsing", async () => {
    const fenced = "```json\n" + validJson + "\n```";
    queryMock.mockReturnValue(
      asyncIterableOf([{ type: "result", result: fenced, total_cost_usd: 0 }])
    );

    const result = await processDump("dump");
    expect(result.items).toHaveLength(1);
  });

  it("throws when the response is not valid JSON", async () => {
    queryMock.mockReturnValue(
      asyncIterableOf([{ type: "result", result: "not json at all", total_cost_usd: 0 }])
    );

    await expect(processDump("dump")).rejects.toThrow(/invalid/i);
  });

  it("throws when the JSON shape fails Zod validation", async () => {
    const bad = JSON.stringify({
      items: [{ title: "x", type: "Task", domain: "BogusDomain" }],
    });
    queryMock.mockReturnValue(
      asyncIterableOf([{ type: "result", result: bad, total_cost_usd: 0 }])
    );

    await expect(processDump("dump")).rejects.toThrow(/invalid/i);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/agent.test.ts
```

Expected: all tests fail with `lib/agent.ts not implemented (Worktree 3)`.

---

### Task W3.2: Implement `lib/agent.ts`

**Files:**
- Modify: `lib/agent.ts`

- [ ] **Step 1: Write the implementation**

Write to `lib/agent.ts`:
```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildSystemPrompt } from "./skill";
import { ItemsResponseSchema } from "./types";
import type { Item } from "./types";

export type ProcessResult = {
  today: string;
  items: Omit<Item, "id">[];
};

function todayInLocalTz(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export async function processDump(dump: string): Promise<ProcessResult> {
  const today = todayInLocalTz();
  const systemPrompt = buildSystemPrompt(today);

  let finalText = "";
  for await (const message of query({
    prompt: dump,
    options: {
      systemPrompt,
      allowedTools: [],
    },
  } as never)) {
    if ((message as { type: string }).type === "result") {
      finalText = (message as { result: string }).result ?? "";
    }
  }

  const cleaned = stripCodeFences(finalText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  const validation = ItemsResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(`Claude response shape invalid: ${validation.error.message}`);
  }

  return { today, items: validation.data.items };
}
```

(The `as never` cast on the `query` options is because the Agent SDK's `Options` type may not yet expose `allowedTools` on every minor version; runtime accepts the empty array to disable all tools.)

- [ ] **Step 2: Run tests, verify pass**

```bash
npm test -- tests/agent.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/agent.ts tests/agent.test.ts
git commit -m "feat: lib/agent.ts wraps Claude Agent SDK with JSON validation"
```

---

## Worktree 4 — UI leaves (DumpForm, WriteBar, PartialFailureCallout)

**Branch:** `ui-leaves` off `main` (post-foundation).
**Owns:** `components/DumpForm.tsx`, `components/WriteBar.tsx`, `components/PartialFailureCallout.tsx`

No automated tests for components (per spec — visual is the test). Manual check after each component.

### Task W4.1: Implement `DumpForm`

**Files:**
- Modify: `components/DumpForm.tsx`

- [ ] **Step 1: Write the component**

Write to `components/DumpForm.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

export function DumpForm({ value, onChange, onSubmit, loading, error }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-warm-fg">
          What's on your mind?
        </h1>
        <p className="mt-1 text-sm text-warm-muted">
          Group items under P1 / P2 / P3 / P4. I'll route them.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-warm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={loading}
        rows={12}
        placeholder={"P1\nneed to submit notion event proposal by may 7th\nP2\n..."}
        className="w-full rounded-warm border border-warm-border bg-warm-surface px-5 py-4 font-mono text-[15px] leading-7 text-warm-fg shadow-warm placeholder:text-warm-muted focus:border-warm-sage focus:outline-none focus:ring-1 focus:ring-warm-sage disabled:opacity-60"
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-warm-muted">
          {canSubmit ? "⌘ ↵ to process" : " "}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-warm-sage px-5 py-2 text-sm font-medium text-white shadow-warm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing…" : "Process"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/DumpForm.tsx
git commit -m "feat: DumpForm — Notion-warm textarea + Process button"
```

---

### Task W4.2: Implement `WriteBar`

**Files:**
- Modify: `components/WriteBar.tsx`

- [ ] **Step 1: Write the component**

Write to `components/WriteBar.tsx`:
```tsx
"use client";

type Props = {
  count: number;
  onWrite: () => void;
  onDiscard: () => void;
  writing: boolean;
};

export function WriteBar({ count, onWrite, onDiscard, writing }: Props) {
  return (
    <div className="sticky bottom-0 mt-6 border-t border-warm-border bg-warm-bg/90 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={writing}
          className="rounded-md border border-warm-border bg-transparent px-4 py-2 text-sm text-warm-fg/70 transition hover:bg-warm-chip disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onWrite}
          disabled={writing}
          className="rounded-md bg-warm-sage px-5 py-2 text-sm font-medium text-white shadow-warm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {writing ? "Writing…" : `Write ${count} to Inbox`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile + commit**

```bash
npx tsc --noEmit
git add components/WriteBar.tsx
git commit -m "feat: WriteBar — sticky write/discard actions"
```

---

### Task W4.3: Implement `PartialFailureCallout`

**Files:**
- Modify: `components/PartialFailureCallout.tsx`

- [ ] **Step 1: Write the component**

Write to `components/PartialFailureCallout.tsx`:
```tsx
"use client";

import type { WriteFailure } from "@/lib/types";

type Props = {
  failures: WriteFailure[];
  onRetry: (fromIndex: number) => void;
  onDiscard: () => void;
};

export function PartialFailureCallout({ failures, onRetry, onDiscard }: Props) {
  if (failures.length === 0) return null;
  const first = failures[0];

  return (
    <div className="mt-4 rounded-warm border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <div className="font-medium">
        Item {first.index + 1} failed: {first.item.title}
      </div>
      <div className="mt-1 font-mono text-xs text-red-700">
        {first.error}
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => onRetry(first.index)}
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          Retry from #{first.index + 1}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-red-300 bg-transparent px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-100"
        >
          Discard remaining
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile + commit**

```bash
npx tsc --noEmit
git add components/PartialFailureCallout.tsx
git commit -m "feat: PartialFailureCallout — surface Notion write failures"
```

---

## Worktree 5 — Editable table (EditableCell + PreviewTable)

**Branch:** `ui-table` off `main` (post-foundation).
**Owns:** `components/EditableCell.tsx`, `components/PreviewTable.tsx`

### Task W5.1: Implement `EditableCell`

**Files:**
- Modify: `components/EditableCell.tsx`

- [ ] **Step 1: Write the component**

Write to `components/EditableCell.tsx`:
```tsx
"use client";

import * as Select from "@radix-ui/react-select";
import { useState } from "react";
import type { Item, ItemFlags } from "@/lib/types";
import {
  DOMAIN_VALUES,
  EFFORT_VALUES,
  PRIORITY_VALUES,
  STATUS_VALUES,
  TYPE_VALUES,
} from "@/lib/types";

type EditableField = "title" | "type" | "domain" | "priority" | "effort" | "dueDate" | "status";

type Props = {
  item: Item;
  field: EditableField;
  onChange: (next: Partial<Item>) => void;
};

const SELECT_OPTIONS: Record<EditableField, readonly string[] | null> = {
  title: null,
  type: TYPE_VALUES,
  domain: DOMAIN_VALUES,
  priority: PRIORITY_VALUES,
  effort: EFFORT_VALUES,
  dueDate: null,
  status: STATUS_VALUES,
};

function clearFlag(flags: ItemFlags, field: EditableField): ItemFlags {
  const next = { ...flags };
  delete (next as Record<string, true | undefined>)[field];
  return next;
}

function displayValue(item: Item, field: EditableField): string {
  if (field === "dueDate") return item.dueDate ?? "—";
  return String(item[field]);
}

export function EditableCell({ item, field, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const isFlagged = item.flags[field] === true;
  const options = SELECT_OPTIONS[field];

  const cellClass = isFlagged
    ? "cursor-pointer text-warm-amber underline decoration-warm-amber decoration-dashed underline-offset-2"
    : "cursor-pointer text-warm-fg hover:bg-warm-chip";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${cellClass} -mx-1 rounded px-1 py-0.5 text-left`}
      >
        {displayValue(item, field)}
      </button>
    );
  }

  const commit = (next: Partial<Item>) => {
    onChange({ ...next, flags: clearFlag(item.flags, field) });
    setEditing(false);
  };

  if (field === "title") {
    return (
      <input
        autoFocus
        type="text"
        defaultValue={item.title}
        onBlur={(e) => commit({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="-mx-1 w-full rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none"
      />
    );
  }

  if (field === "dueDate") {
    return (
      <input
        autoFocus
        type="date"
        defaultValue={item.dueDate ?? ""}
        onBlur={(e) => commit({ dueDate: e.target.value || null })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="-mx-1 rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none"
      />
    );
  }

  if (options) {
    return (
      <Select.Root
        defaultValue={String(item[field])}
        onValueChange={(value) => commit({ [field]: value } as Partial<Item>)}
        open
        onOpenChange={(open) => { if (!open) setEditing(false); }}
      >
        <Select.Trigger className="-mx-1 rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-50 rounded-warm border border-warm-border bg-warm-surface shadow-lg">
            <Select.Viewport className="p-1">
              {options.map((opt) => (
                <Select.Item
                  key={opt}
                  value={opt}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm text-warm-fg outline-none data-[highlighted]:bg-warm-chip"
                >
                  <Select.ItemText>{opt}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify compile + commit**

```bash
npx tsc --noEmit
git add components/EditableCell.tsx
git commit -m "feat: EditableCell — click-to-edit with Radix Select for enums"
```

---

### Task W5.2: Implement `PreviewTable`

**Files:**
- Modify: `components/PreviewTable.tsx`

- [ ] **Step 1: Write the component**

Write to `components/PreviewTable.tsx`:
```tsx
"use client";

import type { Item } from "@/lib/types";
import { EditableCell } from "./EditableCell";

type Props = {
  today: string;
  items: Item[];
  onItemChange: (index: number, next: Partial<Item>) => void;
};

const COLUMNS: Array<{
  key: "title" | "type" | "domain" | "priority" | "effort" | "dueDate" | "status";
  label: string;
}> = [
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "domain", label: "Domain" },
  { key: "priority", label: "Priority" },
  { key: "effort", label: "Effort" },
  { key: "dueDate", label: "Due" },
  { key: "status", label: "Status" },
];

export function PreviewTable({ today, items, onItemChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-3 font-mono text-xs uppercase tracking-wider text-warm-muted">
        Today: {today}
      </div>

      <div className="overflow-hidden rounded-warm border border-warm-border bg-warm-surface shadow-warm">
        <table className="w-full text-left text-sm">
          <thead className="bg-warm-chip text-xs uppercase tracking-wider text-warm-muted">
            <tr>
              <th className="w-10 px-4 py-3 text-center">#</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-t border-warm-border">
                <td className="px-4 py-3 text-center font-mono text-xs text-warm-muted">
                  {idx + 1}
                </td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-4 py-3 align-top">
                    <EditableCell
                      item={item}
                      field={col.key}
                      onChange={(next) => onItemChange(idx, next)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile + commit**

```bash
npx tsc --noEmit
git add components/PreviewTable.tsx
git commit -m "feat: PreviewTable — Notion-warm table with EditableCell per column"
```

---

# Phase 2 — Integration (sequential, in `main` after all parallel merges)

After all 5 worktrees merge cleanly, do the integration in a single worktree (or directly on `main`).

### Task I.1: Implement `/api/process` route

**Files:**
- Create: `app/api/process/route.ts`
- Create: `tests/api.process.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/api.process.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

const processDumpMock = vi.fn();
vi.mock("@/lib/agent", () => ({ processDump: processDumpMock }));

import { POST } from "@/app/api/process/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/process", () => {
  it("returns 400 when body has no dump string", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with today + items on success", async () => {
    processDumpMock.mockResolvedValueOnce({
      today: "2026-05-04",
      items: [
        {
          title: "x", type: "Task", domain: "Personal", priority: "P3 – Normal",
          effort: "Low", dueDate: null, status: "Planned", flags: {},
        },
      ],
    });

    const res = await POST(makeReq({ dump: "P3\nx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBe("2026-05-04");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBeTypeOf("string");
  });

  it("returns 502 on upstream Anthropic error", async () => {
    processDumpMock.mockRejectedValueOnce(new Error("network"));
    const res = await POST(makeReq({ dump: "x" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when JSON validation fails", async () => {
    processDumpMock.mockRejectedValueOnce(new Error("Claude response shape invalid: ..."));
    const res = await POST(makeReq({ dump: "x" }));
    expect(res.status).toBe(500);
  });
});
```

Run:
```bash
npm test -- tests/api.process.test.ts
```

Expected: tests fail (route doesn't exist yet).

- [ ] **Step 2: Implement the route**

Write to `app/api/process/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { processDump } from "@/lib/agent";

const RequestSchema = z.object({ dump: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { today, items } = await processDump(parsed.data.dump);
    const withIds = items.map((item) => ({ ...item, id: randomUUID() }));
    return NextResponse.json({ today, items: withIds });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    if (/invalid|shape/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 3: Run, verify pass**

```bash
npm test -- tests/api.process.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/process/route.ts tests/api.process.test.ts
git commit -m "feat: POST /api/process — agent call + uuid attachment"
```

---

### Task I.2: Implement `/api/write` route

**Files:**
- Create: `app/api/write/route.ts`
- Create: `tests/api.write.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/api.write.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

const writeItemsMock = vi.fn();
vi.mock("@/lib/notion", () => ({ writeItems: writeItemsMock }));

import { POST } from "@/app/api/write/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/write", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const goodItem = {
  id: "1", title: "x", type: "Task", domain: "Personal",
  priority: "P3 – Normal", effort: "Low", dueDate: null,
  status: "Planned", flags: {},
};

describe("POST /api/write", () => {
  it("returns 400 when items is missing or invalid", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with full success result on happy path", async () => {
    writeItemsMock.mockResolvedValueOnce({ written: 1, failures: [] });
    const res = await POST(makeReq({ items: [goodItem] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ written: 1, failures: [] });
  });

  it("returns 200 with partial failure result", async () => {
    writeItemsMock.mockResolvedValueOnce({
      written: 1,
      failures: [{ index: 1, item: goodItem, error: "boom" }],
    });
    const res = await POST(makeReq({ items: [goodItem, goodItem] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.written).toBe(1);
    expect(body.failures).toHaveLength(1);
  });
});
```

Run:
```bash
npm test -- tests/api.write.test.ts
```

Expected: tests fail (route missing).

- [ ] **Step 2: Implement the route**

Write to `app/api/write/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ItemSchema } from "@/lib/types";
import { writeItems } from "@/lib/notion";

const RequestSchema = z.object({
  items: z.array(ItemSchema.extend({ id: z.string().min(1) })).min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await writeItems(parsed.data.items);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Run, verify pass**

```bash
npm test -- tests/api.write.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/write/route.ts tests/api.write.test.ts
git commit -m "feat: POST /api/write — batch write to Notion via writeItems"
```

---

### Task I.3: Compose `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx` (set page title)

- [ ] **Step 1: Update layout**

Write to `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Dump",
  description: "Notion personal-OS Inbox capture",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Write the page**

Write to `app/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { DumpForm } from "@/components/DumpForm";
import { PreviewTable } from "@/components/PreviewTable";
import { WriteBar } from "@/components/WriteBar";
import { PartialFailureCallout } from "@/components/PartialFailureCallout";
import type { Item, WriteFailure } from "@/lib/types";

type Phase = "input" | "processing" | "preview" | "writing" | "done";

type DoneState = {
  written: number;
  failures: WriteFailure[];
};

export default function Page() {
  const [dump, setDump] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [items, setItems] = useState<Item[]>([]);
  const [today, setToday] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);

  async function process() {
    setPhase("processing");
    setError(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dump }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Process failed (${res.status})`);
      }
      const body = (await res.json()) as { today: string; items: Item[] };
      setToday(body.today);
      setItems(body.items);
      setPhase("preview");
    } catch (err) {
      setError((err as Error).message);
      setPhase("input");
    }
  }

  function discard() {
    setItems([]);
    setError(null);
    setPhase("input");
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function write(fromIndex = 0) {
    setPhase("writing");
    const slice = items.slice(fromIndex);
    try {
      const res = await fetch("/api/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: slice }),
      });
      const body = (await res.json()) as DoneState;
      const writtenAdjusted = { written: fromIndex + body.written, failures: body.failures };
      setDone(writtenAdjusted);
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("preview");
    }
  }

  function reset() {
    setDump("");
    setItems([]);
    setDone(null);
    setError(null);
    setPhase("input");
  }

  if (phase === "input" || phase === "processing") {
    return (
      <DumpForm
        value={dump}
        onChange={setDump}
        onSubmit={process}
        loading={phase === "processing"}
        error={error}
      />
    );
  }

  if (phase === "preview" || phase === "writing") {
    return (
      <>
        <PreviewTable today={today} items={items} onItemChange={updateItem} />
        <WriteBar
          count={items.length}
          onWrite={() => write(0)}
          onDiscard={discard}
          writing={phase === "writing"}
        />
      </>
    );
  }

  // phase === "done"
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-warm border border-warm-border bg-warm-surface px-6 py-5 shadow-warm">
        <div className="font-medium text-warm-fg">
          Wrote {done!.written} of {items.length} items.
        </div>
        {done!.failures.length === 0 && (
          <div className="mt-1 text-sm text-warm-muted">All clean.</div>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-warm-sage px-4 py-2 text-sm font-medium text-white shadow-warm"
        >
          New dump
        </button>
      </div>
      {done!.failures.length > 0 && (
        <PartialFailureCallout
          failures={done!.failures}
          onRetry={(fromIndex) => write(fromIndex)}
          onDiscard={reset}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify compile + dev server boots**

```bash
npx tsc --noEmit
npm run dev -- --port 3000 &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: TS clean, server returns `200`.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all unit + route tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: app/page.tsx — orchestrates input/preview/writing/done phases"
```

---

# Phase 3 — Manual E2E + polish

### Task P.1: Set up `.env.local`

- [ ] **Step 1:** Create a Notion internal integration at https://www.notion.so/profile/integrations. Capability: insert content. Workspace: the one with the Inbox DB.

- [ ] **Step 2:** Open the Inbox database (URL `https://www.notion.so/2d13ad1b1fe780d3a569e9953ad1e8e7`), click "Add connections" in the database settings, grant your new integration access.

- [ ] **Step 3:** Create `.env.local`:

```
NOTION_TOKEN=secret_<paste your integration token>
NOTION_DATA_SOURCE_ID=2d13ad1b-1fe7-8071-92a4-000bcd80335b
```

- [ ] **Step 4:** Verify Claude Code OAuth is active:

```bash
ls ~/.claude/config 2>/dev/null && echo "Claude config present"
```

Expected: `Claude config present`. If missing, run `claude /login` in a terminal.

---

### Task P.2: Manual end-to-end test

- [ ] **Step 1:** Start the dev server:

```bash
npm run dev
```

- [ ] **Step 2:** Open http://localhost:3000 in a browser. Confirm the Notion-warm textarea page renders, focus is in the textarea.

- [ ] **Step 3:** Paste this canonical dump:

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

- [ ] **Step 4:** Click Process. Confirm:
  - Spinner shows on button.
  - Within ~10s, the preview table renders with `Today: 2026-05-04` (today's actual date).
  - 4 rows, columns: Title / Type / Domain / Priority / Effort / Due / Status.
  - Any low-confidence cells show in warm-amber with dashed underline.

- [ ] **Step 5:** Click any cell — verify it becomes editable. For a Domain cell, the Radix dropdown opens and lets you pick a different domain. For the Due cell, a date picker opens.

- [ ] **Step 6:** Click "Write 4 to Inbox". Confirm:
  - Button shows "Writing…", disabled.
  - Within ~5s, success state appears: `Wrote 4 of 4 items.`
  - "New dump" button visible.

- [ ] **Step 7:** Open the actual Notion Inbox database (`https://www.notion.so/2d13ad1b1fe780d3a569e9953ad1e8e7`). Confirm 4 new rows exist with the expected Title, Domain, Priority Level, Status. Confirm `Next Action` and `Why (1%)` are blank for all 4 rows.

- [ ] **Step 8:** If anything fails, do not commit. Debug and fix.

---

### Task P.3: README + bookmark

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Write to `README.md`:
```markdown
# Brain-Dump GUI

Local web wrapper around the `ady-operating-system` Claude Code skill. Type a P-level brain dump → preview the inferred Notion rows → click write.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Setup (first time)

1. Create a Notion internal integration → grant access to the Inbox database.
2. Copy `.env.local.example` to `.env.local` and paste your `NOTION_TOKEN`.
3. Ensure Claude Code OAuth is active (`claude /login` if missing).

## Daily use

```bash
npm run build && npm run start
```

Bookmark `http://localhost:3000`.

## Tests

```bash
npm test
```

## Spec & plan

- Design: `docs/superpowers/specs/2026-05-04-brain-dump-gui-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-brain-dump-gui.md`
```

- [ ] **Step 2:** Commit

```bash
git add README.md
git commit -m "docs: README with run + setup instructions"
```

- [ ] **Step 3:** Bookmark `http://localhost:3000` in your browser.

---

## Self-review checklist (run before declaring plan complete)

**Spec coverage:** Walk each section of the spec. For each, confirm a task implements it.

- ✅ Section 4 (architecture) → Phase 0.1, all of Phase 1 + 2
- ✅ Section 5 (data shapes) → Task 0.4 (types.ts)
- ✅ Section 6 (components) → Worktrees 1–5
- ✅ Section 7 (data flow) → Phase 2 integration (page.tsx orchestration)
- ✅ Section 8 (error handling) → Per-route try/catch in I.1, I.2; failure UI in W4.3
- ✅ Section 9 (testing) → Tests in W1–3, I.1, I.2; manual E2E in P.2
- ✅ Section 10 (aesthetic) → Task 0.3 (Tailwind config); each component uses warm-* tokens
- ✅ Section 11 (setup checklist) → Task 0.1 (scaffold), 0.2 (deps), P.1 (env), P.3 (bookmark)

**Type consistency:** `Item` type defined in 0.4. Used identically in `lib/notion.ts` (W2), `lib/agent.ts` (W3), `app/page.tsx` (I.3), all components. `flags` shape stable.

**No placeholders.** Every step has actual code or actual commands. No "TBD," "implement appropriate handling," "similar to above."
