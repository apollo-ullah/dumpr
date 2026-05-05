import { readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL_PATH = join(process.cwd(), "skills/SKILL.md");

let cached: string | null = null;

export function loadSkill(): string {
  if (cached !== null) return cached;
  try {
    cached = readFileSync(SKILL_PATH, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read SKILL.md at ${SKILL_PATH}. ` +
        `Expected at skills/SKILL.md in repo root. (${(err as Error).message})`
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
      "domain": "Personal Project" | "Work" | "Clubs" | "Community" | "Coursework" | "Family" | "Health" | "Deen" | "Admin" | "Money" | "Content" | "Career" | "Growth" | "Personal",
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
