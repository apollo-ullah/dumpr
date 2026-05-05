import { Client } from "@notionhq/client";
import type { Item, WriteFailure, WriteResult } from "./types";
import { DOMAIN_VALUES } from "./types";
import { env } from "./env";

type Domain = (typeof DOMAIN_VALUES)[number];

export const DOMAIN_ICONS: Record<Domain, string> = {
  "Personal Project": "💡",
  Heave: "💼",
  Agency: "🏢",
  "GDG Projects": "🌐",
  "Notion CL": "📝",
  Arena: "🏟️",
  Coursework: "🎓",
  Family: "👨‍👩‍👧",
  Health: "💪",
  Deen: "🕌",
  Admin: "🚗",
  Money: "💰",
  Content: "🎥",
  Career: "🤝",
  Growth: "📚",
  Personal: "✨",
};

export function itemToIcon(item: Item): { type: "emoji"; emoji: string } {
  return { type: "emoji", emoji: DOMAIN_ICONS[item.domain] };
}

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
        icon: itemToIcon(item) as never,
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
