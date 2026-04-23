import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getFigmaThumbnails } from "@/lib/figma/client";
import { uploadThumbnail } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: "figma" } },
  });
  if (!integration) {
    return NextResponse.json({ error: "Figma not connected" }, { status: 400 });
  }

  // Find all figma-sourced nodes in this canvas
  const sources = await prisma.nodeSource.findMany({
    where: { adapter: "figma", node: { canvasId: id } },
    include: { node: true },
  });

  if (sources.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Stale = no thumbnail, or still pointing at a Figma CDN URL (not yet in our storage)
  const stale = sources.filter((s) => {
    const meta = s.node.metadata as Record<string, unknown>;
    const url = meta.thumbnailUrl as string | undefined;
    return !url || !url.startsWith(supabaseUrl);
  });

  if (stale.length === 0) {
    return NextResponse.json({ synced: 0, cached: sources.length });
  }

  // Group stale nodes by file key to minimise API calls
  const byFile = new Map<string, typeof stale>();
  for (const s of stale) {
    const fileKey = (s.externalMeta as Record<string, string>).fileKey;
    if (!byFile.has(fileKey)) byFile.set(fileKey, []);
    byFile.get(fileKey)!.push(s);
  }

  let synced = 0;
  for (const [fileKey, fileSources] of byFile) {
    const nodeIds = fileSources.map((s) => s.externalId);
    const figmaThumbnails = await getFigmaThumbnails(integration.accessToken, fileKey, nodeIds);

    await Promise.all(
      fileSources.map(async (s) => {
        const figmaUrl = figmaThumbnails[s.externalId];
        if (!figmaUrl) return null;

        // Upload to Supabase Storage for a permanent URL
        const storagePath = `${id}/${s.externalId}.png`;
        const thumbnailUrl =
          (await uploadThumbnail(supabaseAdmin, storagePath, figmaUrl)) ?? figmaUrl;

        return prisma.node.update({
          where: { id: s.nodeId },
          data: {
            metadata: {
              ...(s.node.metadata as object),
              thumbnailUrl,
            },
          },
        });
      })
    );

    synced += fileSources.length;
  }

  return NextResponse.json({ synced, cached: sources.length - stale.length });
}
