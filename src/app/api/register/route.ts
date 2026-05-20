import { NextResponse } from "next/server";
import { saveUser, getUser } from "@/lib/users";
import { hashPassword } from "@/lib/crypto";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!name || !email || !email.includes("@") || !password) {
    return NextResponse.json({ error: "Nombre, correo y contraseña son requeridos." }, { status: 400 });
  }

  // Basic password strength check
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const existingUser = await getUser(email);
  if (existingUser) {
    return NextResponse.json({ error: "El correo ya está registrado." }, { status: 409 });
  }

  const hashedPassword = await hashPassword(password);

  const result = await saveUser({
    name,
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ ok: true, ...result });
}
