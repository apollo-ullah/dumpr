import { Client } from "@notionhq/client";
import type { Item, WriteFailure, WriteResult } from "./types";
import { DOMAIN_VALUES, PRIORITY_VALUES } from "./types";
import { env } from "./env";

type Domain = (typeof DOMAIN_VALUES)[number];

export const DOMAIN_ICONS: Record<Domain, string> = {
  "Personal Project": "💡",
  Work: "💼",
  Clubs: "🌐",
  Community: "📝",
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

export type Stats = {
  dueThisWeek: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  starving: number;
};

const TZ = "America/Toronto";

function torontoNow(): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    weekday: weekdayMap[parts.weekday] ?? 1,
  };
}

function dateAddDays(year: number, month: number, day: number, deltaDays: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function ymd(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

async function queryAll(filter: unknown): Promise<unknown[]> {
  const client = getClient();
  const results: unknown[] = [];
  let cursor: string | undefined = undefined;
  while (true) {
    const res = await client.dataSources.query({
      data_source_id: env.NOTION_DATA_SOURCE_ID,
      filter,
      page_size: 100,
      start_cursor: cursor,
    } as never);
    const r = res as { results?: unknown[]; next_cursor?: string | null; has_more?: boolean };
    if (r.results) results.push(...r.results);
    if (!r.has_more || !r.next_cursor) break;
    cursor = r.next_cursor;
  }
  return results;
}

export async function fetchStats(): Promise<Stats> {
  const t = torontoNow();
  const daysFromMonday = t.weekday === 0 ? 6 : t.weekday - 1;
  const thisMon = dateAddDays(t.year, t.month, t.day, -daysFromMonday);
  const thisSun = dateAddDays(thisMon.year, thisMon.month, thisMon.day, 6);

  const todayStr = ymd(t);
  const thisMonStr = ymd(thisMon);
  const thisSunStr = ymd(thisSun);

  const openPages = await queryAll({
    and: [
      { property: "Status", select: { does_not_equal: "Done" } },
      { property: "Status", select: { does_not_equal: "Dropped" } },
    ],
  });

  let dueThisWeek = 0;
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  let p4 = 0;
  let starving = 0;

  for (const page of openPages) {
    const props = (page as { properties?: Record<string, unknown> }).properties ?? {};
    const priorityProp = props["Priority Level"] as { select?: { name?: string } } | undefined;
    const dueProp = props["Due Date"] as { date?: { start?: string } | null } | undefined;
    const priority = priorityProp?.select?.name;
    const due = dueProp?.date?.start;

    if (priority === PRIORITY_VALUES[0]) p1++;
    else if (priority === PRIORITY_VALUES[1]) p2++;
    else if (priority === PRIORITY_VALUES[2]) p3++;
    else if (priority === PRIORITY_VALUES[3]) p4++;

    if (due) {
      if (due >= thisMonStr && due <= thisSunStr) dueThisWeek++;
      if (due < todayStr) starving++;
    }
  }

  return { dueThisWeek, p1, p2, p3, p4, starving };
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
