import { NextResponse } from "next/server";
import { sendResultsEmail } from "@/lib/email";
import { getHistory } from "@/lib/lottery";
import { getUsers, saveUser } from "@/lib/users";
import type { TicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Afternoon cron - runs at 21:00 UTC (4:00 PM Panama) on draw days.
 * 1. Gets today's official results from history.
 * 2. Checks user tickets and marks winners.
 * 3. Checks user generationHistory to see if any generated picks matched today's prizes.
 * 4. Sends a personalized results email to each user.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Get today's date in Panama time (UTC-5)
  const now = new Date();
  const panamaOffset = -5 * 60;
  const panamaTime = new Date(now.getTime() + (panamaOffset - now.getTimezoneOffset()) * 60000);
  const todayStr = panamaTime.toISOString().slice(0, 10);

  // Get all draws that happened today
  const history = await getHistory();
  const todayDraws = history.filter(r => r.date === todayStr && r.first !== "0000");

  if (todayDraws.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "No hay resultados oficiales publicados todavía para hoy" });
  }

  const users = await getUsers();
  let emailsSent = 0;

  for (const user of users) {
    let userModified = false;

    for (const draw of todayDraws) {
      // --- 1. Check registered tickets ---
      if (user.tickets) {
        for (const ticket of user.tickets) {
          if (!ticket.checked && ticket.date === draw.date && ticket.draw === draw.draw) {
            ticket.checked = true;
            let status: TicketStatus = "lose";

            if (ticket.number.length === 4) {
              if (ticket.number === draw.first) status = "win_1st";
              else if (ticket.number === draw.second) status = "win_2nd";
              else if (ticket.number === draw.third) status = "win_3rd";
            } else if (ticket.number.length === 2) {
              if (ticket.number === draw.firstTerm) status = "win_1st";
              else if (ticket.number === draw.secondTerm) status = "win_2nd";
              else if (ticket.number === draw.thirdTerm) status = "win_3rd";
            }

            ticket.status = status;
            userModified = true;

            if (status !== "lose") {
              if (!user.stats) user.stats = { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };
              user.stats.totalWins += 1;
            }
          }
        }
      }

      // --- 2. Check generated history picks ---
      const winningGenerations: Array<{ picks: string[]; matchedPick: string; prize: string; draw: string }> = [];

      if (user.generationHistory) {
        // Find generations for the same draw type that were created before or on today's date
        const relevantGenerations = user.generationHistory.filter(g => 
          g.draw === draw.draw || 
          (g.draw === "Gordito" && draw.draw.includes("Gordito")) ||
          (g.draw.includes("Gordito") && draw.draw === "Gordito")
        );

        for (const gen of relevantGenerations) {
          for (const pick of gen.picks) {
            const term = pick.length === 4 ? pick.slice(-2) : pick;

            let matchedPrize = "";
            if (pick === draw.first || term === draw.firstTerm) matchedPrize = "1er Premio 🥇";
            else if (pick === draw.second || term === draw.secondTerm) matchedPrize = "2do Premio 🥈";
            else if (pick === draw.third || term === draw.thirdTerm) matchedPrize = "3er Premio 🥉";

            if (matchedPrize) {
              winningGenerations.push({
                picks: gen.picks,
                matchedPick: pick,
                prize: matchedPrize,
                draw: draw.draw
              });
              break; // Only report first match per generation
            }
          }
        }
      }

      // --- 3. Send results email ---
      const userTicketsForDraw = (user.tickets || []).filter(t => t.date === draw.date && t.draw === draw.draw);

      const result = await sendResultsEmail(user, draw, userTicketsForDraw, winningGenerations);
      if (result.sent) emailsSent++;
    }

    if (userModified) {
      await saveUser(user);
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayStr,
    drawsProcessed: todayDraws.map(d => d.draw),
    emailsSent
  });
}
