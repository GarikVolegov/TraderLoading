import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  FlaskConical,
  Newspaper,
  Plus,
  Heart,
  Gamepad2,
  ShieldCheck,
  Zap,
  AlertTriangle,
  PanelLeftClose,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ROOT_ITEMS } from "@/lib/navHubs";
import { TOOL_GROUPS, WORKSPACE_TOOLS } from "@/lib/workspaceTools";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateJournalEntry,
  getGetJournalEntriesQueryKey,
  getGetJournalEdgeQueryKey,
} from "@workspace/api-client-react";
import { parseQuickTradeCommand, type QuickTradeParsed } from "@/lib/quickTradeCommand";
import { synestheticSealOfAction } from "@/lib/soundFx";
import { queueOfflineMutation } from "@/lib/journalOfflineSync";
import { cn } from "@/lib/utils";

const rootKeywords: Record<(typeof ROOT_ITEMS)[number]["id"], string> = {
  today: "home oggi today varco processo preparazione sessione",
  backtest: "backtest forgia passato replay simulazione verifica",
  journal: "journal diario libro verità trade",
};
const PAGES = ROOT_ITEMS.map((item) => ({ ...item, keywords: rootKeywords[item.id] }));

/**
 * Palette comandi globale (Ctrl+K / Cmd+K): navigazione rapida, azioni e Quick Trade.
 * Supporta la registrazione istantanea con sintassi "trade win/loss" o "trade buy/sell".
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateJournalEntry({
    mutation: { meta: { suppressGlobalError: true } },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setHasOpened(true);
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open && !hasOpened) return null;

  const go = (href: string) => {
    setOpen(false);
    setSearch("");
    navigate(href);
  };

  const parsedTrade = parseQuickTradeCommand(search);

  const executeQuickTrade = async (trade: QuickTradeParsed) => {
    if (isSubmitting || !trade.isValid) return;
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const tagsString = trade.tags.join(",");

      const tradeFields =
        trade.entryPrice !== undefined
          ? {
              symbol: trade.symbol,
              direction: trade.direction,
              entryPrice: trade.entryPrice,
              stopLoss: trade.stopLoss ?? null,
              exitPrice: trade.takeProfit ?? trade.entryPrice,
              profit: trade.profit,
              executionEnvironment: "real" as const,
            }
          : {
              symbol: trade.symbol,
              direction: trade.direction,
              profit: trade.profit,
              executionEnvironment: "real" as const,
            };

      const payload = {
        title: trade.title,
        content: trade.rawContent,
        tradeDate: today,
        result: trade.result,
        tags: tagsString,
        ...tradeFields,
      };

      try {
        await createMutation.mutateAsync({ data: payload });
      } catch (networkErr) {
        console.warn("Registrazione online non riuscita, salvataggio nella coda offline:", networkErr);
        await queueOfflineMutation({
          type: "create_entry",
          payload,
        });
      }

      synestheticSealOfAction();
      toast({
        title: "Operazione Sigillata",
        description: `${trade.title} registrato nel Libro della Verità con successo.`,
      });

      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJournalEdgeQueryKey() });
      setSearch("");
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore durante la registrazione";
      toast({
        title: "Errore di Registrazione",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSearch("");
      }}
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={t("command.placeholder")}
      />
      <CommandList>
        <CommandEmpty>{t("command.no_results")}</CommandEmpty>

        {parsedTrade && (
          <CommandGroup heading="AUREUS Protocol — Registrazione Istantanea">
            {parsedTrade.isValid ? (
              <CommandItem
                value={search}
                onSelect={() => executeQuickTrade(parsedTrade)}
                className="flex items-center justify-between p-3 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-[#C5A059]/40 bg-[#C5A059]/20">
                    <ShieldCheck className="h-4 w-4 text-[#E8C56A]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#E8C56A] truncate">
                        {parsedTrade.title}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/20 text-[#E8C56A] uppercase font-bold tracking-wider whitespace-nowrap">
                        {parsedTrade.symbol} {parsedTrade.direction.toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider whitespace-nowrap",
                          parsedTrade.result === "win"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : parsedTrade.result === "loss"
                            ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                            : "border-slate-500/40 bg-slate-500/15 text-slate-300",
                        )}
                      >
                        {parsedTrade.result.toUpperCase()} (
                        {parsedTrade.profit >= 0
                          ? `+€${parsedTrade.profit.toFixed(2)}`
                          : `-€${Math.abs(parsedTrade.profit).toFixed(2)}`}
                        )
                      </span>
                    </div>
                    {parsedTrade.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[#C5A059]/80">
                          Tag:
                        </span>
                        {parsedTrade.tags.map((t) => (
                          <span
                            key={t}
                            className="font-mono text-[9px] px-1 py-0.2 rounded border border-[#C5A059]/25 bg-[#C5A059]/10 text-[#E8C56A]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {parsedTrade.notes && (
                      <span className="text-xs text-slate-400 truncate mt-0.5">
                        Note: {parsedTrade.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 ml-3 flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-[#E8C56A] border border-[#C5A059]/35 bg-[#C5A059]/15 rounded px-2 py-1 whitespace-nowrap font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3 text-[#E8C56A]" />
                    Invio ↵ Sigilla
                  </span>
                </div>
              </CommandItem>
            ) : (
              <CommandItem
                value={search}
                disabled
                className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="leading-snug">{parsedTrade.error}</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        <CommandGroup heading={t("command.actions")}>
          <CommandItem
            keywords={["nuovo", "trade", "diario"]}
            onSelect={() => go("/journal?new=1")}
          >
            <Plus className="mr-2" />
            {t("command.new_trade")}
          </CommandItem>
          <CommandItem
            keywords={[
              "decompressione",
              "gioco",
              "distacco",
              "bull",
              "runner",
              "pausa",
              "relax",
              "3d",
            ]}
            onSelect={() => go("/decompressione")}
          >
            <Gamepad2 className="mr-2 text-[#C5A059]" />
            <span>Camera di Decompressione (Gioco 3D)</span>
          </CommandItem>
          <CommandItem
            keywords={["sidebar", "menu", "comprimi", "espandi", "barra", "tendina"]}
            onSelect={() => {
              setOpen(false);
              const isCollapsed = localStorage.getItem("aureus_sidebar_collapsed") === "true";
              const next = !isCollapsed;
              document.documentElement.setAttribute("data-sidebar-collapsed", next ? "true" : "false");
              try {
                localStorage.setItem("aureus_sidebar_collapsed", next ? "true" : "false");
              } catch {
                // ignore
              }
            }}
          >
            <PanelLeftClose className="mr-2 text-[#C5A059]" />
            <span>Comprimi / Espandi Barra Laterale ([ o ⌘B)</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.pages")}>
          {PAGES.map(({ href, labelKey, icon: Icon, keywords }) => (
            <CommandItem key={href} keywords={keywords.split(" ")} onSelect={() => go(href)}>
              <Icon className="mr-2" />
              {t(labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>
        {TOOL_GROUPS.map((group) => (
          <CommandGroup key={group} heading={t(`catalog.group.${group}`)}>
            {WORKSPACE_TOOLS.filter((tool) => tool.group === group).map((tool) => {
              const Icon =
                group === "context"
                  ? Newspaper
                  : group === "verification"
                    ? FlaskConical
                    : group === "materials"
                      ? BookOpen
                      : Heart;
              return (
                <CommandItem
                  key={tool.id}
                  value={`${t(tool.labelKey)} ${t(`catalog.hint.${tool.id}`)}`}
                  keywords={tool.keywords.split(" ")}
                  onSelect={() => go(tool.href)}
                >
                  <Icon className="mr-2" />
                  <span>{t(tool.labelKey)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
