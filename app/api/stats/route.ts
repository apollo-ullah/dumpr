import { NextResponse } from "next/server";
import { fetchStats } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await fetchStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? String(err) },
      { status: 502 }
    );
  }
}
