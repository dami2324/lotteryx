import { NextResponse } from "next/server";
import { getPatternAnalysis, StrategyType, TimeRange, DrawName } from "@/lib/lottery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strategy = (searchParams.get("strategy") as StrategyType) || "jump";
    const timeRangeParam = searchParams.get("timeRange");
    const timeRange = timeRangeParam ? (parseInt(timeRangeParam, 10) as TimeRange) : 180;
    const draw = (searchParams.get("draw") as DrawName | null) || undefined;

    const analysis = await getPatternAnalysis(strategy, timeRange, false, draw);
    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el analisis.",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
