import { Link } from "wouter";
import { ClipboardCheck, ArrowRight, Check, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import { processText } from "@/lib/processCopy";
import { useLanguage } from "@/contexts/LanguageContext";

/** Every surface reads the method/session confirmations persisted by Oggi. */
export function ChecklistDashboardWidget() {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof processText>[1]) => processText(language, key);
  const query = useTraderProcess();
  const session = query.data?.session;
  const criteria =
    session?.rulesSnapshot.checklist ?? query.data?.activeMethod?.rules.checklist ?? [];
  return (
    <Card>
      <WidgetHeader icon={<ClipboardCheck size={16} />} title={copy("checklist")} />
      <CardContent className="space-y-4">
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {copy("loading")}
          </p>
        ) : query.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {copy("loadError")}
          </p>
        ) : (
          <ul className="space-y-3">
            {criteria.map((text, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                {session?.checklist[index] ? (
                  <Check size={16} className="shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>{text}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={criteria.length ? "/" : "/method?section=checklist"}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
        >
          {copy(criteria.length ? "confirmPreparation" : "openMethod")}
          <ArrowRight size={15} />
        </Link>
      </CardContent>
    </Card>
  );
}
