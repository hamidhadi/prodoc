const FIGMA_API = "https://api.figma.com/v1";

function headers(token: string) {
  return { "X-Figma-Token": token };
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface FigmaChildNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null;
  children?: FigmaChildNode[];
}

export async function getFigmaFile(
  token: string,
  fileKey: string
): Promise<{ name: string; frames: FigmaFrame[] }> {
  const res = await fetch(`${FIGMA_API}/files/${fileKey}?depth=2`, {
    headers: headers(token),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    throw new Error(`Figma rate limit exceeded. Please wait ${seconds} seconds and try again.`);
  }

  if (!res.ok) {
    throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const frames: FigmaFrame[] = [];

  for (const page of data.document.children ?? []) {
    for (const node of page.children ?? []) {
      if (node.type === "FRAME" || node.type === "COMPONENT") {
        frames.push({
          id: node.id,
          name: node.name,
          width: node.absoluteBoundingBox?.width ?? 375,
          height: node.absoluteBoundingBox?.height ?? 812,
        });
      } else if (node.type === "SECTION") {
        // Sections are containers — look inside them for frames
        for (const child of node.children ?? []) {
          if (child.type === "FRAME" || child.type === "COMPONENT") {
            frames.push({
              id: child.id,
              name: child.name,
              width: child.absoluteBoundingBox?.width ?? 375,
              height: child.absoluteBoundingBox?.height ?? 812,
            });
          }
        }
      }
    }
  }

  return { name: data.name, frames };
}

export async function getFigmaFrameChildren(
  token: string,
  fileKey: string,
  frameId: string
): Promise<FigmaChildNode[]> {
  const res = await fetch(`${FIGMA_API}/files/${fileKey}/nodes?ids=${frameId}`, {
    headers: headers(token),
  });

  if (!res.ok) throw new Error(`Figma API error: ${res.status}`);

  const data = await res.json();
  const node = data.nodes[frameId]?.document;
  return node?.children ?? [];
}

export interface FigmaFrameWithChildren {
  absoluteBoundingBox: { x: number; y: number; width: number; height: number } | null;
  children: FigmaChildNode[];
}

/**
 * Batch-fetches children for multiple frames in a single Figma API call.
 * Returns a map of frameId → { absoluteBoundingBox, children }.
 */
export async function getFigmaFramesChildren(
  token: string,
  fileKey: string,
  frameIds: string[]
): Promise<Record<string, FigmaFrameWithChildren>> {
  if (frameIds.length === 0) return {};

  const res = await fetch(
    `${FIGMA_API}/files/${fileKey}/nodes?ids=${frameIds.join(",")}`,
    { headers: headers(token) }
  );

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    throw new Error(`Figma rate limit exceeded. Please wait ${seconds} seconds and try again.`);
  }

  if (!res.ok) throw new Error(`Figma API error: ${res.status}`);

  const data = await res.json();
  const result: Record<string, FigmaFrameWithChildren> = {};

  for (const frameId of frameIds) {
    const doc = data.nodes[frameId]?.document;
    result[frameId] = {
      absoluteBoundingBox: doc?.absoluteBoundingBox ?? null,
      children: doc?.children ?? [],
    };
  }

  return result;
}

const THUMBNAIL_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 3;

async function fetchThumbnailBatch(
  token: string,
  fileKey: string,
  ids: string
): Promise<Record<string, string>> {
  const url = `${FIGMA_API}/images/${fileKey}?ids=${ids}&format=png&scale=0.25`;
  let delay = 2000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: headers(token) });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES - 1) {
        const retryAfter = res.headers.get("Retry-After");
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw new Error(`Figma rate limit exceeded. Please wait ${seconds} seconds and try again.`);
      }
      // Respect Retry-After if present, otherwise exponential backoff
      const retryAfter = res.headers.get("Retry-After");
      delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * 2;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!res.ok) throw new Error(`Figma images API error: ${res.status}`);

    const data = await res.json();
    return data.images ?? {};
  }

  return {};
}

export async function getFigmaThumbnails(
  token: string,
  fileKey: string,
  nodeIds: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  for (let i = 0; i < nodeIds.length; i += THUMBNAIL_BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + THUMBNAIL_BATCH_SIZE);
    const images = await fetchThumbnailBatch(token, fileKey, batch.join(","));
    Object.assign(results, images);

    if (i + THUMBNAIL_BATCH_SIZE < nodeIds.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}

export function extractFileKey(input: string): string | null {
  const match = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]+$/.test(input.trim())) return input.trim();
  return null;
}
