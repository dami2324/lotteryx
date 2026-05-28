import { NextResponse } from "next/server";
import { getUser, saveUser } from "@/lib/users";
import { verifyToken } from "@/lib/crypto";
import { getHistory } from "@/lib/lottery";
import type { Ticket, TicketStatus, DrawType } from "@/lib/types";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const email = await verifyToken(token);
  if (!email) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const user = await getUser(email);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  try {
    const data = await request.json();
    const { date, draw, number } = data as { date: string; draw: DrawType; number: string };

    if (!date || !draw || !number) {
      return NextResponse.json({ error: "Faltan datos del billete" }, { status: 400 });
    }

    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      date,
      draw,
      number,
      status: "pending",
      checked: false
    };

    // Try to verify immediately if the draw is in history
    const history = await getHistory();
    const drawRow = history.find(r => r.date === date && r.draw === draw);

    if (drawRow) {
      newTicket.checked = true;
      let status: TicketStatus = "lose";

      if (number.length === 4) {
        if (number === drawRow.first) status = "win_1st";
        else if (number === drawRow.second) status = "win_2nd";
        else if (number === drawRow.third) status = "win_3rd";
      } else if (number.length === 2) {
        if (number === drawRow.firstTerm) status = "win_1st";
        else if (number === drawRow.secondTerm) status = "win_2nd";
        else if (number === drawRow.thirdTerm) status = "win_3rd";
      }
      newTicket.status = status;

      // Update stats
      if (!user.stats) user.stats = { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };
      user.stats.totalTickets += 1;
      if (status !== "lose") {
        user.stats.totalWins += 1;
      }
    }

    if (!user.tickets) user.tickets = [];
    user.tickets.push(newTicket);
    
    // Fallback initialize stats if still undefined
    if (!user.stats) user.stats = { totalTickets: 0, totalWins: 0, totalMatchedDigits: 0 };
    if (!drawRow) {
      user.stats.totalTickets += 1; // Count it as a ticket even if pending
    }

    await saveUser(user);
    
    return NextResponse.json({ success: true, ticket: newTicket, stats: user.stats });
  } catch (error) {
    console.error("Error adding ticket:", error);
    return NextResponse.json({ error: "Error al registrar el billete" }, { status: 500 });
  }
}
