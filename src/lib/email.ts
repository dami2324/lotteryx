import type { PatternAnalysis, Pick } from "./lottery";
import type { LotteryXUser } from "./users";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM ?? "LotteryX <onboarding@resend.dev>";

export async function sendPicksEmail(user: LotteryXUser, analysis: PatternAnalysis) {
  if (!resendApiKey) {
    return { sent: false, reason: "RESEND_API_KEY no configurado" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to: user.email,
      subject: `LotteryX: tengo 10 numeros para ${analysis.nextDraw.name}`,
      html: renderEmail(user, analysis)
    })
  });

  if (!response.ok) {
    return { sent: false, reason: await response.text() };
  }

  return { sent: true };
}

function renderEmail(user: LotteryXUser, analysis: PatternAnalysis) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f6f7f9;padding:24px;color:#17202a">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dde3ea;padding:24px">
        <p style="margin:0 0 8px;font-size:20px;font-weight:800">LotteryX</p>
        <h1 style="margin:0;font-size:28px;line-height:1.1">${user.name}, tengo 10 numeros para ti</h1>
        <p style="margin:10px 0 22px;color:#5d6875">${analysis.nextDraw.name} · ${analysis.nextDraw.label}</p>
        ${renderGroup("5 principales", analysis.topFive)}
        ${renderGroup("5 backup", analysis.backups)}
        <p style="margin:22px 0 0;color:#5d6875;font-size:12px;line-height:1.45">
          Estos numeros siguen el patron LotteryX: terminaciones que salen en segundo/tercer premio y luego brincan al primer premio.
          Es una lectura estadistica, no una garantia.
        </p>
      </div>
    </div>
  `;
}

function renderGroup(title: string, picks: Pick[]) {
  return `
    <h2 style="font-size:16px;margin:20px 0 10px">${title}</h2>
    <table style="width:100%;border-collapse:collapse">
      ${picks
        .map(
          (pick) => `
          <tr>
            <td style="border-top:1px solid #dde3ea;padding:12px 0;width:72px">
              <strong style="display:inline-block;border:2px solid #0f766e;width:52px;height:52px;text-align:center;line-height:52px;font-size:24px">${pick.term}</strong>
            </td>
            <td style="border-top:1px solid #dde3ea;padding:12px 0">
              <strong>${pick.score.toFixed(2)} pts</strong><br />
              <span style="color:#5d6875;font-size:13px">2do/3ro: ${pick.exposures} · 1ro: ${pick.firstCount} · Brincos: ${pick.verifiedJumps}</span>
            </td>
          </tr>
        `
        )
        .join("")}
    </table>
  `;
}
