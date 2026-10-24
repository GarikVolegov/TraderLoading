import { useState } from "react";
import { Link } from "wouter";
import {
  Check,
  ArrowRight,
  Shield,
  Layers,
  Activity,
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { ProcessNextAction } from "@/components/process/ProcessNextAction";
import { VerificationStart } from "@/pages/Method";
import type { ProcessMethod, ProcessState } from "@/lib/traderProcessApi";
import { useProcessMutation } from "@/hooks/useTraderProcess";
import { activateProcessMethod, advanceProcessMethod } from "@/lib/traderProcessApi";

interface DailyOrderMethodConsoleProps {
  state: ProcessState;
  readOnly?: boolean;
  onEdit: (method: ProcessMethod | null) => void;
  onAddEvidence: () => void;
}

export function DailyOrderMethodConsole({
  state,
  readOnly = false,
  onEdit,
  onAddEvidence,
}: DailyOrderMethodConsoleProps) {
  const method = state.activeMethod;
  const [review, setReview] = useState("");
  const advance = useProcessMutation(advanceProcessMethod);
  const activate = useProcessMutation(activateProcessMethod);

  if (!method) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center space-y-4">
        <SigilIcon variant="threshold" size={32} className="mx-auto text-primary" />
        <h3 className="text-lg font-bold text-foreground font-display">Nessun Metodo Operativo Attivo</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Fonda il tuo Ordine Giornaliero codificando le regole operative, i criteri di ingresso e i
          limiti del Custode della Soglia.
        </p>
        <Button onClick={() => onEdit(null)} className="font-mono text-xs">
          FONDA IL TUO METODO OPERATIVO
        </Button>
      </div>
    );
  }

  const rules = method.rules;
  const rows = state.evidence.filter((e) => e.methodVersionId === method.id);
  const guidance = state.guidance;
  const canAdvance =
    guidance?.action === "review_verification" || guidance?.action === "review_application";

  return (
    <div className="space-y-6">
      {/* ── SEZIONE STATO & PROSSIMA AZIONE DEL METODO ── */}
      <ProcessNextAction
        state={state}
        action={
          !["confirm_verification", "review_verification", "review_application"].includes(
            guidance?.action ?? "",
          )
        }
      />

      {/* Se è richiesta la conferma del protocollo di verifica */}
      {!readOnly && method.phase === "define" && guidance?.action === "confirm_verification" && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-md">
          <VerificationStart method={method} initiallyOpen />
        </div>
      )}

      {/* Azione di avanzamento di fase con revisione */}
      {!readOnly && method.phase !== "consolidate" && method.phase !== "define" && canAdvance && (
        <form
          className="rounded-2xl border border-primary/40 bg-card p-6 space-y-4 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault();
            advance.mutate(
              { id: method.id, expectedPhase: method.phase, review },
              { onSuccess: () => setReview("") },
            );
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
              Revisione e Avanzamento di Fase
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            I criteri per questa fase sono soddisfatti. Inserisci una nota di revisione per sigillare
            l&apos;avanzamento.
          </p>
          <textarea
            required
            rows={3}
            maxLength={4000}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Documenta le evidenze raccolte, la stabilità del metodo e le considerazioni di rischio..."
            className="w-full rounded-xl border border-border bg-surface-1 p-3 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <Button type="submit" disabled={advance.isPending} className="font-mono text-xs">
              {advance.isPending ? "SALVATAGGIO..." : "AVANZA ALLA FASE SUCCESSIVA"}
              <ArrowRight size={14} />
            </Button>
            <Button type="button" variant="ghost" onClick={() => onEdit(method)}>
              Crea Nuova Versione
            </Button>
          </div>
        </form>
      )}

      {/* ── BENTO GRID: REGOLE OPERATIVE DEL METODO ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <SigilIcon variant="daily-order" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  CODICE OPERATIVO
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  IMMUTABILE
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-foreground uppercase font-display">
                Regole Personali del Metodo
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(method)}
                className="font-mono text-xs border-primary/40 hover:bg-primary/10"
              >
                <SlidersHorizontal size={13} />
                <span>NUOVA VERSIONE REGOLE</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Finestre Operative */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock size={12} className="text-primary" />
              <span>Finestre Temporali</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.windows || "Nessuna finestra specificata."}
            </p>
          </div>

          {/* Setup Ciclico */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Activity size={12} className="text-emerald-400" />
              <span>Modello di Setup</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.setup || "Nessun setup specificato."}
            </p>
          </div>

          {/* Regole di Ingresso */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <ArrowRight size={12} className="text-blue-400" />
              <span>Criteri di Ingresso</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.entry || "Nessun criterio specificato."}
            </p>
          </div>

          {/* Regole di Uscita */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Check size={12} className="text-emerald-400" />
              <span>Uscita & Take Profit</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.exit || "Nessun target specificato."}
            </p>
          </div>

          {/* Invalidazione & Stop */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Shield size={12} className="text-red-400" />
              <span>Invalidazione & Stop</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.invalidation || "Nessuna invalidazione specificata."}
            </p>
          </div>

          {/* Condizioni di Attesa */}
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <RotateCcw size={12} className="text-amber-400" />
              <span>Condizioni di Attesa</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {rules.waitConditions || "Nessuna condizione di attesa specificata."}
            </p>
          </div>
        </div>

        {/* Checklist Operativa Inviolabile */}
        {rules.checklist && rules.checklist.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              Checklist del Custode della Soglia ({rules.checklist.length} punti)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rules.checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground bg-surface-1/60 p-2 rounded-lg"
                >
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── REGISTRO EVIDENZE & TEST ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground uppercase font-display">
                Evidenze di Validazione ({rows.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Campione statistico documentato per questa versione.
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onAddEvidence}
                className="font-mono text-xs"
              >
                <Plus size={13} />
                <span>AGGIUNGI EVIDENZA</span>
              </Button>
              <Link
                href={`/backtest?methodVersionId=${encodeURIComponent(method.id)}`}
                className={buttonVariants({ variant: "outline", size: "sm" }) + " font-mono text-xs"}
              >
                <span>REPLAY FORGIA</span>
              </Link>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
            Nessuna evidenza ancora registrata per questa versione. Conduci backtest o esegui
            operazioni nel Varco per raccogliere campioni.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/50 font-mono text-[10px] text-muted-foreground uppercase">
                <tr>
                  <th className="py-2.5 px-3">Finalità</th>
                  <th className="py-2.5 px-3">Fonte</th>
                  <th className="py-2.5 px-3">Net R</th>
                  <th className="py-2.5 px-3">Provenienza</th>
                  <th className="py-2.5 px-3">Costi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground uppercase">
                      {e.purpose}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{e.source}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          (e.netR ?? 0) >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"
                        }
                      >
                        {e.netR != null ? `${e.netR.toFixed(2)} R` : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{e.provenance}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{e.costsStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── STORICO VERSIONI ── */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Versioni del Metodo ({state.methods.length})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(null)}
            className="font-mono text-xs text-primary hover:text-primary"
          >
            + Nuovo Metodo da Zero
          </Button>
        </div>

        <ul className="space-y-2">
          {state.methods.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/35 p-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <strong className="text-foreground">{item.name}</strong>
                <Badge variant="gold" className="text-[10px]">
                  Versione {item.version}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  ({item.phase})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/method?version=${encodeURIComponent(item.id)}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-xs"}
                >
                  Visualizza
                </Link>
                {item.active ? (
                  <Badge variant="success" className="font-mono text-xs flex items-center gap-1">
                    <Check size={13} />
                    ATTIVA
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activate.mutate(item.id)}
                    disabled={activate.isPending}
                    className="text-xs"
                  >
                    Attiva
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
