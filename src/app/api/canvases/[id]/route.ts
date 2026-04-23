import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canvas = await prisma.canvas.findFirst({
    where: {
      id,
      workspace: { members: { some: { userId: user.id } } },
    },
    include: {
      nodes: { include: { source: true } },
      connections: true,
    },
  });

  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ canvas });
}

export async function PATCH(
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

  const { isPublic } = await request.json();

  const updated = await prisma.canvas.update({
    where: { id },
    data: { isPublic },
  });

  return NextResponse.json({ canvas: updated });
}
