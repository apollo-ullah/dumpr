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

vi.mock("@notionhq/client", () => {
  const mockCreate = vi.fn();
  return {
    Client: vi.fn().mockImplementation(function () {
      return {
        pages: { create: mockCreate },
      };
    }),
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

  it("attaches a domain emoji icon to each created page", async () => {
    mockCreate.mockResolvedValue({});
    await writeItems([
      { ...baseItem, id: "1", domain: "Health" },
      { ...baseItem, id: "2", domain: "Family" },
      { ...baseItem, id: "3", domain: "Heave" },
    ]);

    expect(mockCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ icon: { type: "emoji", emoji: "💪" } })
    );
    expect(mockCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ icon: { type: "emoji", emoji: "👨‍👩‍👧" } })
    );
    expect(mockCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ icon: { type: "emoji", emoji: "💼" } })
    );
  });
});
