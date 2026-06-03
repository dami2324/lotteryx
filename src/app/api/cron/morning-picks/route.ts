import { NextResponse } from "next/server";
import { sendMorningReminderEmail } from "@/lib/email";
import { getPatternAnalysis, getHistory, StrategyType, DrawName } from "@/lib/lottery";
import { getUsers, isProUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * Hourly cron. Sends picks at the configured draw alert hour in Panama time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const panamaTime = getPanamaDate();
  const todayStr = panamaTime.toISOString().slice(0, 10);
  const dayOfWeek = panamaTime.getUTCDay(); // 0=Sun, 3=Wed
  const hour = panamaTime.getUTCHours();
  const alertHour = 10;
  const extraDrawHour = Number(process.env.EXTRAORDINARIA_DRAW_HOUR_PANAMA ?? "14");
  const extraAlertHour = Math.max(0, extraDrawHour - 2);
  
  const history = await getHistory();
  const todayDraws = history.filter(r => r.date === todayStr);
  const extraordinariaToday = todayDraws.some(r => r.draw === "Extraordinaria");
  const gorditoToday = todayDraws.some(r => r.draw.includes("Gordito"));
  const proUsers = (await getUsers()).filter(isProUser);

  const results: Record<string, number> = {};
  const plannedDraws: DrawName[] = [];

  if (hour === alertHour && dayOfWeek === 3) {
    plannedDraws.push("Miercolito");
  }
  if (hour === alertHour && dayOfWeek === 0) {
    plannedDraws.push("Dominical");
  }
  if (hour === alertHour && gorditoToday) {
    plannedDraws.push("Gordito");
  }
  if (hour === extraAlertHour && extraordinariaToday) {
    plannedDraws.push("Extraordinaria");
  }

  if (plannedDraws.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "No corresponde enviar alertas en esta hora" });
  }

  for (const drawName of plannedDraws) {
    try {
      const emailResults = await Promise.all(
        proUsers.map(async user => {
          // Check alertsConfig first
          const config = user.alertsConfig || {};
          if (config.morning === false) {
            return { sent: false, reason: "Usuario desactivó alertas matutinas" };
          }
          if (drawName === "Dominical" && config.dominical === false) return { sent: false, reason: "Desactivado" };
          if (drawName === "Miercolito" && config.miercolito === false) return { sent: false, reason: "Desactivado" };
          if ((drawName === "Gordito" || drawName === "Extraordinaria") && config.gordito === false) return { sent: false, reason: "Desactivado" };

          // All pro users get the generic reminder email regardless of strategy
          return sendMorningReminderEmail(user, drawName);
        })
      );
      results[drawName] = emailResults.filter(r => r.sent).length;
    } catch (e) {
      console.error(`Error generating ${drawName} analysis:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayStr,
    hour,
    users: proUsers.length,
    emailsSent: results
  });
}

function getPanamaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return new Date(Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second"))
  ));
}
