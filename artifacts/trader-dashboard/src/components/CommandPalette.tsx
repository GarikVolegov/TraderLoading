import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, FlaskConical, Newspaper, Plus, Heart } from "lucide-react";
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

const rootKeywords: Record<(typeof ROOT_ITEMS)[number]["id"], string> = {
  today: "home oggi today processo preparazione sessione",
  method: "metodo method strategia protocollo verifica percorso",
  journal: "journal diario trade",
};
const PAGES = ROOT_ITEMS.map((item) => ({ ...item, keywords: rootKeywords[item.id] }));

/**
 * Palette comandi globale (Ctrl+K / Cmd+K): navigazione rapida e azioni.
 * "Nuovo trade" naviga al diario con ?new=1 (gestito da Journal).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.no_results")}</CommandEmpty>
        <CommandGroup heading={t("command.actions")}>
          <CommandItem
            keywords={["nuovo", "trade", "diario"]}
            onSelect={() => go("/journal?new=1")}
          >
            <Plus className="mr-2" />
            {t("command.new_trade")}
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
