import { describe, it, expect, vi } from "vitest";

const { processDumpMock } = vi.hoisted(() => ({ processDumpMock: vi.fn() }));
vi.mock("@/lib/agent", () => ({ processDump: processDumpMock }));

import { POST } from "@/app/api/process/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/process", () => {
  it("returns 400 when body has no dump string", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with today + items on success", async () => {
    processDumpMock.mockResolvedValueOnce({
      today: "2026-05-04",
      items: [
        {
          title: "x", type: "Task", domain: "Personal", priority: "P3 – Normal",
          effort: "Low", dueDate: null, status: "Planned", flags: {},
        },
      ],
    });

    const res = await POST(makeReq({ dump: "P3\nx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBe("2026-05-04");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBeTypeOf("string");
  });

  it("returns 502 on upstream Anthropic error", async () => {
    processDumpMock.mockRejectedValueOnce(new Error("network"));
    const res = await POST(makeReq({ dump: "x" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when JSON validation fails", async () => {
    processDumpMock.mockRejectedValueOnce(new Error("Claude response shape invalid: ..."));
    const res = await POST(makeReq({ dump: "x" }));
    expect(res.status).toBe(500);
  });
});
