import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import type { ProcessState } from "@/lib/traderProcessApi";

/** One presentation for the server-owned priority, across every workspace. */
export function ProcessNextAction({ state, action = true }: { state: ProcessState; action?: boolean }) {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const guidance = state.guidance;
  if (!guidance) return null;
  return <section className="process-next-step space-y-3" aria-label={copy("next")}>
    <p className="process-eyebrow">{copy("next")}</p>
    <h2 className="text-xl font-semibold tracking-tight">{copy(guidance.action)}</h2>
    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy(guidance.reason)}</p>
    {guidance.nextAvailableAt && <p className="font-mono text-sm">{guidance.nextAvailableAt}</p>}
    {guidance.blockers.length > 0 && <ul className="space-y-2 text-sm text-muted-foreground">{guidance.blockers.map(check => <li key={check.key}>{check.detail || check.label}</li>)}</ul>}
    {action && guidance.action !== "done" && <Link href={guidance.href} className={buttonVariants() + " min-h-11"}>{copy(guidance.action === "collect_evidence" ? "recordTest" : guidance.action)}<ArrowRight size={16} /></Link>}
  </section>;
}
