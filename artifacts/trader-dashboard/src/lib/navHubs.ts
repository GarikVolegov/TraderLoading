import { hasExplicitCenterView } from "./workspaceNavigation";
import { Sunrise, BookOpen, Route, Library, MessagesSquare, FlaskConical } from "lucide-react";

export const ROOT_ITEMS = [
  { id: "today", href: "/", icon: Sunrise, labelKey: "process.nav.today" },
  { id: "method", href: "/method", icon: Route, labelKey: "process.nav.method" },
  { id: "journal", href: "/journal", icon: BookOpen, labelKey: "nav.journal" },
] as const;
export const SECONDARY_ITEMS = [
  { id: "resources", href: "/resources", icon: Library, labelKey: "process.nav.resources" },
  { id: "backtest", href: "/backtest", icon: FlaskConical, labelKey: "nav.backtest" },
  { id: "social", href: "/chat", icon: MessagesSquare, labelKey: "process.nav.social" },
] as const;
export const NAV_ITEMS = [...ROOT_ITEMS, ...SECONDARY_ITEMS] as const;

export function rootDestination(
  location: string,
  search = "",
): (typeof NAV_ITEMS)[number]["id"] | undefined {
  const [path, embeddedQuery = ""] = location.split("?");
  const params = new URLSearchParams(search || embeddedQuery);
  if (path === "/") return hasExplicitCenterView(params.toString()) ? "resources" : "today";
  if (path === "/method" || path === "/checklist") return "method";
  if (path === "/tools" || path === "/backtest" || path.startsWith("/backtest/")) return "backtest";
  if (
    [
      "/resources",
      "/library",
      "/wiki",
      "/routine",
      "/missions",
      "/calendar",
      "/milestones",
      "/news",
      "/clock",
      "/settings",
      "/support",
      "/dashboard/widgets",
    ].includes(path)
  )
    return "resources";
  if (
    ["/chat", "/tornei"].some((route) => path === route || path.startsWith(`${route}/`))
  )
    return "social";
  if (
    path === "/journal" &&
    params.get("t") === "piano" &&
    (!params.has("vista") || params.get("vista") === "oggi")
  )
    return "today";
  if (path === "/journal" && params.get("t") === "piano") return "resources";
  if (["/journal", "/broker"].includes(path)) return "journal";
  return undefined;
}
