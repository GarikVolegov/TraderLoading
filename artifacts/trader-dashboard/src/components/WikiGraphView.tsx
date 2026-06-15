import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import { Network } from "lucide-react";

export interface WikiGraphNode {
  id: number;
  label: string;
  type: string;
  communityId: number | null;
}

export interface WikiGraphEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  relation: string;
}

interface Props {
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  selectedNodeId?: number | null;
  onNodeClick?: (nodeId: number) => void;
}

// Obsidian-style palette: nodes are tinted by their community so clusters read
// as colored neighborhoods. Falls back to a hash of the node type when a node
// hasn't been assigned to a community yet.
const PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
  "#06b6d4",
  "#f97316",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function colorFor(communityId: number | null, type: string): string {
  const key = communityId ?? hashString(type);
  return PALETTE[Math.abs(key) % PALETTE.length];
}

type SimNode = SimulationNodeDatum & { id: number };

// Run the d3-force simulation synchronously (no animation loop) to get a stable
// layout, then hand static x/y to React Flow which provides zoom/pan/drag.
function buildLayout(nodes: WikiGraphNode[], edges: WikiGraphEdge[]): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(nodes.map((node) => node.id));
  const simNodes: SimNode[] = nodes.map((node) => ({ id: node.id }));
  const simLinks = edges
    .filter((edge) => ids.has(edge.fromNodeId) && ids.has(edge.toNodeId) && edge.fromNodeId !== edge.toNodeId)
    .map((edge) => ({ source: edge.fromNodeId, target: edge.toNodeId }));

  forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, { source: number; target: number }>(simLinks)
        .id((node) => node.id)
        .distance(110)
        .strength(0.35),
    )
    .force("charge", forceManyBody().strength(-260))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(38))
    .stop()
    .tick(160);

  const pos = new Map(simNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));

  const flowNodes: Node[] = nodes.map((node) => {
    const color = colorFor(node.communityId, node.type);
    return {
      id: String(node.id),
      position: pos.get(node.id) ?? { x: 0, y: 0 },
      data: { label: node.label },
      style: {
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        color: "#e2e8f0",
        fontSize: 11,
        fontWeight: 600,
        padding: "6px 10px",
        maxWidth: 180,
      },
    };
  });

  const flowEdges: Edge[] = edges
    .filter((edge) => ids.has(edge.fromNodeId) && ids.has(edge.toNodeId) && edge.fromNodeId !== edge.toNodeId)
    .map((edge) => ({
      id: String(edge.id),
      source: String(edge.fromNodeId),
      target: String(edge.toNodeId),
      label: edge.relation,
      style: { stroke: "#475569", strokeWidth: 1 },
      labelStyle: { fill: "#94a3b8", fontSize: 9 },
    }));

  return { nodes: flowNodes, edges: flowEdges };
}

function GraphInner({ nodes, edges, selectedNodeId, onNodeClick }: Props) {
  // Re-run the layout only when the SET of nodes/edges changes (by id), not on
  // every poll refetch (react-query hands back fresh array refs each time).
  const sig = useMemo(
    () => `${nodes.map((n) => n.id).join(",")}|${edges.map((e) => e.id).join(",")}`,
    [nodes, edges],
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => buildLayout(nodesRef.current, edgesRef.current), [sig]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(layout.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setFlowNodes(layout.nodes);
    setFlowEdges(layout.edges);
  }, [layout, setFlowNodes, setFlowEdges]);

  // Highlight the selected node without disturbing dragged positions.
  const styledNodes = useMemo(
    () =>
      flowNodes.map((node) =>
        node.id === String(selectedNodeId)
          ? { ...node, style: { ...node.style, boxShadow: "0 0 0 2px #22c55e" } }
          : node,
      ),
    [flowNodes, selectedNodeId],
  );

  return (
    <ReactFlow
      colorMode="dark"
      nodes={styledNodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_event, node) => onNodeClick?.(Number(node.id))}
      nodesConnectable={false}
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-[#0d1527]" />
    </ReactFlow>
  );
}

export function WikiGraphView({ nodes, edges, selectedNodeId, onNodeClick }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-[360px] flex-col items-center justify-center rounded-lg border border-border/40 bg-[#0a1120] text-center text-sm text-muted-foreground">
        <Network className="mb-2 h-8 w-8 opacity-40" />
        Nessun nodo nel grafo. Carica materiali per costruire la tua mappa di conoscenza.
      </div>
    );
  }
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-border/40 bg-[#0a1120]">
      <ReactFlowProvider>
        <GraphInner
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onNodeClick={onNodeClick}
        />
      </ReactFlowProvider>
    </div>
  );
}
