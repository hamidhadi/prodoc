import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CanvasBoard } from "@/components/canvas/canvas-board";
import { ShareButton } from "@/components/canvas/share-button";
import type { Node, Connection, NodeSource } from "@prisma/client";

type NodeWithSource = Node & { source: NodeSource | null };

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [canvas, figmaIntegration] = await Promise.all([
    prisma.canvas.findFirst({
      where: {
        id,
        workspace: { members: { some: { userId: user.id } } },
      },
      include: {
        nodes: { include: { source: true } },
        connections: true,
      },
    }),
    prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "figma" } },
    }),
  ]);

  if (!canvas) notFound();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-2 flex items-center gap-4 shrink-0">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </Link>
        <h1 className="font-medium text-sm flex-1">{canvas.name}</h1>
        <ShareButton canvasId={id} isPublic={canvas.isPublic} />
      </header>
      <div className="flex-1 min-h-0">
        <CanvasBoard
          canvasId={id}
          initialNodes={canvas.nodes as NodeWithSource[]}
          initialConnections={canvas.connections as Connection[]}
          figmaConnected={!!figmaIntegration}
        />
      </div>
    </div>
  );
}
