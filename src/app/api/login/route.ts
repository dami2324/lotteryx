import { NextResponse } from "next/server";
import { getUser } from "@/lib/users";
import { verifyPassword, signToken } from "@/lib/crypto";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").min(1, "Falta correo").max(255),
  password: z.string().trim().min(1, "Falta contraseña").max(100),
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const parseResult = loginSchema.safeParse(data);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Error de validación";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    const { email, password } = parseResult.data;

    const user = await getUser(email);

    if (!user) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    // If successful, return the user info without password
    const token = await signToken(user.email);
    return NextResponse.json({ success: true, name: user.name, email: user.email, token }, { status: 200 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
