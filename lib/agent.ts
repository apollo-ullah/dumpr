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
