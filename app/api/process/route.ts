import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { processDump } from "@/lib/agent";

const RequestSchema = z.object({ dump: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { today, items } = await processDump(parsed.data.dump);
    const withIds = items.map((item) => ({ ...item, id: randomUUID() }));
    return NextResponse.json({ today, items: withIds });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    if (/invalid|shape/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
