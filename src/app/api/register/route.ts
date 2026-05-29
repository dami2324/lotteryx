import { NextResponse } from "next/server";
import { saveUser, getUser } from "@/lib/users";
import { hashPassword, signToken } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!name || !email || !email.includes("@") || !password) {
      return NextResponse.json({ error: "Nombre, correo y contraseña son requeridos." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const existingUser = await getUser(email);
    if (existingUser) {
      // If user exists but has no password yet (legacy account), allow setting one
      if (existingUser.password) {
        return NextResponse.json({ error: "El correo ya está registrado." }, { status: 409 });
      }
      // Legacy account — activate it by setting password (and update name if provided)
      existingUser.name = name;
      existingUser.password = await hashPassword(password);
      await saveUser(existingUser);
      const token = await signToken(existingUser.email);
      return NextResponse.json({ ok: true, token, name: existingUser.name, email: existingUser.email });
    }

    const hashedPassword = await hashPassword(password);

    await saveUser({
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      plan: "free",
      subscriptionStatus: "free",
      favoriteStrategy: "hot"
    });

    const token = await signToken(email);
    return NextResponse.json({ ok: true, token, name, email });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
