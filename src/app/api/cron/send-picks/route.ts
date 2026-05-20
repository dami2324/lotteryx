import { NextResponse } from "next/server";
import { sendPicksEmail } from "@/lib/email";
import { getPatternAnalysis } from "@/lib/lottery";
import { getUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const analysis = await getPatternAnalysis();
  const users = await getUsers();
  const results = await Promise.all(users.map((user) => sendPicksEmail(user, analysis)));

  return NextResponse.json({
    ok: true,
    nextDraw: analysis.nextDraw,
    users: users.length,
    sent: results.filter((result) => result.sent).length,
    skipped: results.filter((result) => !result.sent).length
  });
}
