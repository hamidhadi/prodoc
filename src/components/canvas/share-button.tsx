"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  canvasId: string;
  isPublic: boolean;
}

export function ShareButton({ canvasId, isPublic: initialIsPublic }: ShareButtonProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function togglePublic() {
    setLoading(true);
    const next = !isPublic;
    await fetch(`/api/canvases/${canvasId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    setIsPublic(next);
    setLoading(false);

    if (next) copyLink();
  }

  function copyLink() {
    const url = `${window.location.origin}/share/${canvasId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isPublic) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={copyLink}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={togglePublic}
          disabled={loading}
          className="text-xs"
        >
          Unpublish
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={togglePublic} disabled={loading} className="text-xs">
      {loading ? "Publishing..." : "Share"}
    </Button>
  );
}
