import type { Item } from "./types";

export type ProcessResult = {
  today: string;
  items: Omit<Item, "id">[];
};

export async function processDump(_dump: string): Promise<ProcessResult> {
  throw new Error("lib/agent.ts not implemented (Worktree 3)");
}
