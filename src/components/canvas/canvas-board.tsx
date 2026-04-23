"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node as RFNode,
  type Edge,
  type Connection as RFConnection,
  type OnNodesChange,
  type NodeMouseHandler,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Node, Connection, NodeSource } from "@prisma/client";
import { ScreenNode } from "./screen-node";
import { ComponentNode } from "./component-node";
import { ConnectionEdge, EDGE_COLORS } from "./connection-edge";
import { FigmaToolbar } from "./figma-toolbar";
import { Button } from "@/components/ui/button";

type NodeWithSource = Node & { source: NodeSource | null };

interface CanvasBoardProps {
  canvasId: string;
  initialNodes: NodeWithSource[];
  initialConnections: Connection[];
  figmaConnected: boolean;
  readonly?: boolean;
}

const nodeTypes = { screen: ScreenNode, component: ComponentNode };
const edgeTypes = { connection: ConnectionEdge };

function toRFNode(node: NodeWithSource, dimmed = false): RFNode {
  const isComponent = node.type === "COMPONENT" || node.type === "STATE";
  return {
    id: node.id,
    type: isComponent ? "component" : "screen",
    position: { x: node.positionX, y: node.positionY },
    ...(node.parentId && { parentId: node.parentId, extent: "parent" as const }),
    draggable: !isComponent,
    data: { label: node.name, nodeType: node.type, metadata: node.metadata },
    style: { width: node.width, height: node.height, opacity: dimmed ? 0.25 : 1 },
  };
}

function toRFEdge(conn: Connection, canvasId: string, onUpdate: EdgeUpdateFn, onDelete: EdgeDeleteFn): Edge {
  return {
    id: conn.id,
    source: conn.sourceNodeId,
    target: conn.targetNodeId,
    type: "connection",
    animated: false,
    data: { trigger: conn.trigger, label: conn.label, canvasId, onUpdate, onDelete },
  };
}

type EdgeUpdateFn = (id: string, trigger: string, label: string) => void;
type EdgeDeleteFn = (id: string) => void;

export function CanvasBoard({
  canvasId,
  initialNodes,
  initialConnections,
  figmaConnected,
  readonly = false,
}: CanvasBoardProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    [...initialNodes]
      .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
      .map((n) => toRFNode(n))
  );

  const updateEdge: EdgeUpdateFn = useCallback((id, trigger, label) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, trigger, label } } : e
      )
    );
    fetch(`/api/canvases/${canvasId}/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger, label: label || null }),
    });
  }, [canvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteEdge: EdgeDeleteFn = useCallback((id) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    fetch(`/api/canvases/${canvasId}/connections/${id}`, { method: "DELETE" });
  }, [canvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialConnections.map((c) => toRFEdge(c, canvasId, updateEdge, deleteEdge))
  );

  const [adding, setAdding] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback((nodeId: string, x: number, y: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/canvases/${canvasId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX: x, positionY: y }),
      });
    }, 600);
  }, [canvasId]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    for (const change of changes) {
      if (change.type === "position" && change.position && !change.dragging) {
        scheduleSave(change.id, change.position.x, change.position.y);
      }
    }
  }, [onNodesChange, scheduleSave]);

  const onConnect = useCallback((params: RFConnection) => {
    setEdges((eds) => addEdge({ ...params, type: "connection", data: { trigger: "TAP", label: null, canvasId, onUpdate: updateEdge, onDelete: deleteEdge } }, eds));
    fetch(`/api/canvases/${canvasId}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceNodeId: params.source, targetNodeId: params.target }),
    })
      .then((r) => r.json())
      .then(({ connection }) => {
        if (!connection) return;
        setEdges((eds) =>
          eds.map((e) =>
            e.source === params.source && e.target === params.target && e.id !== connection.id
              ? { ...e, id: connection.id }
              : e
          )
        );
      });
  }, [canvasId, updateEdge, deleteEdge, setEdges]);

  // Flow path highlighting — click a node to highlight its outgoing path
  const onNodeClick: NodeMouseHandler = useCallback((_event, clickedNode) => {
    const reachable = new Set<string>();
    const queue = [clickedNode.id];
    while (queue.length) {
      const current = queue.shift()!;
      reachable.add(current);
      edges.forEach((e) => {
        if (e.source === current && !reachable.has(e.target)) queue.push(e.target);
      });
    }
    const isPath = reachable.size > 1;

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: { ...n.style, opacity: !isPath || reachable.has(n.id) ? 1 : 0.25 },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: isPath && reachable.has(e.source) && reachable.has(e.target),
      }))
    );
  }, [edges, setNodes, setEdges]);

  // Clear highlighting when clicking the canvas background
  const onPaneClick = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
    setEdges((eds) => eds.map((e) => ({ ...e, animated: false })));
  }, [setNodes, setEdges]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    if (readonly) return;
    const name = prompt("Rename node:", node.data.label as string);
    if (!name?.trim() || name === node.data.label) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: name.trim() } } : n))
    );
    fetch(`/api/canvases/${canvasId}/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  }, [canvasId, readonly, setNodes]);

  const onNodesDelete = useCallback((deleted: RFNode[]) => {
    for (const node of deleted) {
      fetch(`/api/canvases/${canvasId}/nodes/${node.id}`, { method: "DELETE" });
    }
  }, [canvasId]);

  const addNode = useCallback(() => {
    const name = prompt("Node name:");
    if (!name?.trim()) return;
    setAdding(true);
    const offset = nodes.length * 20;
    fetch(`/api/canvases/${canvasId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type: "SCREEN", positionX: 100 + offset, positionY: 100 + offset }),
    })
      .then((r) => r.json())
      .then(({ node }) => {
        if (!node) return;
        setNodes((nds) => [...nds, toRFNode({ ...node, source: null })]);
      })
      .finally(() => setAdding(false));
  }, [canvasId, nodes.length, setNodes]);

  const handleNodesImported = useCallback(() => {
    window.location.reload();
  }, []);

  const handleSynced = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={readonly ? undefined : handleNodesChange}
      onEdgesChange={readonly ? undefined : onEdgesChange}
      onConnect={readonly ? undefined : onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDoubleClick={readonly ? undefined : onNodeDoubleClick}
      onNodesDelete={readonly ? undefined : onNodesDelete}
      fitView
      deleteKeyCode={readonly ? null : "Backspace"}
      nodesDraggable={!readonly}
      nodesConnectable={!readonly}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls />
      <MiniMap />
      {!readonly && (
        <>
          <Panel position="top-left">
            <FigmaToolbar
              canvasId={canvasId}
              figmaConnected={figmaConnected}
              onNodesImported={handleNodesImported}
              onSynced={handleSynced}
            />
          </Panel>
          <Panel position="top-right">
            <Button size="sm" onClick={addNode} disabled={adding}>
              {adding ? "Adding..." : "+ Add node"}
            </Button>
          </Panel>
        </>
      )}
    </ReactFlow>
  );
}
