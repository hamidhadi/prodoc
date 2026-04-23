import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CanvasBoard } from "@/components/canvas/canvas-board";
import type { Node, Connection, NodeSource } from "@prisma/client";

type NodeWithSource = Node & { source: NodeSource | null };

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const canvas = await prisma.canvas.findFirst({
    where: { id, isPublic: true },
    include: {
      nodes: { include: { source: true } },
      connections: true,
    },
  });

  if (!canvas) notFound();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="font-medium text-sm">{canvas.name}</h1>
        <span className="text-xs text-muted-foreground">Read-only</span>
      </header>
      <div className="flex-1 min-h-0">
        <CanvasBoard
          canvasId={id}
          initialNodes={canvas.nodes as NodeWithSource[]}
          initialConnections={canvas.connections as Connection[]}
          figmaConnected={false}
          readonly
        />
      </div>
    </div>
  );
}
