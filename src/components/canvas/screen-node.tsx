"use client";

import Image from "next/image";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const typeColors: Record<string, string> = {
  SCREEN: "bg-blue-50 border-blue-200",
  COMPONENT: "bg-purple-50 border-purple-200",
  STATE: "bg-amber-50 border-amber-200",
};

const typeBadgeColors: Record<string, string> = {
  SCREEN: "bg-blue-100 text-blue-700",
  COMPONENT: "bg-purple-100 text-purple-700",
  STATE: "bg-amber-100 text-amber-700",
};

export function ScreenNode({ data, selected }: NodeProps) {
  const label = data.label as string;
  const nodeType = data.nodeType as string;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const thumbnailUrl = metadata.thumbnailUrl as string | undefined;

  return (
    <div
      className={`w-full h-full rounded-lg border-2 flex flex-col overflow-hidden transition-shadow ${
        typeColors[nodeType] ?? "bg-gray-50 border-gray-200"
      } ${selected ? "shadow-lg ring-2 ring-offset-1 ring-foreground/20" : "shadow-sm"}`}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="px-2 py-1.5 flex items-center gap-1.5 border-b border-inherit bg-white/60 shrink-0">
        <span
          className={`text-[9px] font-medium px-1 py-0.5 rounded uppercase tracking-wide ${
            typeBadgeColors[nodeType] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {nodeType?.toLowerCase()}
        </span>
        <span className="text-xs font-medium truncate">{label}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 relative bg-white/40">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={label}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs opacity-40">
            no preview
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
