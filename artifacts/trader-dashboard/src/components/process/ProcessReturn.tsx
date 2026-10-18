import { useSearch, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTraderProcess } from "@/hooks/useTraderProcess";
export function ProcessReturn() {
  const search = useSearch();
  const { t } = useLanguage();
  const { data } = useTraderProcess();
  const cockpit = Boolean(
    data?.session?.plan?.guidance?.cockpit ||
    data?.activeMethod?.rules.setup.startsWith("Cockpit ·"),
  );
  if (new URLSearchParams(search).get("processReturn") !== "1") return null;
  return (
    <nav aria-label={t("catalog.return")} className="pb-3">
      <Link
        href={data?.activeMethod && !cockpit ? "/?process=legacy" : "/"}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft size={16} aria-hidden />
        {t("catalog.return")}
      </Link>
    </nav>
  );
}
