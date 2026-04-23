import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getAuthedCanvas(canvasId: string, userId: string) {
  return prisma.canvas.findFirst({
    where: { id: canvasId, workspace: { members: { some: { userId } } } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  const { id, connectionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getAuthedCanvas(id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { trigger, label } = await request.json();

  const connection = await prisma.connection.update({
    where: { id: connectionId, canvasId: id },
    data: {
      ...(trigger !== undefined && { trigger }),
      ...(label !== undefined && { label }),
    },
  });

  return NextResponse.json({ connection });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  const { id, connectionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getAuthedCanvas(id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.connection.delete({ where: { id: connectionId, canvasId: id } });

  return NextResponse.json({ success: true });
}
