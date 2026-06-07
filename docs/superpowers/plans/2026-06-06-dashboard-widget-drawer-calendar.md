# Dashboard Widget Drawer And Advanced Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard widget clickable and open a richer dedicated drawer, including an advanced hybrid calendar planner.

**Architecture:** Dashboard owns `activeWorkspaceId` and passes it to a reusable drawer. Workspace content is split into focused components under `src/components/dashboard-workspaces`. The calendar workspace merges existing API sources with local manual planner items.

**Tech Stack:** React, TypeScript, Wouter, React Query generated API hooks, Tailwind CSS, framer-motion, lucide-react, localStorage.

---

## File Structure

- Create `artifacts/trader-dashboard/src/components/DashboardWorkspaceDrawer.tsx`
  - Reusable overlay shell with header, backdrop, Escape close, desktop drawer and mobile full-screen behavior.
- Create `artifacts/trader-dashboard/src/components/dashboard-workspaces/CalendarPlannerWorkspace.tsx`
  - Advanced calendar agenda, manual item composer, localStorage persistence.
- Create `artifacts/trader-dashboard/src/components/dashboard-workspaces/WidgetWorkspaceContent.tsx`
  - Routes workspace ids to compact complete views for clock, quote, routine, missions, checklist, sentiment, volatility, COT, and calendar.
- Modify `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
  - Add workspace metadata to widget defs, open drawer on click, disable click in Layout mode.
- Modify `artifacts/trader-dashboard/src/pages/Tools.tsx`
  - Read `?tab=` and set the initial active tab so tool links can open the right section.

---

### Task 1: Drawer Shell

**Files:**
- Create: `artifacts/trader-dashboard/src/components/DashboardWorkspaceDrawer.tsx`

- [ ] **Step 1: Create reusable drawer component**

Implement:

```tsx
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface DashboardWorkspaceDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  onClose: () => void;
  children: React.ReactNode;
}

export function DashboardWorkspaceDrawer({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}: DashboardWorkspaceDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.button
            type="button"
            aria-label="Chiudi pannello"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-border/50 bg-card/96 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:max-w-[760px] xl:max-w-[900px]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border/45 px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                {Icon && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Run targeted typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0 or only pre-existing unrelated errors. Fix drawer errors before moving on.

---

### Task 2: Dashboard Click Wiring

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Extend widget definitions**

Add `workspaceSubtitle?: string` to `WidgetDef`. Populate subtitles in `WIDGET_DEFS`, for example:

```tsx
{ id: "calendar", label: "Calendario Economico", icon: CalendarDays, component: CalendarWidget, workspaceSubtitle: "Agenda, appuntamenti, obiettivi e market events" }
```

- [ ] **Step 2: Add active drawer state**

Add:

```tsx
const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
const activeWorkspace = activeWorkspaceId ? defMap[activeWorkspaceId] : null;
```

- [ ] **Step 3: Make visible widgets clickable outside Layout mode**

Pass `onOpen={() => setActiveWorkspaceId(def.id)}` to `SortableWidget`. In `SortableWidget`, wrap the widget content with a button-like overlay or clickable `motion.div`:

```tsx
onClick={() => {
  if (!isEditing && !isDragActive && !isHidden) onOpen(def.id);
}}
role={!isEditing && !isHidden ? "button" : undefined}
tabIndex={!isEditing && !isHidden ? 0 : undefined}
onKeyDown={(event) => {
  if (!isEditing && !isHidden && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    onOpen(def.id);
  }
}}
```

Use `cursor-pointer` only when the widget is openable. Stop propagation in existing inner links/buttons where needed.

- [ ] **Step 4: Render drawer**

Import `DashboardWorkspaceDrawer` and `WidgetWorkspaceContent`. At the end of `Dashboard`, render:

```tsx
<DashboardWorkspaceDrawer
  open={!!activeWorkspace}
  title={activeWorkspace?.label ?? ""}
  subtitle={activeWorkspace?.workspaceSubtitle}
  icon={activeWorkspace?.icon}
  onClose={() => setActiveWorkspaceId(null)}
>
  {activeWorkspace && <WidgetWorkspaceContent workspaceId={activeWorkspace.id} />}
</DashboardWorkspaceDrawer>
```

- [ ] **Step 5: Verify Layout mode does not open drawer**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0.

---

### Task 3: Workspace Content Router

**Files:**
- Create: `artifacts/trader-dashboard/src/components/dashboard-workspaces/WidgetWorkspaceContent.tsx`

- [ ] **Step 1: Create focused workspace router**

Implement:

```tsx
import { Link } from "wouter";
import { Activity, BarChart2, BookMarked, CalendarDays, Clock, ExternalLink, Quote, Sunrise, Target, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarPlannerWorkspace } from "./CalendarPlannerWorkspace";
import { MissionsWidget } from "@/components/MissionsWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { RoutineWidget } from "@/components/RoutineWidget";
import { SentimentWidget } from "@/components/SentimentWidget";
import { VolatilityWidget } from "@/components/VolatilityWidget";
import { CotWidget } from "@/components/CotWidget";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";

function WorkspaceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Button variant="outline" size="sm" className="gap-2">
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </Button>
    </Link>
  );
}

function SimpleWorkspace({ children, href, label }: { children: React.ReactNode; href?: string; label?: string }) {
  return (
    <div className="space-y-4">
      {href && label && <div className="flex justify-end"><WorkspaceLink href={href} label={label} /></div>}
      {children}
    </div>
  );
}

export function WidgetWorkspaceContent({ workspaceId }: { workspaceId: string }) {
  switch (workspaceId) {
    case "calendar":
      return <CalendarPlannerWorkspace />;
    case "checklist":
      return <SimpleWorkspace href="/checklist" label="Apri checklist completa"><ChecklistDashboardWidget /></SimpleWorkspace>;
    case "routine":
      return <SimpleWorkspace href="/routine" label="Apri routine completa"><RoutineWidget /></SimpleWorkspace>;
    case "missions":
      return <SimpleWorkspace href="/settings" label="Configura missioni"><MissionsWidget /></SimpleWorkspace>;
    case "sentiment":
      return <SimpleWorkspace href="/tools?tab=sentiment" label="Apri tool sentiment"><SentimentWidget /></SimpleWorkspace>;
    case "volatility":
      return <SimpleWorkspace href="/tools?tab=volatility" label="Apri tool volatilita"><VolatilityWidget /></SimpleWorkspace>;
    case "cot":
      return <SimpleWorkspace href="/tools?tab=cot" label="Apri COT report"><CotWidget /></SimpleWorkspace>;
    case "clock":
      return <SimpleWorkspace><ClockWidget /></SimpleWorkspace>;
    case "quote":
      return <SimpleWorkspace><QuoteWidget /></SimpleWorkspace>;
    default:
      return (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-6 text-sm text-muted-foreground">
          Workspace non disponibile.
        </div>
      );
  }
}
```

- [ ] **Step 2: Remove unused imports**

Remove unused lucide imports if the compiler reports them.

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0.

---

### Task 4: Advanced Calendar Planner

**Files:**
- Create: `artifacts/trader-dashboard/src/components/dashboard-workspaces/CalendarPlannerWorkspace.tsx`

- [ ] **Step 1: Implement planner types and localStorage helpers**

Use:

```tsx
type PlannerItemType = "appointment" | "note" | "review" | "trade-plan";
type Priority = "low" | "medium" | "high";

interface ManualPlannerItem {
  id: string;
  type: PlannerItemType;
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  priority: Priority;
  createdAt: string;
}

interface AgendaItem {
  id: string;
  source: "market" | "goal" | "idea" | "mission" | "news" | "journal" | "manual";
  title: string;
  detail?: string;
  date: string;
  priority: Priority;
}

const STORAGE_KEY = "tl_calendar_manual_items_v1";
```

Load with guarded JSON parsing. Save after each create/delete.

- [ ] **Step 2: Fetch existing sources**

Use generated hooks:

```tsx
const { data: economicEvents } = useGetEconomicCalendar();
const { data: ideas } = useGetIdeas();
const { data: missions } = useGetMissions();
const { data: journalEntries } = useGetJournalEntries();
const { data: news } = useGetNews();
```

If `useGetNews` signature requires params, pass the existing default query pattern used in `News.tsx`.

- [ ] **Step 3: Merge agenda items**

Map sources:

- economic events: source `market`, date `event.date`, high impact -> high priority;
- goals with `deadlineDate`: source `goal`, date at `deadlineDateT09:00:00`;
- ideas without deadline: source `idea`, date `createdAt`;
- missions: source `mission`, date today at `08:00`;
- news articles: source `news`, date `publishedAt ?? fetchedAt`;
- journal entries: source `journal`, date `tradeDateT18:00:00`;
- manual items: source `manual`, date `startAt`.

Sort ascending by date.

- [ ] **Step 4: Build drawer UI**

Render:

- compact top summary row with total items, high priority count, next event;
- create form with title, type, date/time, end time, priority, notes;
- grouped agenda list by Italian date label;
- delete button only for manual items.

Use dense desktop spacing, no hero sections, no nested decorative cards.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0.

---

### Task 5: Tool Deep Links

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Tools.tsx`

- [ ] **Step 1: Read initial tab from URL**

Replace uncontrolled default tab with controlled state:

```tsx
const initialTab = new URLSearchParams(window.location.search).get("tab") ?? "montecarlo";
const safeInitialTab = TABS.some((tab) => tab.id === initialTab) || initialTab === "lot" ? initialTab : "montecarlo";
const [activeTab, setActiveTab] = useState(safeInitialTab);
```

Set:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
```

- [ ] **Step 2: Preserve existing tab content**

Do not restructure tool implementations. Only wire controlled tab value.

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0.

---

### Task 6: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Typecheck frontend**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: exit 0.

- [ ] **Step 2: Build frontend**

Run: `pnpm --filter @workspace/trader-dashboard run build`

Expected: exit 0. Existing Vite chunk-size warnings are acceptable.

- [ ] **Step 3: Runtime verification**

Run: `pnpm run verify:runtime`

Expected: all runtime checks pass for DB, API, frontend, and frontend proxy.

- [ ] **Step 4: Manual smoke**

Open `http://127.0.0.1:5173`. Click at least calendar, checklist, sentiment, and clock widgets. Confirm each opens a drawer. Enter Layout mode and confirm widget click no longer opens the drawer.

---

## Self-Review

- Spec coverage: every widget opens a drawer; calendar has hybrid manual plus existing data sources; Layout mode click is disabled.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: workspace ids match existing dashboard ids.
