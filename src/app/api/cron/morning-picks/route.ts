import { NextResponse } from "next/server";
import { sendPicksEmail } from "@/lib/email";
import { getPatternAnalysis, getHistory } from "@/lib/lottery";
import { getUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * Morning cron - runs at 12:00 UTC (7:00 AM Panama) on draw days.
 * Detects which lottery draws are scheduled for today and sends picks to all users.
 * Covers: Miercolito (Wed), Dominical (Sun), Gordito (varies), Extraordinaria (varies).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Detect today's draws by checking which ones have their most recent record = today
  const now = new Date();
  const panamaOffset = -5 * 60; // UTC-5
  const panamaTime = new Date(now.getTime() + (panamaOffset - now.getTimezoneOffset()) * 60000);
  const todayStr = panamaTime.toISOString().slice(0, 10);
  const dayOfWeek = panamaTime.getUTCDay(); // 0=Sun, 3=Wed

  // Main lottery days: Wednesday (3) and Sunday (0)
  const isMainDrawDay = dayOfWeek === 0 || dayOfWeek === 3;
  
  // For Gordito and Extraordinaria, check if today has a scheduled entry in history
  const history = await getHistory();
  const todayDraws = history.filter(r => r.date === todayStr);
  const gorditoToday = todayDraws.some(r => r.draw === "Gordito");
  const extraordinariaToday = todayDraws.some(r => r.draw === "Extraordinaria");

  if (!isMainDrawDay && !gorditoToday && !extraordinariaToday) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Hoy no hay sorteos programados" });
  }

  const users = await getUsers();
  const results: Record<string, number> = {};

  // Send Miercolito/Dominical picks
  if (isMainDrawDay) {
    const drawName = dayOfWeek === 3 ? "Miercolito" : "Dominical";
    try {
      const analysis = await getPatternAnalysis("jump", 180, false);
      const pickResults = await Promise.all(
        users.map(user => sendPicksEmail(user, analysis, drawName))
      );
      results[drawName] = pickResults.filter(r => r.sent).length;
    } catch (e) {
      console.error(`Error generating analysis for ${isMainDrawDay}:`, e);
    }
  }

  // Send Gordito picks
  if (gorditoToday) {
    try {
      const gorditoAnalysis = await getPatternAnalysis("jump", 180, false, "Gordito");
      const gorditoResults = await Promise.all(
        users.map(user => sendPicksEmail(user, gorditoAnalysis, "Gordito"))
      );
      results["Gordito"] = gorditoResults.filter(r => r.sent).length;
    } catch (e) {
      console.error("Error generating Gordito analysis:", e);
    }
  }

  // Send Extraordinaria picks
  if (extraordinariaToday) {
    try {
      const extAnalysis = await getPatternAnalysis("jump", 180, false, "Extraordinaria");
      const extResults = await Promise.all(
        users.map(user => sendPicksEmail(user, extAnalysis, "Extraordinaria"))
      );
      results["Extraordinaria"] = extResults.filter(r => r.sent).length;
    } catch (e) {
      console.error("Error generating Extraordinaria analysis:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayStr,
    emailsSent: results
  });
}
