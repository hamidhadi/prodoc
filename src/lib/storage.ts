import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "thumbnails";

/**
 * Downloads an image from a remote URL and uploads it to Supabase Storage.
 * Returns the permanent public URL, or null if either step fails.
 */
export async function uploadThumbnail(
  supabase: SupabaseClient,
  path: string,
  sourceUrl: string
): Promise<string | null> {
  const res = await fetch(sourceUrl);
  if (!res.ok) return null;

  const buffer = await res.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (error) {
    console.error("Storage upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
