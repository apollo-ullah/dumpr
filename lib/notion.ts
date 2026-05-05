import type { Item, WriteResult } from "./types";

export function itemToProperties(_item: Item): Record<string, unknown> {
  throw new Error("lib/notion.ts not implemented (Worktree 2)");
}

export async function writeItems(_items: Item[]): Promise<WriteResult> {
  throw new Error("lib/notion.ts not implemented (Worktree 2)");
}
