import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import {
  BrainCircuit, Sparkles, TrendingUp, TrendingDown, MinusCircle,
  ThumbsUp, ThumbsDown, Loader2, Save, Plus, Trash2, Power, Radar,
  Upload, FileText, Image as ImageIcon, AlertCircle, BookOpen, Network, CheckCircle2,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChartReplay from "@/components/ChartReplay";
import { useToast } from "@/hooks/use-toast";
import { useBackground } from "@/contexts/BackgroundContext";
import { getPairLabel } from "@workspace/pair-catalog";
import { API_BASE as API, apiFetch, apiUpload } from "@/lib/apiFetch";

// Upload multipart: NON impostiamo Content-Type, così il browser aggiunge il boundary.
const ALL_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "XAU/USD", "US30", "NAS100", "SPX500",
  "BTC/USD", "ETH/USD",
];
const TIMEFRAMES = ["M15", "M30", "H1", "H4", "D1", "W1"];

// ─── Types (i campi numeric arrivano come stringhe da Drizzle) ──────────────────
interface BrainStrategy { id: number; name: string; rules: string; active: boolean; }
interface BrainAnalysis {
  id: number; symbol: string; interval: string; mode: string; imageRef: string | null;
  direction: "long" | "short" | "wait"; confidence: string; reasoning: string;
  entryPrice: string | null; stopLoss: string | null; takeProfit: string | null;
  context: string | null; zonesJson: string | null;
  createdAt: string;
}
interface Zone { min?: number | null; max?: number | null; price?: number | null; rr?: number | null; rationale?: string; }
interface Zones {
  entryZone: { min?: number | null; max?: number | null } | null;
  stopLossZones: Zone[];
  takeProfitZones: Zone[];
}
interface KnowledgeSource {
  id: number; kind: "text" | "pdf" | "image"; title: string;
  status: "processing" | "ready" | "error"; error: string | null;
  fileRef: string | null; createdAt: string;
}
interface GraphStats { nodesByType: Record<string, number>; totalNodes: number; totalEdges: number; }
interface ScanConfig {
  enabled: boolean; pairs: string; timeframes: string;
  intervalMinutes: number; minConfidence: string; strategyId: number | null;
}

function DirectionBadge({ d }: { d: string }) {
  const map: Record<string, { c: string; bg: string; icon: typeof TrendingUp; label: string }> = {
    long: { c: "text-green-400", bg: "bg-green-500/15", icon: TrendingUp, label: "LONG" },
    short: { c: "text-red-400", bg: "bg-red-500/15", icon: TrendingDown, label: "SHORT" },
    wait: { c: "text-yellow-400", bg: "bg-yellow-500/15", icon: MinusCircle, label: "ATTENDI" },
  };
  const m = map[d] ?? map.wait;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold ${m.c} ${m.bg}`}>
      <Icon className="w-4 h-4" /> {m.label}
    </span>
  );
}

// ─── Editor strategia ───────────────────────────────────────────────────────────
function StrategySection({
  strategies, activeId, onChangeActive,
}: { strategies: BrainStrategy[]; activeId: number | null; onChangeActive: (id: number) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [rules, setRules] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => apiFetch<BrainStrategy>(`${API}/brain/strategies`, {
      method: "POST", body: JSON.stringify({ name: name.trim(), rules: rules.trim(), active: true }),
    }),
    onSuccess: () => {
      toast({ title: "Strategia salvata" });
      setName(""); setRules("");
      qc.invalidateQueries({ queryKey: ["brain-strategies"] });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/brain/strategies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brain-strategies"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" /> La tua strategia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {strategies.length > 0 && (
          <div className="space-y-1.5">
            {strategies.map((s) => (
              <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                activeId === s.id ? "border-primary/50 bg-primary/5" : "border-border/40"
              }`}>
                <button onClick={() => onChangeActive(s.id)} className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {activeId === s.id && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    {s.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.rules}</div>
                </button>
                <button onClick={() => deleteMutation.mutate(s.id)} className="text-muted-foreground hover:text-red-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-1">
          <Input placeholder="Nome strategia (es. Breakout + FVG)" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Descrivi le regole: condizioni di ingresso, conferme, gestione SL/TP, contesto di mercato che il cervello deve cercare nel grafico..."
            className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
          />
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || !rules.trim() || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salva strategia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helper per le zone (entry/SL/TP) ───────────────────────────────────────────
function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toString();
}
function rangeText(min?: number | null, max?: number | null): string {
  if (min != null && max != null) return min === max ? fmtNum(min) : `${fmtNum(min)} – ${fmtNum(max)}`;
  return fmtNum(min ?? max);
}
function zoneText(z: Zone): string {
  if (z.price != null) return fmtNum(z.price);
  return rangeText(z.min, z.max);
}
function parseZones(a: BrainAnalysis): Zones | null {
  if (!a.zonesJson) return null;
  try {
    const z = JSON.parse(a.zonesJson) as Partial<Zones>;
    return {
      entryZone: z.entryZone ?? null,
      stopLossZones: z.stopLossZones ?? [],
      takeProfitZones: z.takeProfitZones ?? [],
    };
  } catch { return null; }
}

// ─── Card del segnale + feedback ────────────────────────────────────────────────
function SignalCard({ a }: { a: BrainAnalysis }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: (vote: "up" | "down") => apiFetch(`${API}/brain/feedback`, {
      method: "POST", body: JSON.stringify({ analysisId: a.id, vote, note: note.trim() || undefined }),
    }),
    onSuccess: () => {
      toast({ title: "Feedback registrato", description: "Il cervello ne terrà conto nelle prossime analisi." });
      setNote(""); setShowNote(false);
      qc.invalidateQueries({ queryKey: ["brain-analyses"] });
    },
  });

  const zones = parseZones(a);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DirectionBadge d={a.direction} />
          <span className="text-xs font-mono text-muted-foreground">{a.symbol} · {a.interval}</span>
          {a.mode === "autonomous" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">auto</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">Confidenza</div>
          <div className="text-sm font-bold font-mono">{Math.round(Number(a.confidence))}%</div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
        <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, Number(a.confidence))}%` }} />
      </div>

      {a.context && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2.5">{a.context}</p>
      )}

      {a.reasoning && a.reasoning !== "—" && (
        <p className="text-sm text-foreground/90 leading-relaxed">{a.reasoning}</p>
      )}

      {a.direction !== "wait" && (zones ? (
        <div className="space-y-2">
          {zones.entryZone && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-yellow-400 w-14 shrink-0">ENTRY</span>
              <span className="text-xs font-mono font-bold">{rangeText(zones.entryZone.min, zones.entryZone.max)}</span>
            </div>
          )}
          {zones.stopLossZones.length > 0 && (
            <div className="rounded-lg bg-red-500/10 px-2.5 py-1.5 space-y-1">
              <div className="text-[10px] font-bold text-red-400">STOP LOSS</div>
              {zones.stopLossZones.map((z, i) => (
                <div key={i} className="text-xs leading-snug">
                  <span className="font-mono font-bold">{zoneText(z)}</span>
                  {z.rationale && <span className="text-muted-foreground"> — {z.rationale}</span>}
                </div>
              ))}
            </div>
          )}
          {zones.takeProfitZones.length > 0 && (
            <div className="rounded-lg bg-green-500/10 px-2.5 py-1.5 space-y-1">
              <div className="text-[10px] font-bold text-green-400">TAKE PROFIT</div>
              {zones.takeProfitZones.map((z, i) => (
                <div key={i} className="text-xs leading-snug">
                  <span className="font-mono font-bold">{zoneText(z)}</span>
                  {z.rr != null && <span className="text-green-400/80"> · R:R {z.rr}</span>}
                  {z.rationale && <span className="text-muted-foreground"> — {z.rationale}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-yellow-500/10 p-2">
            <div className="text-[10px] text-yellow-400">ENTRY</div>
            <div className="text-xs font-mono font-bold">{fmtNum(a.entryPrice != null ? Number(a.entryPrice) : null)}</div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-2">
            <div className="text-[10px] text-red-400">SL</div>
            <div className="text-xs font-mono font-bold">{fmtNum(a.stopLoss != null ? Number(a.stopLoss) : null)}</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-2">
            <div className="text-[10px] text-green-400">TP</div>
            <div className="text-xs font-mono font-bold">{fmtNum(a.takeProfit != null ? Number(a.takeProfit) : null)}</div>
          </div>
        </div>
      ))}

      {a.imageRef && (
        <img src={a.imageRef} alt="grafico analizzato" className="w-full rounded-lg border border-border/40" />
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" className="text-green-400 border-green-500/30"
          onClick={() => feedbackMutation.mutate("up")} disabled={feedbackMutation.isPending}>
          <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Giusto
        </Button>
        <Button variant="outline" size="sm" className="text-red-400 border-red-500/30"
          onClick={() => setShowNote((v) => !v)} disabled={feedbackMutation.isPending}>
          <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Sbagliato
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {new Date(a.createdAt).toLocaleString("it-IT")}
        </span>
      </div>

      {showNote && (
        <div className="space-y-2">
          <Input placeholder="Cosa avrebbe dovuto vedere? (correzione)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="w-full" onClick={() => feedbackMutation.mutate("down")} disabled={feedbackMutation.isPending}>
            Invia correzione
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Impostazioni scansione autonoma ────────────────────────────────────────────
function ScanSettings({ strategies }: { strategies: BrainStrategy[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: cfg } = useQuery({
    queryKey: ["brain-scan-config"],
    queryFn: () => apiFetch<ScanConfig>(`${API}/brain/scan-config`),
  });

  const parseArr = (s: string | undefined): string[] => {
    if (!s) return [];
    try { return JSON.parse(s); } catch { return []; }
  };

  const selectedPairs = parseArr(cfg?.pairs);
  const selectedTfs = parseArr(cfg?.timeframes);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<{ enabled: boolean; pairs: string[]; timeframes: string[]; intervalMinutes: number; minConfidence: number }>) =>
      apiFetch<ScanConfig>(`${API}/brain/scan-config`, { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-scan-config"] });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const togglePair = (p: string) => {
    const sym = p.replace("/", "");
    const next = selectedPairs.includes(sym) ? selectedPairs.filter((x) => x !== sym) : [...selectedPairs, sym];
    saveMutation.mutate({ pairs: next });
  };
  const toggleTf = (tf: string) => {
    const next = selectedTfs.includes(tf) ? selectedTfs.filter((x) => x !== tf) : [...selectedTfs, tf];
    saveMutation.mutate({ timeframes: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="w-4 h-4 text-primary" /> Scansione autonoma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Stato</span>
          <Button
            size="sm"
            variant={cfg?.enabled ? "default" : "outline"}
            onClick={() => saveMutation.mutate({ enabled: !cfg?.enabled })}
          >
            <Power className="w-3.5 h-3.5 mr-1.5" /> {cfg?.enabled ? "Attiva" : "Disattiva"}
          </Button>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Coppie monitorate</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PAIRS.map((p) => {
              const on = selectedPairs.includes(p.replace("/", ""));
              return (
                <button key={p} onClick={() => togglePair(p)}
                  className={`px-2 py-1 rounded text-[11px] font-bold border ${
                    on ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border/40"
                  }`}>{p}</button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Timeframe</div>
          <div className="flex flex-wrap gap-1.5">
            {TIMEFRAMES.map((tf) => {
              const on = selectedTfs.includes(tf);
              return (
                <button key={tf} onClick={() => toggleTf(tf)}
                  className={`px-2 py-1 rounded text-[11px] font-bold border ${
                    on ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border/40"
                  }`}>{tf}</button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ogni (min)</div>
            <Input type="number" min={5} defaultValue={cfg?.intervalMinutes ?? 30}
              onBlur={(e) => saveMutation.mutate({ intervalMinutes: Number(e.target.value) || 30 })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Confidenza min %</div>
            <Input type="number" min={0} max={100} defaultValue={cfg ? Math.round(Number(cfg.minConfidence)) : 70}
              onBlur={(e) => saveMutation.mutate({ minConfidence: Number(e.target.value) || 70 })} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Il cervello scansiona le coppie scelte e ti invia una notifica push quando trova un setup
          conforme alla strategia attiva con confidenza sufficiente.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Mappa di conoscenza del cervello (statistiche del grafo) ───────────────────
const NODE_TYPE_LABELS: Record<string, string> = {
  concept: "concetti", rule: "regole", pattern: "pattern", level: "livelli",
  instrument: "strumenti", timeframe: "timeframe", setup: "setup", risk: "regole SL/TP",
};

function BrainMap({ strategyId }: { strategyId: number | null }) {
  const { data } = useQuery({
    queryKey: ["brain-graph", strategyId],
    queryFn: () => apiFetch<GraphStats>(`${API}/brain/graph?strategyId=${strategyId ?? ""}`),
    refetchInterval: 30_000,
  });

  if (!data || data.totalNodes === 0) {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Il cervello non ha ancora conoscenze su questa strategia. Carica materiale (testo, PDF, immagini)
        per addestrarlo: verrà trasformato in una mappa di concetti, pattern, livelli e regole.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
        <Network className="w-3.5 h-3.5" /> Conoscenza del cervello
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(data.nodesByType).map(([t, c]) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/50">
            {c} {NODE_TYPE_LABELS[t] ?? t}
          </span>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1.5">
        {data.totalNodes} nodi · {data.totalEdges} relazioni
      </div>
    </div>
  );
}

// ─── Sezione "Materiale di addestramento" (upload → grafo di conoscenza) ─────────
function SourceStatus({ s }: { s: KnowledgeSource }) {
  if (s.status === "processing") {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />;
  }
  if (s.status === "error") {
    return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  }
  return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />;
}

function KnowledgeSection({ strategyId }: { strategyId: number | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const { data: sources = [] } = useQuery({
    queryKey: ["brain-knowledge", strategyId],
    queryFn: () => apiFetch<KnowledgeSource[]>(`${API}/brain/knowledge?strategyId=${strategyId ?? ""}`),
    refetchInterval: (q) =>
      (q.state.data as KnowledgeSource[] | undefined)?.some((s) => s.status === "processing") ? 4000 : false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["brain-knowledge", strategyId] });
    qc.invalidateQueries({ queryKey: ["brain-graph", strategyId] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (strategyId != null) fd.append("strategyId", String(strategyId));
      fd.append("title", file.name);
      return apiUpload<KnowledgeSource>(`${API}/brain/knowledge/upload`, fd);
    },
    onSuccess: (s) => {
      invalidate();
      if (s.status === "error") {
        toast({ title: "Materiale non appreso", description: s.error ?? undefined, variant: "destructive" });
      } else {
        toast({ title: "Materiale appreso", description: s.title });
      }
    },
    onError: (e: Error) => toast({ title: "Upload fallito", description: e.message, variant: "destructive" }),
  });

  const textMutation = useMutation({
    mutationFn: () => apiFetch<KnowledgeSource>(`${API}/brain/knowledge`, {
      method: "POST",
      body: JSON.stringify({ strategyId: strategyId ?? undefined, title: title.trim() || undefined, content: text.trim() }),
    }),
    onSuccess: (s) => {
      setTitle(""); setText("");
      invalidate();
      toast({
        title: s.status === "error" ? "Testo non appreso" : "Testo appreso",
        description: s.status === "error" ? (s.error ?? undefined) : undefined,
        variant: s.status === "error" ? "destructive" : undefined,
      });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/brain/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const onDrop = useCallback((accepted: File[]) => {
    for (const f of accepted) uploadMutation.mutate(f);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [".pdf"] },
    multiple: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-primary" /> Materiale di addestramento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <BrainMap strategyId={strategyId} />

        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-5 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/40"
          }`}
        >
          <input {...getInputProps()} />
          {uploadMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Upload className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-xs text-muted-foreground">
            Trascina <span className="font-medium text-foreground">immagini o PDF</span> qui, o clicca per scegliere
          </div>
        </div>

        <div className="space-y-2">
          <Input placeholder="Titolo (opzionale)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Incolla regole, appunti, descrizioni di setup, esempi storici, gestione del rischio…"
            className="w-full min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => textMutation.mutate()}
            disabled={!text.trim() || textMutation.isPending}
          >
            {textMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Aggiungi testo al cervello
          </Button>
        </div>

        {sources.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {sources.map((s) => {
              const Icon = s.kind === "image" ? ImageIcon : FileText;
              return (
                <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{s.title}</div>
                    {s.status === "error" && s.error && (
                      <div className="text-[10px] text-red-400 truncate">{s.error}</div>
                    )}
                  </div>
                  <SourceStatus s={s} />
                  <button
                    onClick={() => deleteMutation.mutate(s.id)}
                    className="text-muted-foreground hover:text-red-400 shrink-0"
                    title="Elimina"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pagina ─────────────────────────────────────────────────────────────────────
export default function Brain() {
  const { toast } = useToast();
  const { selectedPairs: userPairs } = useBackground();

  const pairOptions = useMemo(() => {
    if (userPairs.length === 0) return ALL_PAIRS;
    const supported = new Set(ALL_PAIRS);
    const labels = userPairs.map((p) => getPairLabel(p)).filter((l) => supported.has(l));
    const advanced = ALL_PAIRS.filter((p) => !labels.includes(p));
    return labels.length > 0 ? [...labels, ...advanced] : ALL_PAIRS;
  }, [userPairs]);

  const [pair, setPair] = useState(pairOptions[0] ?? "EUR/USD");
  const [interval, setInterval] = useState("H1");
  const [activeStrategyId, setActiveStrategyId] = useState<number | null>(null);

  const { data: strategies = [] } = useQuery({
    queryKey: ["brain-strategies"],
    queryFn: () => apiFetch<BrainStrategy[]>(`${API}/brain/strategies`),
  });

  const effectiveStrategyId = activeStrategyId
    ?? strategies.find((s) => s.active)?.id
    ?? strategies[0]?.id
    ?? null;

  const qc = useQueryClient();

  const { data: analyses = [] } = useQuery({
    queryKey: ["brain-analyses"],
    queryFn: () => apiFetch<BrainAnalysis[]>(`${API}/brain/analyses?limit=20`),
    refetchInterval: 60_000,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiFetch<BrainAnalysis>(`${API}/brain/analyze`, {
      method: "POST",
      body: JSON.stringify({ symbol: pair, interval, strategyId: effectiveStrategyId ?? undefined }),
    }),
    onSuccess: () => {
      toast({ title: "Analisi completata" });
      qc.invalidateQueries({ queryKey: ["brain-analyses"] });
    },
    onError: (e: Error) => toast({ title: "Analisi fallita", description: e.message, variant: "destructive" }),
  });

  return (
    <PageLayout>
      <PageHeader
        title="Brain AI"
        subtitle="Il cervello vision che guarda i grafici e applica la tua strategia"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 mt-2">
        {/* Colonna principale: grafico + analisi */}
        <div className="space-y-4 min-w-0 overflow-hidden">
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                <select value={pair} onChange={(e) => setPair(e.target.value)}
                  className="h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-2 text-sm font-mono">
                  {pairOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {TIMEFRAMES.map((tf) => (
                    <button key={tf} onClick={() => setInterval(tf)}
                      className={`shrink-0 px-2 py-1 rounded text-[11px] font-bold border ${
                        interval === tf ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-transparent"
                      }`}>{tf}</button>
                  ))}
                </div>
                <Button
                  className="w-full sm:w-auto sm:ml-auto"
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending || !effectiveStrategyId}
                >
                  {analyzeMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <BrainCircuit className="w-4 h-4 mr-2" />}
                  Analizza ora
                </Button>
              </div>

              {!effectiveStrategyId && (
                <p className="text-xs text-yellow-400">Crea prima una strategia per poter analizzare.</p>
              )}

              <ChartReplay key={`${pair}-${interval}`} symbol={pair} interval={interval} />
            </CardContent>
          </Card>

          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Analisi recenti
            </h3>
            {analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna analisi ancora. Premi "Analizza ora".</p>
            ) : (
              <div className="space-y-3">
                {analyses.map((a) => <SignalCard key={a.id} a={a} />)}
              </div>
            )}
          </div>
        </div>

        {/* Colonna laterale: strategia + scansione */}
        <div className="space-y-4 min-w-0">
          <StrategySection
            strategies={strategies}
            activeId={effectiveStrategyId}
            onChangeActive={setActiveStrategyId}
          />
          <KnowledgeSection strategyId={effectiveStrategyId} />
          <ScanSettings strategies={strategies} />
        </div>
      </div>
    </PageLayout>
  );
}
