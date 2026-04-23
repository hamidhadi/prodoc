import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canvas = await prisma.canvas.findFirst({
    where: { id, workspace: { members: { some: { userId: user.id } } } },
  });
  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { type, name, positionX, positionY, width, height, metadata } = await request.json();

  const node = await prisma.node.create({
    data: {
      canvasId: id,
      type: type ?? "SCREEN",
      name: name ?? "Untitled",
      positionX: positionX ?? 0,
      positionY: positionY ?? 0,
      width: width ?? 200,
      height: height ?? 150,
      metadata: metadata ?? {},
    },
  });

  return NextResponse.json({ node }, { status: 201 });
}
