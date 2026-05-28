import { NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/lottery";
import type { DrawName, TimeRange } from "@/lib/lottery";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const draw = (searchParams.get("draw") || "Miercolito") as DrawName;
  const timeRangeParam = searchParams.get("timeRange");
  const timeRange = (timeRangeParam ? parseInt(timeRangeParam, 10) : 180) as TimeRange;
  
  try {
    const stats = await getGlobalStats(draw, timeRange);
    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("Stats Generation error:", error);
    return NextResponse.json({ error: error.message || "Error generating stats" }, { status: 500 });
  }
}
