"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FigmaToolbarProps {
  canvasId: string;
  figmaConnected: boolean;
  onNodesImported: () => void;
  onSynced: () => void;
}

export function FigmaToolbar({
  canvasId,
  figmaConnected,
  onNodesImported,
  onSynced,
}: FigmaToolbarProps) {
  const [mode, setMode] = useState<"idle" | "connect" | "import">("idle");
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(figmaConnected);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/integrations/figma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to connect");
      setLoading(false);
      return;
    }

    setConnected(true);
    setToken("");
    setMode("idle");
    setLoading(false);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/canvases/${canvasId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figmaUrl: url }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setLoading(false);
      return;
    }

    onNodesImported();
    setUrl("");
    setMode("idle");
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    const res = await fetch(`/api/canvases/${canvasId}/sync`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Sync failed");
    else onSynced();
    setSyncing(false);
  }

  if (!connected) {
    if (mode === "connect") {
      return (
        <form onSubmit={handleConnect} className="flex flex-col gap-2 bg-background border rounded-lg p-3 shadow-sm w-72">
          <Label className="text-xs font-medium">Figma Personal Access Token</Label>
          <p className="text-xs text-muted-foreground">
            Generate one at <strong>Figma → Settings → Security → Personal access tokens</strong>
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Input
            className="h-8 text-xs"
            placeholder="figd_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={loading || !token.trim()}>
              {loading ? "Connecting..." : "Connect"}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setMode("idle"); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      );
    }

    return (
      <Button size="sm" variant="outline" onClick={() => setMode("connect")}>
        Connect Figma
      </Button>
    );
  }

  if (mode === "import") {
    return (
      <form onSubmit={handleImport} className="flex items-center gap-2">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Input
          className="h-8 text-xs w-72"
          placeholder="Paste Figma file URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        <Button size="sm" type="submit" disabled={loading || !url.trim()}>
          {loading ? "Importing..." : "Import"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => { setMode("idle"); setError(null); }}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button size="sm" variant="outline" onClick={() => setMode("import")}>
        Import from Figma
      </Button>
      <Button size="sm" variant="ghost" onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync"}
      </Button>
    </div>
  );
}
