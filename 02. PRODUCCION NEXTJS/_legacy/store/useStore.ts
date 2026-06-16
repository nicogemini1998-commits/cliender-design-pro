/**
 * useStore.ts — Estado global con Zustand.
 *
 * Centraliza:
 *  - Estado de React Flow (nodes, edges + reducers oficiales)
 *  - Bandera global `isProcessing` (consumida por AnimatedEdge para reaccionar)
 *  - `agentLogs[]` streameado vía SSE desde el backend FastAPI
 *  - Inputs/outputs del flujo (currentPrompt, finalMediaUrl, finalModelId)
 *
 * Doctrina:
 *  - El store NO conoce la red. Las acciones `startGeneration`/`appendLog`
 *    son llamadas por SupercomputerPanel que es quien abre el EventSource.
 *  - El tipado de los logs es estricto para que el panel pueda pintar el
 *    estado de cada agente (running | done | error) con el color correcto.
 */
import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type AgentName =
  | "MasterDirector"
  | "Scriptwriter"
  | "Cinematographer"
  | "Production"
  | "Critic"
  | "VisionAuditor";

export type AgentLogStatus = "running" | "done" | "error" | "info";

export interface AgentLog {
  id: string;
  agentName: AgentName | "System";
  message: string;
  status: AgentLogStatus;
  /** epoch ms — usado para ordenar/animar */
  timestamp: number;
  /** payload opcional (ej. {modelId, mediaKind}) */
  meta?: Record<string, unknown>;
}

export interface StreamingFrame {
  agentName?: AgentName | "System";
  message: string;
  status?: AgentLogStatus;
  meta?: Record<string, unknown>;
  /** El backend emite `final: true` en el último frame con la URL del artefacto */
  final?: boolean;
  finalMediaUrl?: string;
  finalModelId?: string;
}

// ---------------------------------------------------------------------------
// Style Vault — Moodboards
// ---------------------------------------------------------------------------

export interface MoodboardImage {
  id: string;
  url: string;          // http(s) o data:base64
  width?: number;
  height?: number;
}

export interface StyleManifest {
  moodboardId: string;
  colorPalette: string[];
  lightingStyle: string;
  cameraLensFeel: string;
  characterTraits: string[];
  compositionRules: string[];
  moodKeywords: string[];
  masterStylePrompt: string;
  negativePrompt: string;
  consistencyScore: number;   // 0—1
}

export type AuditStatus = "idle" | "auditing" | "ready" | "error";

export interface Moodboard {
  id: string;
  name: string;
  images: MoodboardImage[];
  manifest: StyleManifest | null;
  auditStatus: AuditStatus;
  locked: boolean;
  /** epoch ms cuándo se inició la última auditoría — para el escáner UI */
  auditStartedAt?: number;
}

// ---------------------------------------------------------------------------
// Slice de React Flow
// ---------------------------------------------------------------------------

interface FlowSlice {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  /** Actualiza un slice parcial del `data` de un nodo concreto. */
  patchNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Slice del Supercomputer
// ---------------------------------------------------------------------------

interface SupercomputerSlice {
  isProcessing: boolean;
  agentLogs: AgentLog[];
  currentPrompt: string;
  finalMediaUrl: string | null;
  finalModelId: string | null;

  setPrompt: (prompt: string) => void;
  startGeneration: () => void;
  finishGeneration: (opts?: { mediaUrl?: string; modelId?: string }) => void;
  abortGeneration: (reason?: string) => void;
  appendLog: (frame: StreamingFrame) => void;
  clearLogs: () => void;
}

// ---------------------------------------------------------------------------
// Slice del Style Vault (Moodboards)
// ---------------------------------------------------------------------------

interface MoodboardSlice {
  moodboards: Moodboard[];
  activeMoodboardId: string | null;   // el que está locked (gobierna las gens)

  createMoodboard: (name?: string) => string;
  renameMoodboard: (id: string, name: string) => void;
  deleteMoodboard: (id: string) => void;
  addImagesToMoodboard: (id: string, images: MoodboardImage[]) => void;
  removeImageFromMoodboard: (boardId: string, imageId: string) => void;
  setLock: (id: string, locked: boolean) => void;       // solo uno puede estar locked
  /** Marca como "auditando" y dispara la llamada al backend (caller la inyecta). */
  beginAudit: (id: string) => void;
  setManifest: (id: string, manifest: StyleManifest) => void;
  setAuditStatus: (id: string, status: AuditStatus) => void;
  /** Devuelve el moodboard activo si existe. */
  getActiveMoodboard: () => Moodboard | undefined;
}

// ---------------------------------------------------------------------------
// Estado inicial del lienzo (3 nodos pre-cableados)
// ---------------------------------------------------------------------------

const INITIAL_NODES: Node[] = [
  {
    id: "ctx-1",
    type: "contextPrompt",
    position: { x: 80, y: 180 },
    data: {
      status: "idle",
      prompt: "",
    },
  },
  {
    id: "cine-1",
    type: "cinematographer",
    position: { x: 500, y: 140 },
    data: {
      status: "idle",
      modelId: "auto",
      aspectRatio: "16:9",
      guidance: 7.5,
    },
  },
  {
    id: "render-1",
    type: "renderOutput",
    position: { x: 940, y: 180 },
    data: { status: "idle" },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e-ctx-cine",    source: "ctx-1",  target: "cine-1",   type: "animatedFlow" },
  { id: "e-cine-render", source: "cine-1", target: "render-1", type: "animatedFlow" },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type Store = FlowSlice & SupercomputerSlice & MoodboardSlice;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const useStore = create<Store>((set, get) => ({
  // --- Flow -----------------------------------------------------------------
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,

  onNodesChange: (changes: NodeChange[]) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes: EdgeChange[]) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection: Connection) =>
    set((s) => ({
      edges: addEdge({ ...connection, type: "animatedFlow" }, s.edges),
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  patchNodeData: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    })),

  // --- Supercomputer --------------------------------------------------------
  isProcessing: false,
  agentLogs: [],
  currentPrompt: "",
  finalMediaUrl: null,
  finalModelId: null,

  setPrompt: (prompt) => set({ currentPrompt: prompt }),

  startGeneration: () => {
    const { currentPrompt, patchNodeData } = get();
    set({
      isProcessing: true,
      agentLogs: [
        {
          id: uid(),
          agentName: "System",
          status: "info",
          message: `Petición recibida: "${currentPrompt.slice(0, 80)}${
            currentPrompt.length > 80 ? "…" : ""
          }"`,
          timestamp: Date.now(),
        },
      ],
      finalMediaUrl: null,
      finalModelId: null,
    });
    // Refleja en el canvas: el nodo de entrada se ilumina, los demás resetean
    patchNodeData("ctx-1",    { status: "done", prompt: currentPrompt });
    patchNodeData("cine-1",   { status: "running" });
    patchNodeData("render-1", { status: "idle" });
  },

  finishGeneration: ({ mediaUrl, modelId } = {}) => {
    const { patchNodeData } = get();
    set((s) => ({
      isProcessing: false,
      finalMediaUrl: mediaUrl ?? s.finalMediaUrl,
      finalModelId:  modelId  ?? s.finalModelId,
    }));
    patchNodeData("cine-1",   { status: "done", modelId: modelId ?? "auto" });
    patchNodeData("render-1", { status: "done", url: mediaUrl, modelId });
  },

  abortGeneration: (reason) => {
    const { patchNodeData } = get();
    set((s) => ({
      isProcessing: false,
      agentLogs: [
        ...s.agentLogs,
        {
          id: uid(),
          agentName: "System",
          status: "error",
          message: reason ?? "Generación cancelada.",
          timestamp: Date.now(),
        },
      ],
    }));
    patchNodeData("cine-1",   { status: "error" });
    patchNodeData("render-1", { status: "error" });
  },

  appendLog: (frame) => {
    const { patchNodeData, finishGeneration } = get();
    const log: AgentLog = {
      id: uid(),
      agentName: frame.agentName ?? "System",
      message: frame.message,
      status: frame.status ?? "info",
      timestamp: Date.now(),
      meta: frame.meta,
    };
    set((s) => ({ agentLogs: [...s.agentLogs, log] }));

    // Espejo del estado en el canvas (LEDs de los nodos)
    if (frame.agentName === "Cinematographer") {
      patchNodeData("cine-1", {
        status: frame.status ?? "running",
        ...(frame.meta?.modelId ? { modelId: frame.meta.modelId } : {}),
        ...(frame.meta?.prompt  ? { prompt: frame.meta.prompt   } : {}),
      });
    }
    if (frame.agentName === "Production") {
      patchNodeData("render-1", {
        status: frame.status ?? "running",
        ...(frame.meta?.modelId ? { modelId: frame.meta.modelId } : {}),
      });
    }

    if (frame.final) {
      finishGeneration({
        mediaUrl: frame.finalMediaUrl,
        modelId:  frame.finalModelId,
      });
    }
  },

  clearLogs: () => set({ agentLogs: [] }),

  // --- Moodboards / Style Vault --------------------------------------------
  moodboards: [],
  activeMoodboardId: null,

  createMoodboard: (name) => {
    const id = uid();
    const mb: Moodboard = {
      id,
      name: name?.trim() || `Style #${Math.floor(Math.random() * 900 + 100)}`,
      images: [],
      manifest: null,
      auditStatus: "idle",
      locked: false,
    };
    set((s) => ({ moodboards: [...s.moodboards, mb] }));
    return id;
  },

  renameMoodboard: (id, name) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) => (m.id === id ? { ...m, name } : m)),
    })),

  deleteMoodboard: (id) =>
    set((s) => ({
      moodboards: s.moodboards.filter((m) => m.id !== id),
      activeMoodboardId: s.activeMoodboardId === id ? null : s.activeMoodboardId,
    })),

  addImagesToMoodboard: (id, images) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) => {
        if (m.id !== id) return m;
        const existing = new Set(m.images.map((i) => i.id));
        const merged = [...m.images, ...images.filter((i) => !existing.has(i.id))];
        return { ...m, images: merged };
      }),
    })),

  removeImageFromMoodboard: (boardId, imageId) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) =>
        m.id === boardId ? { ...m, images: m.images.filter((i) => i.id !== imageId) } : m,
      ),
    })),

  setLock: (id, locked) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) => ({
        ...m,
        // Sólo uno puede estar locked a la vez
        locked: m.id === id ? locked : locked ? false : m.locked,
      })),
      activeMoodboardId: locked ? id : s.activeMoodboardId === id ? null : s.activeMoodboardId,
    })),

  beginAudit: (id) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) =>
        m.id === id ? { ...m, auditStatus: "auditing", auditStartedAt: Date.now() } : m,
      ),
    })),

  setManifest: (id, manifest) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) =>
        m.id === id ? { ...m, manifest, auditStatus: "ready" } : m,
      ),
    })),

  setAuditStatus: (id, status) =>
    set((s) => ({
      moodboards: s.moodboards.map((m) => (m.id === id ? { ...m, auditStatus: status } : m)),
    })),

  getActiveMoodboard: () => {
    const { moodboards, activeMoodboardId } = get();
    return moodboards.find((m) => m.id === activeMoodboardId);
  },
}));
