import { useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Download,
  Upload,
  Copy,
  Pencil,
  Trash2,
  RefreshCw,
  FileJson,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import {
  pickChartSettings,
  type BacktestChartTemplate,
  type ChartIndicator,
} from "../../../../../contracts/backtestChart";
import type { ReplayEngine } from "./useReplayEngine";

// ─── Utility di Esportazione & Download JSON ──────────────────────────────────
export function downloadJsonFile(data: unknown, filename: string) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Errore durante l'esportazione del file JSON:", error);
  }
}

export function exportAllTemplatesAsJson(templates: BacktestChartTemplate[]) {
  const payload = {
    app: "AUREUS_PROTOCOL",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      settings: pickChartSettings(t.settings),
      indicators: t.indicators,
    })),
  };
  const dateStr = new Date().toISOString().split("T")[0];
  downloadJsonFile(payload, `aureus-modelli-grafico-${dateStr}.json`);
}

export function exportSingleTemplateAsJson(template: BacktestChartTemplate) {
  const payload = {
    app: "AUREUS_PROTOCOL",
    version: 1,
    exportedAt: new Date().toISOString(),
    template: {
      id: template.id,
      name: template.name,
      settings: pickChartSettings(template.settings),
      indicators: template.indicators,
    },
  };
  const safeName = template.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  downloadJsonFile(payload, `aureus-modello-${safeName}.json`);
}

export async function parseAndValidateTemplateFile(
  file: File,
): Promise<{ success: boolean; templates?: BacktestChartTemplate[]; error?: string }> {
  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object") {
      return { success: false, error: "Formato JSON non valido o file vuoto." };
    }

    const imported: BacktestChartTemplate[] = [];

    // Caso 1: Esportazione multipla ({ templates: [...] })
    if (Array.isArray(raw.templates)) {
      for (const item of raw.templates) {
        if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
          imported.push({
            id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
            name: item.name.slice(0, 80).trim(),
            settings: pickChartSettings(item.settings ?? {}),
            indicators: Array.isArray(item.indicators) ? (item.indicators as ChartIndicator[]) : [],
          });
        }
      }
    }
    // Caso 2: Esportazione singola ({ template: { ... } })
    else if (raw.template && typeof raw.template === "object" && typeof raw.template.name === "string") {
      imported.push({
        id: typeof raw.template.id === "string" && raw.template.id ? raw.template.id : crypto.randomUUID(),
        name: raw.template.name.slice(0, 80).trim(),
        settings: pickChartSettings(raw.template.settings ?? {}),
        indicators: Array.isArray(raw.template.indicators) ? (raw.template.indicators as ChartIndicator[]) : [],
      });
    } else {
      return {
        success: false,
        error: "Il file non contiene modelli AUREUS riconosciuti. Verifica che sia un file .json esportato da AUREUS.",
      };
    }

    if (imported.length === 0) {
      return { success: false, error: "Nessun modello valido trovato all'interno del file." };
    }

    return { success: true, templates: imported };
  } catch (err) {
    return { success: false, error: "Impossibile leggere o analizzare il file JSON selezionato." };
  }
}

// ─── Componente Barra di Telemetria Cloud ──────────────────────────────────────
export function CloudSyncStatusWidget({
  status,
  onRetry,
  onResolveConflict,
}: {
  status: "loading" | "saved" | "saving" | "offline" | "pending" | "error" | "conflict" | "local";
  onRetry: () => void;
  onResolveConflict: (choice: "local" | "remote") => void;
}) {
  const { isSignedIn } = useAuth();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: "rgba(197, 160, 89, 0.06)",
        border: "1px solid rgba(197, 160, 89, 0.2)",
        fontSize: 11,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {status === "conflict" ? (
          <AlertTriangle size={13} style={{ color: "#ef4444" }} />
        ) : status === "saving" ? (
          <RefreshCw size={13} style={{ color: "#C5A059", animation: "spin 1s linear infinite" }} />
        ) : !isSignedIn ? (
          <CloudOff size={13} style={{ color: "#94a3b8" }} />
        ) : (
          <Cloud size={13} style={{ color: status === "saved" ? "#10b981" : "#C5A059" }} />
        )}

        <span style={{ color: "#e2e8f0" }}>
          {status === "conflict"
            ? "Conflitto sincronizzazione multi-dispositivo"
            : status === "saving"
              ? "Sincronizzazione Cloud in corso…"
              : status === "saved"
                ? "Sincronizzato con l'Account AUREUS"
                : status === "pending"
                  ? "Modifiche pronte per il Cloud"
                  : status === "offline"
                    ? "Offline · Modifiche salvate in locale"
                    : status === "error"
                      ? "Sincronizzazione Cloud non riuscita"
                      : !isSignedIn
                        ? "Dispositivo locale · Accedi per sincronizzare"
                        : "Sincronizzazione attiva"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {status === "conflict" ? (
          <>
            <button
              type="button"
              className="btm-toggle"
              style={{ fontSize: 10, padding: "2px 6px" }}
              onClick={() => onResolveConflict("local")}
            >
              Mantieni locali
            </button>
            <button
              type="button"
              className="btm-toggle"
              style={{ fontSize: 10, padding: "2px 6px" }}
              onClick={() => onResolveConflict("remote")}
            >
              Usa Cloud
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btm-text-button"
            style={{ fontSize: 10, color: "#C5A059", display: "flex", alignItems: "center", gap: 4 }}
            onClick={onRetry}
            title="Forza sincronizzazione con il server"
          >
            <RefreshCw size={10} />
            <span>Sincronizza ora</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modale Gestione Completa Modelli Cloud ────────────────────────────────────
export function CloudTemplateManagerModal({
  isOpen,
  onClose,
  engine,
}: {
  isOpen: boolean;
  onClose: () => void;
  engine: ReplayEngine;
}) {
  const { chartPreferences, setSettings, setIndicators } = engine;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  if (!isOpen) return null;

  const rawTemplates = chartPreferences.preferences.templates;
  const templates = rawTemplates && rawTemplates.length > 0 ? rawTemplates : [];

  const updateTemplates = (next: BacktestChartTemplate[]) => {
    chartPreferences.update((prev) => ({ ...prev, templates: next }));
  };

  const handleApply = (tpl: BacktestChartTemplate) => {
    setIndicators(tpl.indicators.map((c) => ({ ...c })));
    setSettings({ ...engine.settings, ...pickChartSettings(tpl.settings) });
    toast({
      title: "Modello Applicato",
      description: `Il modello "${tpl.name}" è ora attivo sul grafico.`,
    });
    onClose();
  };

  const handleDuplicate = (tpl: BacktestChartTemplate) => {
    if (templates.length >= 50) {
      toast({
        title: "Limite Raggiunto",
        description: "Puoi salvare un massimo di 50 modelli. Elimina un modello precedente per continuare.",
        variant: "destructive",
      });
      return;
    }
    const copyTpl: BacktestChartTemplate = {
      id: crypto.randomUUID(),
      name: `${tpl.name} (Copia)`,
      settings: pickChartSettings(tpl.settings),
      indicators: tpl.indicators.map((c) => ({ ...c })),
    };
    updateTemplates([...templates, copyTpl]);
    toast({
      title: "Modello Duplicato",
      description: `Creato "${copyTpl.name}" e sincronizzato col Cloud.`,
    });
  };

  const handleDelete = (tpl: BacktestChartTemplate) => {
    updateTemplates(templates.filter((t) => t.id !== tpl.id));
    toast({
      title: "Modello Rimosso",
      description: `Il modello "${tpl.name}" è stato eliminato.`,
    });
  };

  const handleSaveRename = (id: string) => {
    if (!renameText.trim()) return;
    updateTemplates(templates.map((t) => (t.id === id ? { ...t, name: renameText.trim() } : t)));
    setEditingId(null);
    setRenameText("");
    toast({
      title: "Modello Rinominato",
      description: "Nome aggiornato e sincronizzato col Cloud AUREUS.",
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await parseAndValidateTemplateFile(file);
    if (!result.success || !result.templates) {
      toast({
        title: "Errore Importazione",
        description: result.error || "File non valido.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const availableSlots = 50 - templates.length;
    if (availableSlots <= 0) {
      toast({
        title: "Limite Raggiunto",
        description: "Hai già raggiunto il limite di 50 modelli salvati. Elimina alcuni modelli prima di importare.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const toAdd = result.templates.slice(0, availableSlots).map((t) => ({
      ...t,
      id: crypto.randomUUID(), // id univoco per evitare collisioni
    }));

    updateTemplates([...templates, ...toAdd]);
    toast({
      title: "Importazione Riuscita",
      description: `${toAdd.length} modello/i importati con successo e sincronizzati col Cloud AUREUS.`,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className="btm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="btm-modal"
        style={{
          width: 660,
          maxWidth: "94vw",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          background: "#0c0d12",
          border: "1px solid rgba(197, 160, 89, 0.35)",
          borderRadius: 10,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.9)",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Gestione Modelli Grafico Cloud AUREUS"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Testata */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "#08090d",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileJson size={16} style={{ color: "#C5A059" }} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
              Gestione Modelli Grafico & Sincronizzazione Cloud
            </h2>
          </div>
          <button type="button" className="btm-iconbtn" onClick={onClose} aria-label="Chiudi">
            <X size={15} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Widget stato sincronizzazione Cloud */}
          <CloudSyncStatusWidget
            status={chartPreferences.status}
            onRetry={chartPreferences.retry}
            onResolveConflict={chartPreferences.resolveConflict}
          />

          {/* Barra Azioni: Cerca, Importa, Esporta Tutto */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                flex: 1,
                minWidth: 180,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#14151c",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 6,
                padding: "4px 10px",
              }}
            >
              <Search size={14} style={{ color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Cerca modello salvato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  color: "#f8fafc",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btm-toggle"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} style={{ color: "#C5A059" }} />
              <span>Importa JSON</span>
            </button>

            <button
              type="button"
              className="btm-toggle"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}
              disabled={templates.length === 0}
              onClick={() => exportAllTemplatesAsJson(templates)}
              title="Scarica backup completo di tutti i tuoi modelli"
            >
              <Download size={13} style={{ color: "#10b981" }} />
              <span>Esporta Tutti ({templates.length})</span>
            </button>
          </div>

          {/* Lista Modelli */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 10.5,
                color: "var(--btm-mut)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>Modelli Salvati nell'Ordine ({templates.length} / 50)</span>
              <span>Cloud Sincronizzato</span>
            </div>

            {filtered.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  borderRadius: 6,
                  border: "1px dashed rgba(255, 255, 255, 0.1)",
                  color: "var(--btm-mut)",
                  fontSize: 12,
                }}
              >
                {search ? "Nessun modello corrispondente alla ricerca." : "Nessun modello personalizzato salvato."}
              </div>
            ) : (
              filtered.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    gap: 12,
                  }}
                >
                  {editingId === tpl.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <input
                        type="text"
                        className="btm-input"
                        autoFocus
                        value={renameText}
                        maxLength={80}
                        onChange={(e) => setRenameText(e.target.value)}
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <button
                        type="button"
                        className="btm-toggle"
                        data-on="true"
                        style={{ padding: "4px 8px" }}
                        onClick={() => handleSaveRename(tpl.id)}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        className="btm-toggle"
                        style={{ padding: "4px 8px" }}
                        onClick={() => setEditingId(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <span title="Sincronizzato nel Cloud" style={{ display: "inline-flex", flexShrink: 0 }}>
                          <Cloud size={14} style={{ color: "#10b981" }} />
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 12.5,
                            color: "#e2e8f0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tpl.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--btm-mut)",
                            fontFamily: "var(--font-mono)",
                            flexShrink: 0,
                          }}
                        >
                          {tpl.indicators.length} ind · {tpl.settings.chartType}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btm-toggle"
                          data-on="true"
                          style={{ fontSize: 11, padding: "3px 10px" }}
                          onClick={() => handleApply(tpl)}
                        >
                          Applica
                        </button>

                        <button
                          type="button"
                          className="btm-iconbtn"
                          title="Duplica modello"
                          onClick={() => handleDuplicate(tpl)}
                        >
                          <Copy size={13} />
                        </button>

                        <button
                          type="button"
                          className="btm-iconbtn"
                          title="Esporta singolo JSON"
                          onClick={() => exportSingleTemplateAsJson(tpl)}
                        >
                          <Download size={13} />
                        </button>

                        <button
                          type="button"
                          className="btm-iconbtn"
                          title="Rinomina modello"
                          onClick={() => {
                            setEditingId(tpl.id);
                            setRenameText(tpl.name);
                          }}
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          className="btm-trash"
                          title="Elimina modello"
                          onClick={() => handleDelete(tpl)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 18px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "#08090d",
            fontSize: 11,
            color: "var(--btm-mut)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={14} style={{ color: "#C5A059" }} />
            <span>I modelli sono sincronizzati automaticamente con il tuo account AUREUS.</span>
          </div>

          <button
            type="button"
            className="btm-toggle"
            style={{ padding: "4px 14px", fontSize: 11 }}
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
