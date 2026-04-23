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

  const { sourceNodeId, targetNodeId, trigger, label } = await request.json();

  const connection = await prisma.connection.create({
    data: {
      canvasId: id,
      sourceNodeId,
      targetNodeId,
      trigger: trigger ?? "TAP",
      label: label ?? null,
    },
  });

  return NextResponse.json({ connection }, { status: 201 });
}
