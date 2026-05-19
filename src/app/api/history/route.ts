import { NextResponse } from "next/server";
import { getHistory } from "@/lib/lottery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await getHistory();
    return NextResponse.json(history, {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el historial.",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
