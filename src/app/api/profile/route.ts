import { NextResponse } from "next/server";
import { getUser, saveUser } from "@/lib/users";
import { verifyToken, hashPassword } from "@/lib/crypto";
import type { LotteryXUser } from "@/lib/users";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const email = await verifyToken(token);
  if (!email) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Remove password before returning
  const { password, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const email = await verifyToken(token);
  if (!email) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  try {
    const data = await request.json();
    
    // Update allowed fields
    if (data.drawPreference !== undefined) user.drawPreference = data.drawPreference;
    if (data.notificationEmail !== undefined) user.notificationEmail = data.notificationEmail;
    if (data.notificationPush !== undefined) user.notificationPush = data.notificationPush;
    if (data.favorites !== undefined) user.favorites = data.favorites;
    if (data.tickets !== undefined) user.tickets = data.tickets;
    if (data.name !== undefined) user.name = data.name;
    if (data.photo !== undefined) user.photo = data.photo;
    if (data.generationHistory !== undefined) user.generationHistory = data.generationHistory;
    
    if (data.password) {
      user.password = await hashPassword(data.password);
    }
    
    if (data.newGeneration) {
      if (!user.generationHistory) {
        user.generationHistory = [];
      }
      user.generationHistory.push({
        id: Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString(),
        ...data.newGeneration
      });
      // Keep only the last 20 generation records to avoid blowing up DB size
      if (user.generationHistory.length > 20) {
        user.generationHistory = user.generationHistory.slice(-20);
      }
    }
    
    await saveUser(user);
    
    const { password, ...safeUser } = user;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
