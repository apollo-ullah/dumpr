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
