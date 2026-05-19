import { NextResponse } from "next/server";
import { getUser } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { email, password } = data;

    if (!email || !password) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const user = await getUser(email);

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.password && user.password !== password) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }

    // If successful, return the user info without password
    return NextResponse.json({ success: true, name: user.name, email: user.email }, { status: 200 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
