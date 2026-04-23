import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json();
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "figma" } },
    update: { accessToken: token.trim() },
    create: { userId: user.id, provider: "figma", accessToken: token.trim() },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.integration.deleteMany({
    where: { userId: user.id, provider: "figma" },
  });

  return NextResponse.json({ success: true });
}
