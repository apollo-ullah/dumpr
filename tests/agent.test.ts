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
      domain: "Work",
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
