import { NextResponse } from "next/server";
import { z } from "zod";
import { ItemSchema } from "@/lib/types";
import { writeItems } from "@/lib/notion";

const RequestSchema = z.object({
  items: z.array(ItemSchema.extend({ id: z.string().min(1) })).min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await writeItems(parsed.data.items);
  return NextResponse.json(result);
}
