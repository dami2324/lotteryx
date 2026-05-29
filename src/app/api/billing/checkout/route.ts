import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/crypto";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const email = token ? await verifyToken(token) : null;
  if (!email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const checkoutUrl = process.env.CHECKOUT_URL || "https://pay.hotmart.com/P106046599X?off=s5icz051";

  const url = new URL(checkoutUrl);
  url.searchParams.set("email", email);

  return NextResponse.json({ url: url.toString() });
}
