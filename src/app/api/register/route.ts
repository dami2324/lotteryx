import { NextResponse } from "next/server";
import { saveUser, getUser } from "@/lib/users";
import { hashPassword, signToken } from "@/lib/crypto";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(100, "Nombre muy largo"),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(255),
  password: z.string().trim().min(6, "La contraseña debe tener al menos 6 caracteres").max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = registerSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Error de validación";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    const { name, email, password } = parseResult.data;

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
