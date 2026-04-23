"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function ComponentNode({ data, selected }: NodeProps) {
  const label = data.label as string;

  return (
    <div
      className={`w-full h-full rounded transition-all group
        ${selected
          ? "border-2 border-violet-500 bg-violet-500/10"
          : "border border-dashed border-transparent hover:border-violet-400 hover:bg-violet-400/8"
        }`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Label — visible on hover or select */}
      <div className={`absolute -top-5 left-0 text-[9px] font-medium px-1 py-0.5 rounded whitespace-nowrap pointer-events-none
        bg-violet-500 text-white transition-opacity
        ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        {label}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
