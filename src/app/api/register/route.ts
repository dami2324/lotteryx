import { NextResponse } from "next/server";
import { saveUser, getUser } from "@/lib/users";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!name || !email || !email.includes("@") || !password) {
    return NextResponse.json({ error: "Nombre, correo y contraseña son requeridos." }, { status: 400 });
  }

  const existingUser = await getUser(email);
  if (existingUser) {
    return NextResponse.json({ error: "El correo ya está registrado." }, { status: 409 });
  }

  const result = await saveUser({
    name,
    email,
    password,
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ ok: true, ...result });
}
