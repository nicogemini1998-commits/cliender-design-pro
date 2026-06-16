/**
 * Canvas Mode — página principal del lienzo infinito.
 *
 * Usa @xyflow/react (React Flow v12+) en tema oscuro, con:
 *  - Background con grilla de puntos #1F1F1F sobre #0A0A0A
 *  - 3 nodos personalizados (ContextPrompt, Cinematographer, RenderOutput)
 *  - Edge personalizada con partículas viajeras (AnimatedFlowEdge)
 *  - MiniMap y Controls con paleta Dark Premium
 *
 * Cliente porque React Flow usa hooks de cliente.
 */
"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CinematographerNode } from "@/components/canvas/nodes/CinematographerNode";
import { ContextPromptNode } from "@/components/canvas/nodes/ContextPromptNode";
import { RenderOutputNode } from "@/components/canvas/nodes/RenderOutputNode";
import { AnimatedFlowEdge } from "@/components/canvas/edges/AnimatedFlowEdge";

const nodeTypes: NodeTypes = {
  contextPrompt: ContextPromptNode,
  cinematographer: CinematographerNode,
  renderOutput: RenderOutputNode,
};

const edgeTypes: EdgeTypes = {
  animatedFlow: AnimatedFlowEdge,
};

// --- estado inicial -------------------------------------------------------

const initialNodes: Node[] = [
  {
    id: "ctx-1",
    type: "contextPrompt",
    position: { x: 80, y: 160 },
    data: {
      status: "done",
      prompt: "Campaña editorial otoño 2026 · línea premium · referencias adjuntas",
    },
  },
  {
    id: "cine-1",
    type: "cinematographer",
    position: { x: 480, y: 120 },
    data: {
      status: "running",
      modelId: "auto",
      aspectRatio: "16:9",
      guidance: 7.5,
    },
  },
  {
    id: "render-1",
    type: "renderOutput",
    position: { x: 900, y: 160 },
    data: { status: "idle" },
  },
];

const initialEdges: Edge[] = [
  { id: "e-ctx-cine", source: "ctx-1", target: "cine-1", type: "animatedFlow", data: { active: true } },
  { id: "e-cine-render", source: "cine-1", target: "render-1", type: "animatedFlow", data: { active: false } },
];

// --- página ---------------------------------------------------------------

function CanvasInner() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((es) => addEdge({ ...conn, type: "animatedFlow", data: { active: false } }, es)),
    [],
  );

  // Inyecta `onChange` en cada nodo para que pueda mutar su data parcialmente
  const wiredNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onChange: (patch: Record<string, unknown>) =>
        setNodes((ns) => ns.map((m) => (m.id === n.id ? { ...m, data: { ...m.data, ...patch } } : m))),
    },
  }));

  return (
    <div className="h-screen w-full bg-[#0A0A0A]">
      <ReactFlow
        nodes={wiredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "animatedFlow" }}
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.4}
          color="#1F1F1F"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(10,10,10,0.85)"
          nodeColor={() => "#262626"}
          nodeStrokeColor={() => "#8B5CF6"}
          style={{
            background: "#0F0F0F",
            border: "1px solid #262626",
            borderRadius: 8,
          }}
        />
        <Controls
          className="!bg-[#0F0F0F] !border !border-[#262626] !rounded-lg overflow-hidden
                     [&_button]:!bg-transparent [&_button]:!border-b [&_button]:!border-[#1F1F1F]
                     [&_button]:!text-gray-400 hover:[&_button]:!text-[#8B5CF6]"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
