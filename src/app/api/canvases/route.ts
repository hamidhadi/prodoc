import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    include: { workspace: { include: { canvases: { orderBy: { updatedAt: "desc" } } } } },
  });

  if (!member) {
    return NextResponse.json({ canvases: [] });
  }

  return NextResponse.json({ canvases: member.workspace.canvases });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Find or create workspace for this user
  let member = await prisma.member.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
  });

  if (!member) {
    const workspaceName = user.user_metadata?.workspace_name || "My Workspace";
    const workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    member = await prisma.member.findFirst({
      where: { userId: user.id, workspaceId: workspace.id },
      include: { workspace: true },
    });
  }

  const canvas = await prisma.canvas.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      workspaceId: member!.workspaceId,
    },
  });

  return NextResponse.json({ canvas }, { status: 201 });
}
