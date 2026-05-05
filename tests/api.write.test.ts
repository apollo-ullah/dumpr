import { describe, it, expect, vi } from "vitest";

const { writeItemsMock } = vi.hoisted(() => ({ writeItemsMock: vi.fn() }));
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
