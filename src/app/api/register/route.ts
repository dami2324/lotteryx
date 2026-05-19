import { NextResponse } from "next/server";
import { saveUser } from "@/lib/users";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Nombre y correo validos son requeridos." }, { status: 400 });
  }

  const result = await saveUser({
    name,
    email,
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ ok: true, ...result });
}
