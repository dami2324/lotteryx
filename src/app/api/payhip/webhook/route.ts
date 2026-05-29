import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser, saveUser } from "@/lib/users";

export const runtime = "nodejs";

type PayhipPayload = {
  type?: string;
  signature?: string;
  email?: string;
  customer_email?: string;
  subscription_id?: string;
  date?: number;
  date_subscription_started?: number;
  date_subscription_deleted?: number;
};

const MONTH_MS = 31 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const payload = (await request.json()) as PayhipPayload;
  const apiKey = process.env.PAYHIP_API_KEY;

  if (apiKey) {
    const expectedSignature = createHash("sha256").update(apiKey).digest("hex");
    if (payload.signature !== expectedSignature) {
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
    }
  }

  const email = (payload.customer_email || payload.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email no incluido" }, { status: 400 });
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Usuario no encontrado" });
  }

  if (payload.type === "subscription.created" || payload.type === "paid") {
    const startMs = Math.max(Date.now(), user.proUntil ? new Date(user.proUntil).getTime() : 0);
    user.plan = "pro";
    user.subscriptionStatus = "active";
    user.proUntil = new Date(startMs + MONTH_MS).toISOString();
    user.payhipSubscriptionId = payload.subscription_id ?? user.payhipSubscriptionId;
  }

  if (payload.type === "subscription.deleted") {
    user.subscriptionStatus = "canceled";
    user.plan = "pro";
    const startedAt = payload.date_subscription_started ? payload.date_subscription_started * 1000 : Date.now();
    const paidThrough = user.proUntil ? new Date(user.proUntil).getTime() : startedAt + MONTH_MS;
    user.proUntil = new Date(Math.max(paidThrough, Date.now())).toISOString();
    user.payhipSubscriptionId = payload.subscription_id ?? user.payhipSubscriptionId;
  }

  await saveUser(user);
  return NextResponse.json({ ok: true, plan: user.plan, subscriptionStatus: user.subscriptionStatus, proUntil: user.proUntil });
}
