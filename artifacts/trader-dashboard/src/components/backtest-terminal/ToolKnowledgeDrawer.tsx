import { useMemo, useState } from "react";
import { ChevronLeft, Link2, Search, Star, X, Check, Sparkles, Sliders } from "lucide-react";
import { DRAWING_TOOLS, DRAWING_TOOL_CATEGORIES, type DrawingToolId } from "./toolRailModel";
import { TOOL_KNOWLEDGE_CATALOG, type ToolKnowledgeEntry } from "./toolKnowledgeCatalog";
import { uiText } from "@/contexts/LanguageContext";

export interface ToolKnowledgeDrawerProps {
  toolId: DrawingToolId | null;
  onClose: () => void;
  onSelectTool: (tool: DrawingToolId) => void;
  favoriteTools: string[];
  onToggleFavorite: (tool: DrawingToolId) => void;
}

const SAMPLE_CANDLES = [
  { x: 24, o: 162, h: 150, l: 170, c: 154 },
  { x: 42, o: 154, h: 142, l: 160, c: 146 },
  { x: 60, o: 146, h: 140, l: 158, c: 153 },
  { x: 78, o: 153, h: 132, l: 155, c: 135 },
  { x: 96, o: 135, h: 122, l: 140, c: 126 },
  { x: 114, o: 126, h: 120, l: 136, c: 131 },
  { x: 132, o: 131, h: 112, l: 134, c: 115 },
  { x: 150, o: 115, h: 102, l: 120, c: 106 },
  { x: 168, o: 106, h: 98, l: 116, c: 112 },
  { x: 186, o: 112, h: 88, l: 114, c: 92 },
  { x: 204, o: 92, h: 78, l: 96, c: 82 },
  { x: 222, o: 82, h: 74, l: 90, c: 86 },
  { x: 240, o: 86, h: 64, l: 88, c: 68 },
  { x: 258, o: 68, h: 52, l: 72, c: 56 },
  { x: 276, o: 56, h: 46, l: 64, c: 50 },
];

function ToolVisualPreview({ entry }: { entry: ToolKnowledgeEntry }) {
  return (
    <div className="tkd-preview-card" aria-label={`Illustrazione ${entry.title}`}>
      <div className="tkd-preview-chrome">
        <span className="tkd-preview-dot" />
        <span className="tkd-preview-dot" />
        <span className="tkd-preview-dot" />
        <span className="tkd-preview-symbol">XAUUSD · 1h · AUREUS PRO CHART</span>
        <span className="tkd-preview-ohlc">O 4.023,70 H 4.094,00 L 4.018,20 C 4.086,50 +1.56%</span>
      </div>
      <svg viewBox="0 0 330 205" className="tkd-preview-svg" role="img">
        {/* Subtle Grid */}
        {[40, 80, 120, 160].map((gy) => (
          <line key={gy} x1={0} y1={gy} x2={300} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {[60, 120, 180, 240].map((gx) => (
          <line key={gx} x1={gx} y1={0} x2={gx} y2={185} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* Right axis */}
        <line x1={300} y1={0} x2={300} y2={185} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <line x1={0} y1={185} x2={330} y2={185} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        {[
          { y: 45, label: "4.120" },
          { y: 85, label: "4.090" },
          { y: 125, label: "4.060" },
          { y: 165, label: "4.030" },
        ].map((p) => (
          <text key={p.y} x={304} y={p.y} fontSize={7.5} fill="#8b8f9a" fontFamily="monospace">
            {p.label}
          </text>
        ))}

        {/* Candlesticks */}
        {SAMPLE_CANDLES.map((c, idx) => {
          const up = c.c <= c.o;
          const col = up ? "#089981" : "#f23645";
          const top = Math.min(c.o, c.c);
          const h = Math.max(2, Math.abs(c.c - c.o));
          return (
            <g key={idx}>
              <line x1={c.x} y1={c.h} x2={c.x} y2={c.l} stroke={col} strokeWidth={1.1} />
              <rect x={c.x - 4} y={top} width={8} height={h} fill={col} rx={0.8} />
            </g>
          );
        })}

        {/* Tool-specific illustration overlay */}
        {entry.previewKind === "infoline" && (
          <g>
            <line x1={42} y1={160} x2={258} y2={72} stroke="#2962ff" strokeWidth={2} />
            <circle cx={42} cy={160} r={3.5} fill="#131722" stroke="#2962ff" strokeWidth={1.8} />
            <circle cx={258} cy={72} r={3.5} fill="#131722" stroke="#2962ff" strokeWidth={1.8} />
            <path d="M 42 160 L 110 160" stroke="#2962ff" strokeDasharray="2 2" strokeWidth={1} opacity={0.7} />
            {/* Info card matching Screenshot 2 */}
            <g transform="translate(152, 118)">
              <rect x={0} y={0} width={136} height={54} rx={4} fill="#1e222d" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
              <text x={8} y={14} fontSize={7.5} fill="#d1d4dc" fontFamily="monospace" fontWeight={700}>
                ↕ +68.40 (+1.70%) · 684.0 pips
              </text>
              <text x={8} y={28} fontSize={7.5} fill="#94a3b8" fontFamily="monospace">
                ↔ 12 barre, 12h · Dist: 235px
              </text>
              <text x={8} y={42} fontSize={7.5} fill="#60a5fa" fontFamily="monospace" fontWeight={700}>
                ∠ 22.18°
              </text>
            </g>
          </g>
        )}

        {entry.previewKind === "frvp" && (
          <g>
            <rect x={60} y={52} width={180} height={116} fill="rgba(41, 98, 255, 0.05)" stroke="rgba(148,163,184,0.3)" strokeDasharray="3 3" />
            {[
              { y: 56, u: 28, d: 18, va: false },
              { y: 68, u: 45, d: 26, va: true },
              { y: 80, u: 68, d: 42, va: true },
              { y: 92, u: 96, d: 54, va: true, poc: true },
              { y: 104, u: 74, d: 38, va: true },
              { y: 116, u: 52, d: 30, va: true },
              { y: 128, u: 34, d: 22, va: false },
              { y: 140, u: 20, d: 14, va: false },
            ].map((b, i) => (
              <g key={i} opacity={b.va ? 0.78 : 0.35}>
                <rect x={60} y={b.y} width={b.u} height={9} fill="#2962ff" />
                <rect x={60 + b.u} y={b.y} width={b.d} height={9} fill="#f59e0b" />
              </g>
            ))}
            <line x1={60} y1={68} x2={295} y2={68} stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={60} y1={125} x2={295} y2={125} stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={60} y1={96.5} x2={295} y2={96.5} stroke="#ef4444" strokeWidth={2} />
            <text x={292} y={93} textAnchor="end" fontSize={7.5} fontWeight={700} fill="#ef4444" fontFamily="monospace">
              POC 4.091,24
            </text>
          </g>
        )}

        {entry.previewKind === "position_long" && (
          <g>
            <rect x={132} y={50} width={140} height={65} fill="rgba(16, 185, 129, 0.22)" stroke="#10b981" strokeWidth={1} />
            <rect x={132} y={115} width={140} height={28} fill="rgba(239, 68, 68, 0.22)" stroke="#ef4444" strokeWidth={1} />
            <line x1={132} y1={115} x2={272} y2={115} stroke="#3b82f6" strokeWidth={1.8} />
            <text x={138} y={110} fontSize={8} fontWeight={700} fill="#ffffff" fontFamily="monospace">
              LONG · R:R 2.32
            </text>
            <text x={138} y={62} fontSize={7.5} fontWeight={700} fill="#34d399" fontFamily="monospace">
              TP +65.0p (+1.62%)
            </text>
            <text x={138} y={138} fontSize={7.5} fontWeight={700} fill="#f87171" fontFamily="monospace">
              SL -28.0p (-0.70%)
            </text>
          </g>
        )}

        {entry.previewKind === "position_short" && (
          <g>
            <rect x={132} y={65} width={140} height={26} fill="rgba(239, 68, 68, 0.22)" stroke="#ef4444" strokeWidth={1} />
            <rect x={132} y={91} width={140} height={64} fill="rgba(16, 185, 129, 0.22)" stroke="#10b981" strokeWidth={1} />
            <line x1={132} y1={91} x2={272} y2={91} stroke="#3b82f6" strokeWidth={1.8} />
            <text x={138} y={86} fontSize={8} fontWeight={700} fill="#ffffff" fontFamily="monospace">
              SHORT · R:R 2.46
            </text>
          </g>
        )}

        {entry.previewKind === "fib" && (
          <g>
            {[
              { y: 52, l: "0.000 (4.118,50)", c: "#787b86" },
              { y: 80, l: "0.382 (4.092,10)", c: "#ff9800" },
              { y: 98, l: "0.500 (4.084,00)", c: "#4caf50" },
              { y: 116, l: "0.618 (4.075,90)", c: "#089981" },
              { y: 138, l: "0.786 (4.064,30)", c: "#2962ff" },
              { y: 162, l: "1.000 (4.049,50)", c: "#787b86" },
            ].map((f, i) => (
              <g key={i}>
                <line x1={60} y1={f.y} x2={288} y2={f.y} stroke={f.c} strokeWidth={1.2} />
                <text x={64} y={f.y - 3} fontSize={7} fill={f.c} fontFamily="monospace">
                  {f.l}
                </text>
              </g>
            ))}
            <rect x={60} y={116} width={228} height={22} fill="rgba(8, 153, 129, 0.14)" />
            <line x1={60} y1={162} x2={258} y2={52} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
          </g>
        )}

        {entry.previewKind === "rect" && (
          <g>
            <rect x={96} y={96} width={196} height={32} fill="rgba(212, 175, 55, 0.16)" stroke="#d4af37" strokeWidth={1.5} />
            <line x1={96} y1={112} x2={292} y2={112} stroke="#d4af37" strokeDasharray="4 4" strokeWidth={1} />
            <text x={102} y={108} fontSize={8} fontWeight={700} fill="#d4af37" fontFamily="monospace">
              FVG H1 · 50% EQ (4.078,50)
            </text>
          </g>
        )}

        {entry.previewKind === "avwap" && (
          <g>
            <line x1={78} y1={35} x2={78} y2={175} stroke="rgba(59,130,246,0.35)" strokeDasharray="3 3" />
            <circle cx={78} cy={155} r={4} fill="#2962ff" />
            <path d="M 78 155 Q 135 138, 186 108 T 285 68" fill="none" stroke="#2962ff" strokeWidth={2.2} />
            <path d="M 78 145 Q 135 122, 186 90 T 285 48" fill="none" stroke="#60a5fa" strokeDasharray="3 3" strokeWidth={1.1} />
            <path d="M 78 165 Q 135 154, 186 126 T 285 88" fill="none" stroke="#60a5fa" strokeDasharray="3 3" strokeWidth={1.1} />
          </g>
        )}

        {entry.previewKind === "channel" && (
          <g>
            <polygon points="42,168 258,72 258,40 42,136" fill="rgba(59,130,246,0.12)" />
            <line x1={42} y1={168} x2={258} y2={72} stroke="#3b82f6" strokeWidth={1.8} />
            <line x1={42} y1={136} x2={258} y2={40} stroke="#3b82f6" strokeWidth={1.8} />
            <line x1={42} y1={152} x2={258} y2={56} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.1} />
          </g>
        )}

        {entry.previewKind === "ruler" && (
          <g>
            <rect x={96} y={64} width={144} height={72} fill="rgba(59, 130, 246, 0.16)" stroke="#3b82f6" strokeWidth={1.2} />
            <line x1={168} y1={64} x2={168} y2={136} stroke="#60a5fa" strokeWidth={1.2} />
            <line x1={96} y1={100} x2={240} y2={100} stroke="#60a5fa" strokeWidth={1.2} />
            <rect x={112} y={42} width={112} height={18} rx={3} fill="#2962ff" />
            <text x={168} y={54} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff" fontFamily="monospace">
              +54.2p (+1.35%) · 8 barre
            </text>
          </g>
        )}

        {(entry.previewKind === "trend" || entry.previewKind === "hline" || entry.previewKind === "path" || entry.previewKind === "annotation") && (
          <g>
            <line x1={42} y1={162} x2={276} y2={54} stroke="#d4af37" strokeWidth={2} />
            <circle cx={42} cy={162} r={3.5} fill="#131722" stroke="#d4af37" strokeWidth={1.8} />
            <circle cx={276} cy={54} r={3.5} fill="#131722" stroke="#d4af37" strokeWidth={1.8} />
          </g>
        )}
      </svg>
    </div>
  );
}

export function ToolKnowledgeDrawer({
  toolId,
  onClose,
  onSelectTool,
  favoriteTools,
  onToggleFavorite,
}: ToolKnowledgeDrawerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<DrawingToolId | null>(toolId);
  const [copied, setCopied] = useState(false);

  // Sync external toolId prop when user clicks another info dot
  const activeId = selectedId ?? toolId;
  const entry = activeId ? TOOL_KNOWLEDGE_CATALOG[activeId] : null;

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(TOOL_KNOWLEDGE_CATALOG).filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.application.some((p) => p.toLowerCase().includes(q)),
    );
  }, [query]);

  if (!toolId) return null;

  const isFav = activeId ? favoriteTools.includes(activeId) : false;

  return (
    <aside
      className="tkd-drawer"
      role="dialog"
      aria-label="Centro di supporto strumenti di disegno"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Close Header */}
      <div className="tkd-top-bar">
        <div className="tkd-search-box">
          <Search size={15} className="tkd-search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Basta iniziare a digitare..."
            aria-label="Cerca nel Centro di supporto"
            className="tkd-search-input"
          />
          {query && (
            <button
              type="button"
              className="tkd-clear-search"
              onClick={() => setQuery("")}
              aria-label="Cancella ricerca"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="tkd-close-btn"
          onClick={onClose}
          title="Chiudi Centro di supporto"
          aria-label="Chiudi Centro di supporto"
        >
          <X size={18} />
        </button>
      </div>

      <div className="tkd-scroll-body">
        {query.trim().length > 0 ? (
          <div className="tkd-search-results">
            <div className="tkd-section-caption">
              Risultati ricerca ({filteredTools.length})
            </div>
            {filteredTools.map((item) => {
              const meta = DRAWING_TOOLS.find((t) => t.id === item.id);
              const Icon = meta?.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="tkd-result-item"
                  onClick={() => {
                    setSelectedId(item.id);
                    setQuery("");
                  }}
                >
                  {Icon && <Icon size={18} className="shrink-0 text-[#d4af37]" />}
                  <div className="tkd-result-text">
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </div>
                </button>
              );
            })}
            {filteredTools.length === 0 && (
              <p className="tkd-empty">Nessuno strumento trovato per &ldquo;{query}&rdquo;.</p>
            )}
          </div>
        ) : entry ? (
          <article className="tkd-article">
            {/* Breadcrumb TradingView style */}
            <nav className="tkd-breadcrumb" aria-label="Percorso supporto">
              <button
                type="button"
                className="tkd-breadcrumb-link"
                onClick={() => setSelectedId(null)}
              >
                Centro di supporto
              </button>
              <span>/</span>
              <span>{entry.categoryLabel}</span>
              <span>/</span>
              <span className="tkd-breadcrumb-current">{entry.breadcrumbTitle}</span>
            </nav>

            {/* Title row */}
            <div className="tkd-title-row">
              <button
                type="button"
                className="tkd-back-btn"
                onClick={() => setSelectedId(null)}
                title="Torna al catalogo completo degli strumenti"
                aria-label="Torna al catalogo completo"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="tkd-title">{entry.title}</h2>
              <button
                type="button"
                className="tkd-link-btn"
                onClick={() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                title="Copia riferimento guida"
                aria-label="Copia riferimento guida"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
              </button>
            </div>

            {/* Action bar: Activate Tool & Save to Favorites */}
            <div className="tkd-action-strip">
              <button
                type="button"
                className="tkd-primary-btn"
                onClick={() => {
                  onSelectTool(entry.id);
                }}
              >
                <span>Usa questo strumento</span>
              </button>
              {entry.id !== "cursor" && (
                <button
                  type="button"
                  className={`tkd-fav-btn ${isFav ? "is-fav" : ""}`}
                  onClick={() => onToggleFavorite(entry.id)}
                  aria-pressed={isFav}
                >
                  <Star size={14} fill={isFav ? "currentColor" : "none"} />
                  <span>{isFav ? "Salvato nei Preferiti" : "Salva nei Preferiti"}</span>
                </button>
              )}
            </div>

            {/* Section: Applicazione */}
            <section className="tkd-block">
              <h3 className="tkd-heading">Applicazione</h3>
              {entry.application.map((paragraph, idx) => (
                <p key={idx} className="tkd-paragraph">
                  {paragraph}
                </p>
              ))}
              <p className="tkd-paragraph">{entry.howToDraw}</p>
            </section>

            {/* Interactive SVG Chart Illustration */}
            <ToolVisualPreview entry={entry} />

            {/* Section: Personalizzazione nelle Impostazioni */}
            <section className="tkd-block">
              <h3 className="tkd-heading flex items-center gap-1.5">
                <Sliders size={14} className="text-[#d4af37]" />
                <span>Personalizzazione nelle Impostazioni (Doppio Clic / ⚙)</span>
              </h3>
              <div className="tkd-settings-grid">
                <div className="tkd-setting-card">
                  <strong>Input</strong>
                  <p>{entry.settingsOverview.input}</p>
                </div>
                <div className="tkd-setting-card">
                  <strong>Stile</strong>
                  <p>{entry.settingsOverview.style}</p>
                </div>
                <div className="tkd-setting-card">
                  <strong>Coordinate</strong>
                  <p>{entry.settingsOverview.coordinates}</p>
                </div>
                <div className="tkd-setting-card">
                  <strong>Visibilità</strong>
                  <p>{entry.settingsOverview.visibility}</p>
                </div>
              </div>
            </section>

            {/* Pro Tip */}
            <div className="tkd-protip">
              <div className="tkd-protip-head">
                <Sparkles size={13} className="text-[#d4af37]" />
                <span>Dettaglio Operativo AUREUS Pro</span>
              </div>
              <p>{entry.proTip}</p>
            </div>
          </article>
        ) : (
          /* Full Catalog Index when clicking Back (<) */
          <div className="tkd-catalog-index">
            <div className="tkd-section-caption">
              Centro di supporto · Catalogo Strumenti di Disegno
            </div>
            {DRAWING_TOOL_CATEGORIES.map((cat) => (
              <div key={cat.id} className="tkd-cat-group">
                <h4 className="tkd-cat-title">{cat.titleIt}</h4>
                <div className="tkd-cat-items">
                  {cat.tools.map((tid) => {
                    const meta = DRAWING_TOOLS.find((t) => t.id === tid);
                    const kEntry = TOOL_KNOWLEDGE_CATALOG[tid];
                    if (!meta || !kEntry) return null;
                    const Icon = meta.Icon;
                    const fav = favoriteTools.includes(tid);
                    return (
                      <div key={tid} className="tkd-cat-row">
                        <button
                          type="button"
                          className="tkd-cat-btn"
                          onClick={() => setSelectedId(tid)}
                        >
                          <Icon size={17} className="shrink-0 text-zinc-300" />
                          <div className="tkd-cat-btn-text">
                            <strong>{uiText(meta.labelKey)}</strong>
                            <span>{kEntry.summary}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`tkd-cat-star ${fav ? "is-fav" : ""}`}
                          onClick={() => onToggleFavorite(tid)}
                          title={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
                        >
                          <Star size={13} fill={fav ? "currentColor" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
