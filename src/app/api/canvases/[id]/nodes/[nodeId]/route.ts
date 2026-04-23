import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id, nodeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canvas = await prisma.canvas.findFirst({
    where: { id, workspace: { members: { some: { userId: user.id } } } },
  });
  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, positionX, positionY, width, height, metadata } = body;

  const node = await prisma.node.update({
    where: { id: nodeId, canvasId: id },
    data: {
      ...(name !== undefined && { name }),
      ...(positionX !== undefined && { positionX }),
      ...(positionY !== undefined && { positionY }),
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
      ...(metadata !== undefined && { metadata }),
    },
  });

  return NextResponse.json({ node });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id, nodeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canvas = await prisma.canvas.findFirst({
    where: { id, workspace: { members: { some: { userId: user.id } } } },
  });
  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete children first to satisfy the self-referential FK constraint
  await prisma.node.deleteMany({ where: { parentId: nodeId, canvasId: id } });
  await prisma.node.delete({ where: { id: nodeId, canvasId: id } });

  return NextResponse.json({ success: true });
}
