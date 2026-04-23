"use client";

import { useState, useCallback } from "react";
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "@xyflow/react";

const TRIGGERS = ["TAP", "HOVER", "SUBMIT", "SUCCESS", "ERROR", "SWIPE"] as const;
type Trigger = typeof TRIGGERS[number];

const TRIGGER_STYLES: Record<Trigger, string> = {
  TAP:     "bg-gray-100 text-gray-700 hover:bg-gray-200",
  HOVER:   "bg-blue-100 text-blue-700 hover:bg-blue-200",
  SUBMIT:  "bg-purple-100 text-purple-700 hover:bg-purple-200",
  SUCCESS: "bg-green-100 text-green-700 hover:bg-green-200",
  ERROR:   "bg-red-100 text-red-700 hover:bg-red-200",
  SWIPE:   "bg-orange-100 text-orange-700 hover:bg-orange-200",
};

export const EDGE_COLORS: Record<Trigger, string> = {
  TAP:     "#94a3b8",
  HOVER:   "#60a5fa",
  SUBMIT:  "#a78bfa",
  SUCCESS: "#4ade80",
  ERROR:   "#f87171",
  SWIPE:   "#fb923c",
};

function arrowPoints(tx: number, ty: number, pos: Position): string {
  const s = 7;
  const h = 10;
  switch (pos) {
    case Position.Top:    return `${tx},${ty} ${tx-s},${ty-h} ${tx+s},${ty-h}`;
    case Position.Bottom: return `${tx},${ty} ${tx-s},${ty+h} ${tx+s},${ty+h}`;
    case Position.Left:   return `${tx},${ty} ${tx-h},${ty-s} ${tx-h},${ty+s}`;
    case Position.Right:  return `${tx},${ty} ${tx+h},${ty-s} ${tx+h},${ty+s}`;
    default:              return `${tx},${ty} ${tx-s},${ty-h} ${tx+s},${ty-h}`;
  }
}

interface ConnectionEdgeData {
  trigger: Trigger;
  label?: string;
  canvasId: string;
  onUpdate: (id: string, trigger: Trigger, label: string) => void;
  onDelete: (id: string) => void;
}

export function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as ConnectionEdgeData;
  const trigger = edgeData?.trigger ?? "TAP";
  const [open, setOpen] = useState(false);
  const [localTrigger, setLocalTrigger] = useState<Trigger>(trigger);
  const [localLabel, setLocalLabel] = useState(edgeData?.label ?? "");

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const handleSave = useCallback(() => {
    edgeData.onUpdate(id, localTrigger, localLabel);
    setOpen(false);
  }, [id, localTrigger, localLabel, edgeData]);

  const handleDelete = useCallback(() => {
    edgeData.onDelete(id);
    setOpen(false);
  }, [id, edgeData]);

  const color = EDGE_COLORS[trigger];
  const strokeWidth = selected ? 2.5 : 1.5;

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <polygon points={arrowPoints(targetX, targetY, targetPosition)} fill={color} />

      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -100%) translate(${labelX}px,${labelY}px)` }}
          className="absolute pointer-events-auto nopan"
        >
          {/* Trigger badge — always visible */}
          <button
            onClick={() => setOpen((o) => !o)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide transition-colors ${TRIGGER_STYLES[trigger]}`}
          >
            {trigger}
          </button>

          {/* Popover */}
          {open && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg p-3 w-52 flex flex-col gap-2">
              {/* Trigger selector */}
              <div className="grid grid-cols-3 gap-1">
                {TRIGGERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setLocalTrigger(t)}
                    className={`text-[9px] font-semibold px-1 py-1 rounded uppercase tracking-wide transition-colors
                      ${localTrigger === t ? TRIGGER_STYLES[t] + " ring-1 ring-current" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Label input */}
              <input
                className="text-xs border rounded px-2 py-1 w-full outline-none focus:ring-1 focus:ring-gray-300"
                placeholder="Label (optional)"
                value={localLabel}
                onChange={(e) => setLocalLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />

              <div className="flex gap-1">
                <button
                  onClick={handleSave}
                  className="flex-1 text-xs bg-foreground text-background rounded px-2 py-1 hover:opacity-80"
                >
                  Save
                </button>
                <button
                  onClick={handleDelete}
                  className="text-xs bg-red-50 text-red-600 rounded px-2 py-1 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
