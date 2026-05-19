import { NextResponse } from "next/server";
import { getPatternAnalysis } from "@/lib/lottery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analysis = await getPatternAnalysis();
    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600"
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
