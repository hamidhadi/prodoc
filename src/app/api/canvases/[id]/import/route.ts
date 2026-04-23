import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getFigmaFile, getFigmaThumbnails, getFigmaFramesChildren, extractFileKey } from "@/lib/figma/client";
import { uploadThumbnail } from "@/lib/storage";
import { NextResponse } from "next/server";

const CANVAS_NODE_WIDTH = 240;
const NODES_PER_ROW = 4;
const GAP = 40;

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

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: "figma" } },
  });
  if (!integration) {
    return NextResponse.json({ error: "Figma not connected" }, { status: 400 });
  }

  const { figmaUrl } = await request.json();
  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return NextResponse.json({ error: "Invalid Figma URL" }, { status: 400 });
  }

  const { frames } = await getFigmaFile(integration.accessToken, fileKey);
  if (frames.length === 0) {
    return NextResponse.json({ error: "No frames found in this file" }, { status: 400 });
  }

  // Find which frames are already imported so we skip both the DB write and the thumbnail fetch
  const existingSources = await prisma.nodeSource.findMany({
    where: { adapter: "figma", externalId: { in: frames.map((f) => f.id) } },
    select: { externalId: true },
  });
  const alreadyImported = new Set(existingSources.map((s) => s.externalId));
  const newFrames = frames.filter((f) => !alreadyImported.has(f.id));

  if (newFrames.length === 0) {
    return NextResponse.json({ nodes: [], imported: 0 });
  }

  // Fetch temporary thumbnail URLs from Figma for new frames only
  const figmaThumbnails = await getFigmaThumbnails(
    integration.accessToken,
    fileKey,
    newFrames.map((f) => f.id)
  );

  // Get existing node count to offset new nodes
  const existingCount = await prisma.node.count({ where: { canvasId: id } });

  const createdNodes = await Promise.all(
    newFrames.map(async (frame, index) => {
      const totalIndex = existingCount + index;
      const col = totalIndex % NODES_PER_ROW;
      const row = Math.floor(totalIndex / NODES_PER_ROW);
      const aspectRatio = frame.height / frame.width;
      const nodeHeight = Math.round(CANVAS_NODE_WIDTH * aspectRatio);

      // Upload to Supabase Storage for a permanent URL — falls back to Figma URL if upload fails
      const figmaUrl = figmaThumbnails[frame.id] ?? null;
      const storagePath = `${id}/${frame.id}.png`;
      const thumbnailUrl = figmaUrl
        ? (await uploadThumbnail(supabaseAdmin, storagePath, figmaUrl)) ?? figmaUrl
        : null;

      const node = await prisma.node.create({
        data: {
          canvasId: id,
          type: "SCREEN",
          name: frame.name,
          positionX: col * (CANVAS_NODE_WIDTH + GAP),
          positionY: row * (nodeHeight + GAP + 32), // +32 for header
          width: CANVAS_NODE_WIDTH,
          height: nodeHeight,
          metadata: {
            thumbnailUrl,
            figmaWidth: frame.width,
            figmaHeight: frame.height,
          },
          source: {
            create: {
              adapter: "figma",
              externalId: frame.id,
              externalMeta: { fileKey, frameId: frame.id },
            },
          },
        },
        include: { source: true },
      });

      return node;
    })
  );

  // Batch-fetch children for all newly created frame nodes (one API call).
  // This is non-fatal — if it fails, frames are still returned successfully.
  let componentCount = 0;
  try {
    const framesChildren = await getFigmaFramesChildren(
      integration.accessToken,
      fileKey,
      createdNodes.map((n) => n.source!.externalId)
    );

    const SKIP_TYPES = new Set(["VECTOR", "STAR", "POLYGON", "LINE", "BOOLEAN_OPERATION"]);
    const MIN_DISPLAY_PX = 20;

    const componentPromises = createdNodes.flatMap((frameNode) => {
      const figmaFrameId = frameNode.source!.externalId;
      const { absoluteBoundingBox: frameBB, children } =
        framesChildren[figmaFrameId] ?? { absoluteBoundingBox: null, children: [] };
      if (!frameBB) return [];

      const figmaWidth = (frameNode.metadata as Record<string, number>).figmaWidth;
      const scale = CANVAS_NODE_WIDTH / figmaWidth;

      return children
        .filter((child) => {
          if (SKIP_TYPES.has(child.type)) return false;
          const bb = child.absoluteBoundingBox;
          if (!bb) return false;
          if (bb.width * scale < MIN_DISPLAY_PX || bb.height * scale < MIN_DISPLAY_PX) return false;
          if (bb.x < frameBB.x || bb.y < frameBB.y) return false;
          if (bb.x + bb.width > frameBB.x + frameBB.width) return false;
          if (bb.y + bb.height > frameBB.y + frameBB.height) return false;
          return true;
        })
        .map((child) => {
          const bb = child.absoluteBoundingBox!;
          return prisma.node.create({
            data: {
              canvasId: id,
              type: "COMPONENT",
              name: child.name,
              positionX: (bb.x - frameBB.x) * scale,
              positionY: (bb.y - frameBB.y) * scale + 32, // 32px for the frame header
              width: bb.width * scale,
              height: bb.height * scale,
              parentId: frameNode.id,
              metadata: { figmaType: child.type },
              source: {
                create: {
                  adapter: "figma",
                  externalId: child.id,
                  externalMeta: { fileKey, frameId: figmaFrameId },
                },
              },
            },
          });
        });
    });

    const componentNodes = await Promise.all(componentPromises);
    componentCount = componentNodes.length;
  } catch (err) {
    console.error("Component fetch failed (non-fatal):", err);
  }

  return NextResponse.json({
    nodes: createdNodes,
    imported: createdNodes.length,
    components: componentCount,
  });
}
