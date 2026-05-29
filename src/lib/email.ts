import type { PatternAnalysis, Pick, DrawRow, DrawName } from "./lottery";
import type { LotteryXUser } from "./users";
import type { Ticket } from "./types";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM ?? "LotteryX <onboarding@resend.dev>";

// ── sendPicksEmail ────────────────────────────────────────────────────────────
export async function sendPicksEmail(
  user: LotteryXUser,
  analysis: PatternAnalysis,
  drawName?: string,
  strategy?: string
) {
  if (!resendApiKey) return { sent: false, reason: "RESEND_API_KEY no configurado" };
  if (user.notificationEmail === false) return { sent: false, reason: "Notificaciones desactivadas" };

  const draw = drawName ?? analysis.nextDraw.name;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: user.email,
      subject: `🍀 LotteryX: Tus números para el sorteo de hoy — ${draw}`,
      html: renderPicksEmail(user, analysis, draw, strategy),
    }),
  });

  if (!response.ok) return { sent: false, reason: await response.text() };
  return { sent: true };
}

// ── sendResultsEmail ──────────────────────────────────────────────────────────
export async function sendResultsEmail(
  user: LotteryXUser,
  draw: DrawRow,
  userTickets: Ticket[],
  winningGenerations: Array<{ picks: string[]; matchedPick: string; prize: string; draw: string }>
) {
  if (!resendApiKey) return { sent: false, reason: "RESEND_API_KEY no configurado" };
  if (user.notificationEmail === false) return { sent: false, reason: "Notificaciones desactivadas" };

  const hasWin = userTickets.some(t => t.status !== "lose" && t.status !== "pending")
    || winningGenerations.length > 0;

  const subject = hasWin
    ? `🎉 ¡Felicidades! Tus números ganaron en ${draw.draw} — LotteryX`
    : `📋 Resultados oficiales: ${draw.draw} — ${draw.date}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: user.email,
      subject,
      html: renderResultsEmail(user, draw, userTickets, winningGenerations),
    }),
  });

  if (!response.ok) return { sent: false, reason: await response.text() };
  return { sent: true };
}

// ── Legacy (kept for old cron endpoint compatibility) ─────────────────────────
export async function sendDrawSummaryEmail(
  user: LotteryXUser,
  latestDraw: DrawRow,
  hitMessage: string
) {
  return sendResultsEmail(user, latestDraw, user.tickets?.filter(t => t.date === latestDraw.date) ?? [], []);
}

// ── HTML Templates ────────────────────────────────────────────────────────────

function renderPicksEmail(user: LotteryXUser, analysis: PatternAnalysis, drawName: string, strategy?: string) {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0f172a;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(99,102,241,0.3);border-radius:16px;overflow:hidden">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:28px 32px;text-align:center">
          <p style="margin:0 0 6px;font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.7);text-transform:uppercase">LotteryX</p>
          <h1 style="margin:0;font-size:28px;color:#fff;font-weight:800">🍀 Tus números del día</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:15px">${drawName} &nbsp;·&nbsp; ${new Date().toLocaleDateString("es-PA", { weekday:"long", day:"numeric", month:"long" })}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px">
          <p style="margin:0 0 24px;color:#94a3b8;font-size:15px">Hola <strong style="color:#e2e8f0">${user.name}</strong>, aqui estan tus 10 picks para <strong style="color:#e2e8f0">${drawName}</strong> con la estrategia <strong style="color:#e2e8f0">${strategy ?? user.favoriteStrategy ?? "jump"}</strong>:</p>

          ${renderPickGroup("⭐ Top 5 — Principales", analysis.topFive)}
          ${renderPickGroup("🔵 5 Backup", analysis.backups)}
          ${renderTickets(analysis.generatedTickets)}

          <p style="margin:28px 0 0;padding:16px;background:rgba(99,102,241,0.1);border-left:3px solid #6366f1;border-radius:4px;color:#94a3b8;font-size:13px;line-height:1.6">
            Estos números siguen el patrón LotteryX: terminaciones que salen en 2do/3er premio y luego saltan al 1er premio.
            Es un análisis estadístico, no una garantía.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
          <p style="margin:0;color:#475569;font-size:12px">Para dejar de recibir estos correos, entra a tu perfil en LotteryX y desactiva las notificaciones.</p>
        </div>
      </div>
    </div>
  `;
}

function renderResultsEmail(
  user: LotteryXUser,
  draw: DrawRow,
  tickets: Ticket[],
  winningGenerations: Array<{ picks: string[]; matchedPick: string; prize: string; draw: string }>
) {
  const hasWin = tickets.some(t => t.status !== "lose" && t.status !== "pending") || winningGenerations.length > 0;

  const officialResults = `
    <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;margin-bottom:24px">
      <h2 style="margin:0 0 16px;font-size:16px;color:#e2e8f0;text-transform:uppercase;letter-spacing:1px">Resultados Oficiales</h2>
      ${renderPrizeRow("🥇 1er Premio", draw.first, draw.firstTerm)}
      ${renderPrizeRow("🥈 2do Premio", draw.second, draw.secondTerm)}
      ${renderPrizeRow("🥉 3er Premio", draw.third, draw.thirdTerm)}
    </div>
  `;

  const ticketsHtml = tickets.length === 0
    ? `<p style="color:#64748b;font-size:14px">No registraste ningún billete para este sorteo.</p>`
    : `<div style="display:flex;flex-direction:column;gap:10px">${tickets.map(t => {
        const isWin = t.status !== "lose" && t.status !== "pending";
        const statusLabel = t.status === "win_1st" ? "🥇 1er Premio" : t.status === "win_2nd" ? "🥈 2do Premio" : t.status === "win_3rd" ? "🥉 3er Premio" : "❌ No ganó";
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:${isWin ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)"};border:1px solid ${isWin ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"};border-radius:8px">
          <span style="font-size:24px;font-weight:800;color:#e2e8f0;font-family:monospace">${t.number}</span>
          <span style="font-size:13px;font-weight:600;color:${isWin ? "#4ade80" : "#64748b"}">${statusLabel}</span>
        </div>`;
      }).join("")}</div>`;

  const generationsHtml = winningGenerations.length === 0
    ? `<p style="color:#64748b;font-size:14px">Ninguna de tus combinaciones generadas acertó un premio en este sorteo.</p>`
    : winningGenerations.map(wg => `
        <div style="padding:14px 16px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:8px;margin-bottom:10px">
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">Generación para <strong style="color:#c084fc">${wg.draw}</strong></p>
          <p style="margin:0 0 6px;font-size:13px;color:#94a3b8">Números: <span style="color:#e2e8f0;font-family:monospace">${wg.picks.join(", ")}</span></p>
          <p style="margin:0;font-size:14px;font-weight:700;color:#c084fc">🎯 El número <strong style="font-size:18px;color:#e879f9">${wg.matchedPick}</strong> acertó el <strong>${wg.prize}</strong></p>
        </div>
      `).join("");

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0f172a;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(99,102,241,0.3);border-radius:16px;overflow:hidden">

        <!-- Header -->
        <div style="background:${hasWin ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#334155,#1e293b)"};padding:28px 32px;text-align:center">
          <p style="margin:0 0 6px;font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.7);text-transform:uppercase">LotteryX</p>
          <h1 style="margin:0;font-size:26px;color:#fff;font-weight:800">${hasWin ? "🎉 ¡Tienes premios!" : "📋 Resultados del sorteo"}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:15px">${draw.draw} &nbsp;·&nbsp; ${draw.date}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px">
          <p style="margin:0 0 24px;color:#94a3b8">Hola <strong style="color:#e2e8f0">${user.name}</strong>, ya están disponibles los resultados oficiales del sorteo de hoy.</p>

          ${officialResults}

          <h2 style="font-size:16px;color:#e2e8f0;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">📋 Tus Billetes Registrados</h2>
          ${ticketsHtml}

          <h2 style="font-size:16px;color:#e2e8f0;margin:24px 0 12px;text-transform:uppercase;letter-spacing:1px">🤖 Tus Combinaciones Generadas</h2>
          ${generationsHtml}
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
          <p style="margin:0;color:#475569;font-size:12px">Para dejar de recibir estos correos, entra a tu perfil en LotteryX y desactiva las notificaciones.</p>
        </div>
      </div>
    </div>
  `;
}

function renderTickets(tickets: string[]) {
  if (!tickets || tickets.length === 0) {
    return "";
  }

  return `
    <div style="margin-bottom:24px">
      <h2 style="margin:0 0 12px;font-size:14px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Billetes sugeridos</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${tickets.map(ticket => `
          <div style="padding:12px 14px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.28);border-radius:10px;color:#34d399;font-size:20px;font-weight:800;font-family:monospace">${ticket}</div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderPickGroup(title: string, picks: Pick[]) {
  return `
    <div style="margin-bottom:24px">
      <h2 style="margin:0 0 12px;font-size:14px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${title}</h2>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        ${picks.map(pick => `
          <div style="text-align:center;padding:16px 8px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:12px">
            <div style="font-size:28px;font-weight:800;color:#818cf8;font-family:monospace">${pick.term}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">${pick.score.toFixed(1)} pts</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderPrizeRow(label: string, number: string, term: string) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
      <span style="color:#94a3b8;font-size:14px">${label}</span>
      <span style="font-family:monospace;font-size:18px;font-weight:700;color:#e2e8f0">${number} <span style="font-size:13px;color:#6366f1">(${term})</span></span>
    </div>
  `;
}
