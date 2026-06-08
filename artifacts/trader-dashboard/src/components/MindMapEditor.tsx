import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";

export interface MindMapData {
  nodes: Node[];
  edges: Edge[];
}

export function isMindMapData(v: unknown): v is MindMapData {
  return !!v && typeof v === "object" && Array.isArray((v as MindMapData).nodes) && (v as MindMapData).nodes.length > 0;
}

let _seq = 0;
const newId = () => `n${Date.now().toString(36)}_${_seq++}`;

// ─── Editable editor ──────────────────────────────────────────────────────────
function EditorInner({ initial, onChange }: { initial: MindMapData | null; onChange: (d: MindMapData) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial?.edges ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  // Keep the parent in sync without depending on onChange identity.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current({ nodes, edges });
  }, [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  const addNode = useCallback(() => {
    const id = newId();
    setNodes((ns) =>
      ns.concat({
        id,
        position: { x: 80 + Math.random() * 280, y: 60 + Math.random() * 200 },
        data: { label: "Nuovo nodo" },
      }),
    );
    setSelected(id);
    setLabel("Nuovo nodo");
  }, [setNodes]);

  const applyLabel = useCallback(
    (value: string) => {
      setLabel(value);
      if (!selected) return;
      setNodes((ns) => ns.map((n) => (n.id === selected ? { ...n, data: { ...n.data, label: value } } : n)));
    },
    [selected, setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setNodes((ns) => ns.filter((n) => n.id !== selected));
    setEdges((es) => es.filter((e) => e.source !== selected && e.target !== selected));
    setSelected(null);
    setLabel("");
  }, [selected, setNodes, setEdges]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addNode}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40"
        >
          <Plus className="w-3.5 h-3.5" /> Nodo
        </button>
        <input
          className="tl-input flex-1 min-w-[8rem] py-1.5 text-xs"
          placeholder={selected ? "Etichetta del nodo selezionato" : "Seleziona un nodo per rinominarlo"}
          value={label}
          disabled={!selected}
          onChange={(e) => applyLabel(e.target.value)}
        />
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selected}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-red-400 hover:border-red-400/40 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" /> Elimina
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        Trascina i nodi per posizionarli. Collega trascinando dal bordo di un nodo a un altro.
      </p>
      <div className="h-[55vh] w-full overflow-hidden rounded-lg border border-border/40 bg-[#0a1120]">
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_e, n) => {
            setSelected(n.id);
            setLabel(String(n.data?.label ?? ""));
          }}
          onPaneClick={() => setSelected(null)}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-[#0d1527]" />
        </ReactFlow>
      </div>
    </div>
  );
}

export function MindMapEditor(props: { initial: MindMapData | null; onChange: (d: MindMapData) => void }) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

// ─── Read-only viewer ─────────────────────────────────────────────────────────
export function MindMapView({ data }: { data: MindMapData }) {
  return (
    <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-border/40 bg-[#0a1120]">
      <ReactFlowProvider>
        <ReactFlow
          colorMode="dark"
          nodes={data.nodes ?? []}
          edges={data.edges ?? []}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
