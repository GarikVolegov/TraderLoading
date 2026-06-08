import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Check, RotateCcw,
  Clock, BookOpen, Sunrise, Target, ClipboardCheck,
  CalendarDays, BarChart2, TrendingUp, BookMarked,
  Eye, EyeOff, Wallet, ArrowUpRight,
} from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { SentimentWidget } from "@/components/SentimentWidget";
import { VolatilityWidget } from "@/components/VolatilityWidget";
import { CotWidget } from "@/components/CotWidget";
import { RoutineWidget } from "@/components/RoutineWidget";
import { JournalWidget } from "@/components/JournalWidget";
import { BrokerHubWidget } from "@/components/broker-hub/BrokerHubWidget";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Widget registry ───────────────────────────────────────────────────────────

interface WidgetDef {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Rotta della pagina dedicata aperta al click. Assente = widget non cliccabile. */
  route?: string;
  component: React.ComponentType;
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: "clock",      label: "Orologio & Sessioni",  icon: Clock,          route: "/clock",                  component: ClockWidget },
  { id: "account",    label: "Broker Hub",           icon: Wallet,         route: "/broker",                 component: BrokerHubWidget },
  { id: "quote",      label: "Citazione del Giorno", icon: BookOpen,                                         component: QuoteWidget },
  { id: "routine",    label: "Routine Giornaliera",  icon: Sunrise,        route: "/routine",                component: RoutineWidget },
  { id: "missions",   label: "Missioni Giornaliere", icon: Target,         route: "/missions",               component: MissionsWidget },
  { id: "checklist",  label: "Checklist Pre-Trade",  icon: ClipboardCheck, route: "/checklist",              component: ChecklistDashboardWidget },
  { id: "journal",    label: "Diario Trading",       icon: BookOpen,       route: "/journal",                component: JournalWidget },
  { id: "calendar",   label: "Calendario Avanzato",  icon: CalendarDays,   route: "/calendar",               component: CalendarWidget },
  { id: "sentiment",  label: "Sentiment di Mercato", icon: BarChart2,      route: "/tools?tab=sentiment",    component: SentimentWidget },
  { id: "volatility", label: "Volatilita & ADR",     icon: TrendingUp,     route: "/tools?tab=volatility",   component: VolatilityWidget },
  { id: "cot",        label: "COT Report",           icon: BookMarked,     route: "/tools?tab=cot",          component: CotWidget },
];

const DEFAULT_ORDER = [
  "clock",
  "quote",
  "account",
  "missions",
  "routine",
  "checklist",
  "journal",
  "sentiment",
  "volatility",
  "cot",
  "calendar",
];
const STORAGE_KEY      = "tl_dashboard_order_command_center_v1";
const VISIBILITY_KEY   = "tl_dashboard_visibility_command_center_v1";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved = JSON.parse(raw) as string[];
    const valid = saved.filter((id) => DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

function loadVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveVisibility(v: Record<string, boolean>) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v));
}

function shouldStartLayoutEditing() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("layout") === "edit";
}

// ─── Sortable widget wrapper ───────────────────────────────────────────────────

function SortableWidget({
  def,
  isEditing,
  isDragActive,
  isHidden,
  onToggleHide,
  onOpen,
}: {
  def: WidgetDef;
  isEditing: boolean;
  isDragActive: boolean;
  isHidden: boolean;
  onToggleHide: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id, disabled: !isEditing || isHidden });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 220ms cubic-bezier(0.22,1,0.36,1)",
    zIndex: isDragging ? 20 : undefined,
  };

  const Icon = def.icon;
  const isOpenable = !isEditing && !isHidden && !isDragActive && !!def.route;

  const handleOpen = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOpenable) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a,input,select,textarea,label")) return;
    onOpen(def.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isEditing ? "h-full" : ""} ${isDragging ? "opacity-0" : ""}`}
    >
      {/* Widget content — hidden widgets become ghost placeholders in edit mode */}
      {isHidden && isEditing ? (
        <div className="flex h-full w-full items-center justify-center gap-3 rounded-[0.625rem] border-2 border-dashed border-border/40 bg-background/20 opacity-50">
          <Icon className="w-4 h-4 text-muted-foreground/50" />
          <span className="text-xs font-bold text-muted-foreground/50 font-mono">{def.label}</span>
        </div>
      ) : (
        <motion.div
          animate={
            isEditing
              ? { scale: isDragging ? 1.03 : 1, opacity: isDragging ? 0 : 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`dashboard-widget-shell group relative transition-shadow duration-200 ${
            isEditing ? "h-full overflow-hidden" : ""
          } ${
            isEditing && !isDragging
              ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.25),0_4px_20px_rgba(0,0,0,0.3)]"
              : ""
          } ${isOpenable ? "cursor-pointer hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_18px_42px_rgba(0,0,0,0.25)]" : ""}`}
          style={{ borderRadius: "0.625rem" }}
          role={isOpenable ? "button" : undefined}
          tabIndex={isOpenable ? 0 : undefined}
          aria-label={isOpenable ? `Apri ${def.label}` : undefined}
          onClick={handleOpen}
          onKeyDown={(event) => {
            if (!isOpenable) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(def.id);
            }
          }}
        >
          <def.component />

          {/* Affordance "apri pagina" — appare solo all'hover, non occupa spazio */}
          {isOpenable && (
            <div
              style={{ height: "2.25rem", width: "2.25rem" }}
              className="pointer-events-none absolute bottom-2.5 right-2.5 z-[5] flex items-center justify-center rounded-full border border-primary/30 bg-card/85 text-primary opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          )}
        </motion.div>
      )}

      {/* Edit-mode overlay */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            key="drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`absolute inset-0 z-10 rounded-[0.625rem] flex items-start justify-between p-3 touch-none ${
              isHidden
                ? "border-2 border-dashed border-border/30 bg-transparent cursor-default"
                : "border-2 border-dashed border-primary/35 bg-background/60 backdrop-blur-[2px] cursor-grab active:cursor-grabbing"
            }`}
            {...(!isHidden ? { ...listeners, ...attributes } : {})}
          >
            <div className="flex items-center gap-2">
              <Icon className={`w-3.5 h-3.5 ${isHidden ? "text-muted-foreground/40" : "text-primary/60"}`} />
              <span className={`text-xs font-bold font-mono ${isHidden ? "text-muted-foreground/40 line-through" : "text-primary/70"}`}>
                {def.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Eye toggle */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleHide(def.id); }}
                className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                  isHidden
                    ? "bg-border/30 text-muted-foreground/50 hover:bg-primary/20 hover:text-primary"
                    : "bg-primary/10 text-primary/70 hover:bg-primary/25 hover:text-primary"
                }`}
                title={isHidden ? "Mostra widget" : "Nascondi widget"}
              >
                {isHidden
                  ? <EyeOff className="w-3.5 h-3.5" />
                  : <Eye className="w-3.5 h-3.5" />
                }
              </button>
              {!isHidden && <GripVertical className="w-4 h-4 text-primary/50" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Drag ghost (overlay) ─────────────────────────────────────────────────────

function WidgetGhost({ def }: { def: WidgetDef }) {
  const Icon = def.icon;
  return (
    <div
      className="rounded-[0.625rem] border-2 border-primary/40 bg-card/80 backdrop-blur-md shadow-2xl shadow-black/50 p-4 flex items-center gap-3 rotate-2"
      style={{ minWidth: 200 }}
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold font-mono">{def.label}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Trascina per riposizionare</p>
      </div>
      <GripVertical className="w-4 h-4 text-primary/40 ml-auto" />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useLanguage();
  const [, navigate]                = useLocation();
  const [order, setOrder]           = useState<string[]>(loadOrder);
  const [hidden, setHidden]         = useState<Record<string, boolean>>(loadVisibility);
  const [isEditing, setIsEditing]   = useState(shouldStartLayoutEditing);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const prevOrderRef = useRef<string[]>(order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const defMap = useMemo(
    () => Object.fromEntries(WIDGET_DEFS.map((d) => [d.id, d])),
    [],
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over || active.id === over.id) return;
      setOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIdx, newIdx);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const handleToggleHide = useCallback((id: string) => {
    setHidden((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveVisibility(next);
      return next;
    });
  }, []);

  const handleOpenWidget = useCallback((id: string) => {
    const route = defMap[id]?.route;
    if (route) navigate(route);
  }, [defMap, navigate]);

  const handleFinishEditing = () => {
    setIsEditing(false);
  };

  const handleReset = () => {
    setOrder(DEFAULT_ORDER);
    setHidden({});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ORDER));
    saveVisibility({});
  };

  // Deep-link broker dei widget (es. BrokerHubWidget) → naviga alla pagina /broker col tab giusto
  useEffect(() => {
    const handleOpenWorkspace = (event: Event) => {
      const custom = event as CustomEvent<{ workspaceId?: string; accountTab?: string }>;
      if (custom.detail?.workspaceId !== "account") return;
      const tab = custom.detail.accountTab;
      navigate(tab ? `/broker?tab=${tab}` : "/broker");
    };

    window.addEventListener("tl-open-dashboard-workspace", handleOpenWorkspace);
    return () => window.removeEventListener("tl-open-dashboard-workspace", handleOpenWorkspace);
  }, [navigate]);

  useEffect(() => {
    if (!shouldStartLayoutEditing()) return;
    prevOrderRef.current = order;
    setIsEditing(true);
    window.history.replaceState(null, "", window.location.pathname || "/");
  }, [order]);

  const activeWidget = activeId ? defMap[activeId] : null;

  // In edit mode: show all widgets (visible + hidden as ghost).
  // In normal mode: only show visible widgets.
  const displayOrder = isEditing
    ? order
    : order.filter((id) => !hidden[id]);

  // Layout: in vista normale i widget si impacchettano a masonry (altezza naturale,
  // niente spazi vuoti); in modifica diventano una griglia uniforme per un drag&drop pulito.
  const containerClass = isEditing
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start"
    : "columns-1 sm:columns-2 xl:columns-3 [column-gap:1rem]";

  return (
    <PageLayout>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        badge={
          <span className="hidden lg:inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
            Command Center
          </span>
        }
        action={isEditing ? (
          <div className="flex items-center gap-2">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 text-xs text-muted-foreground/60 hover:text-muted-foreground/90 hover:border-border/70 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleFinishEditing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/25 transition-all duration-200"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Fatto
            </motion.button>
          </div>
        ) : undefined}
      />

      {/* Edit-mode banner */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <p className="text-xs text-primary/80 font-medium">
                <strong>Modalità modifica attiva</strong> — Trascina i widget per riorganizzare.
                Usa <Eye className="inline w-3 h-3 mx-0.5" /> per mostrare/nascondere ogni widget.
                Premi <strong>Fatto</strong> per salvare.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Griglia */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
          <div className={containerClass}>
            {displayOrder.map((id, i) => {
              const def = defMap[id];
              if (!def) return null;
              const isHid = !!hidden[id];
              return (
                <motion.div
                  key={id}
                  layout={isEditing}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    opacity: { delay: i * 0.03, duration: 0.24 },
                    y: { delay: i * 0.03, duration: 0.24, ease: [0.22,1,0.36,1] },
                    layout: { duration: 0.28, ease: [0.22,1,0.36,1] },
                  }}
                  className={isEditing ? "h-[200px]" : "mb-4 break-inside-avoid"}
                >
                  <SortableWidget
                    def={def}
                    isEditing={isEditing}
                    isDragActive={activeId !== null}
                    isHidden={isHid}
                    onToggleHide={handleToggleHide}
                    onOpen={handleOpenWidget}
                  />
                </motion.div>
              );
            })}
          </div>
        </SortableContext>

        {/* Drag ghost */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeWidget ? <WidgetGhost def={activeWidget} /> : null}
        </DragOverlay>
      </DndContext>
    </PageLayout>
  );
}
