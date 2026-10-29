import { Link } from "wouter";
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  Coins,
  Calendar,
  HeartPulse,
  Compass,
  BookOpen,
  FlaskConical,
  GraduationCap,
  AlertTriangle,
} from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { Badge } from "@/components/ui/badge";
import type { ProcessMethod, ProcessState } from "@/lib/traderProcessApi";
import type { FinancialProfile } from "@/lib/financialProfileApi";

interface StageCardProps {
  state?: ProcessState | null;
  method?: ProcessMethod | null;
  finProfile?: FinancialProfile | null;
  morningDone?: boolean;
  onOpenRoutine?: () => void;
}

export function DailyOrderStages({
  state,
  method,
  finProfile,
  morningDone = false,
}: StageCardProps) {
  const session = state?.session;
  const isSessionActive = Boolean(session && session.state !== "closed");
  const isSessionClosed = session?.state === "closed";
  const rules = method?.rules;

  // Calcoli finanziari e limiti
  const tradingAllocation = finProfile?.tradingAllocation ?? 0;
  const maxDailyLoss = Number(rules?.maxDailyLoss ?? 0);
  const riskPerTrade = Number(rules?.riskPerTrade ?? 0);
  const currency = rules?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      {/* ── STAGE 1: PREPARAZIONE & ALLINEAMENTO (PRE-MARKET) ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <SigilIcon variant="threshold" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  TAPPA I // PRE-SESSIONE
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  FONDAMENTA
                </Badge>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground uppercase font-display">
                1. Preparazione & Allineamento
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success" className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 size={13} />
              <span>PARAMETRI CONFERMATI</span>
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          {/* Box 1: Assetto Patrimoniale & Custode della Soglia */}
          <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Coins size={13} />
                  Limiti Patrimoniali
                </span>
                <Link href="/patrimonio" className="text-[10px] text-primary hover:underline">
                  Modifica
                </Link>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Capitale Allocato:</span>
                  <strong className="font-mono font-bold text-foreground">
                    {tradingAllocation > 0
                      ? `${tradingAllocation.toLocaleString("it-IT")} ${currency}`
                      : "Non definito"}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Max Loss Oggi:</span>
                  <Badge variant="destructive" className="font-mono text-xs">
                    -{maxDailyLoss.toLocaleString("it-IT")} {currency}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Rischio / Trade:</span>
                  <span className="font-mono font-bold text-foreground">
                    {riskPerTrade} {currency}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface-1/80 p-2 text-[11px] text-muted-foreground flex items-center gap-2">
              <Shield size={14} className="text-primary shrink-0" />
              <span>Custode della Soglia: stop automatico al raggiungimento della perdita max.</span>
            </div>
          </div>

          {/* Box 2: Routine Mentale & Focus */}
          <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <HeartPulse size={13} />
                  Centratura Psicologica
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">ZEN ZONE</span>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Verifica il tuo stato emotivo, respira e dichiara la tua intenzione prima di
                  osservare il grafico.
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-foreground">
                    {morningDone ? "Routine Mattutina Completata" : "Pronto per l'allineamento"}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/routine"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <span>APRI ROUTINE MENTALE</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Box 3: Radar Macro & Arsenale */}
          <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Calendar size={13} />
                  Radar Macro Economico
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">ARSENALE</span>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Controlla i release ad alto impatto (NFP, CPI, Tassi) che possono invalidare la
                  struttura.
                </p>
                <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                  <span>Nessun ordine nei 15 min pre/post news ad alto impatto.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/?vista=strumenti&widget=calendar"
                className="flex-1 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-primary/40 transition-colors"
              >
                <span>CALENDARIO MACRO</span>
              </Link>
              <Link
                href="/?vista=strumenti&strumento=calcolatore"
                className="flex-1 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-primary/40 transition-colors"
              >
                <span>CALCOLA LOTTI</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAGE 2: ACCESSO AL VARCO (LIVE SESSION) ── */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-5 sm:p-7 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/20 text-primary shadow-sm">
              <SigilIcon variant="threshold" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  TAPPA II // ESECUZIONE OPERATIVA
                </span>
                <Badge variant="success" className="font-mono text-[10px] uppercase">
                  IL VARCO APERTO
                </Badge>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground uppercase font-display">
                2. Accesso a Il Varco & Esecuzione
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground uppercase">
              {isSessionActive
                ? "SESSIONE APERTA"
                : isSessionClosed
                  ? "SESSIONE CHIUSA"
                  : "PRONTO AD OPERARE"}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-5">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>COCKPIT OPERATIVO MULTI-COLONNA ATTIVO</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Varcare la soglia significa abbandonare ogni tentazione discrezionale ed eseguire
              soltanto i setup previsti dal Metodo. Verifica lo scenario sul grafico, convalida il
              trigger e rispetta il limite massimo di contratti.
            </p>

            {/* Pillole regole chiave metodo */}
            {rules && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {rules.windows && (
                  <span className="rounded-md border border-border bg-secondary/35 px-2.5 py-1 font-mono text-[11px] text-foreground">
                    Finestre: <strong>{rules.windows}</strong>
                  </span>
                )}
                {rules.maxDailyTrades && (
                  <span className="rounded-md border border-border bg-secondary/35 px-2.5 py-1 font-mono text-[11px] text-foreground">
                    Max Esecuzioni: <strong>{rules.maxDailyTrades}</strong>
                  </span>
                )}
                {rules.markets && rules.markets.length > 0 && (
                  <span className="rounded-md border border-border bg-secondary/35 px-2.5 py-1 font-mono text-[11px] text-foreground">
                    Mercati: <strong>{rules.markets.join(", ")}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Grandioso Hero CTA button */}
          <div className="shrink-0 pt-2 lg:pt-0">
            <Link
              href="/"
              className="inline-flex min-h-14 w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-primary hover:bg-primary/90 px-8 py-4 font-mono text-sm font-bold text-primary-foreground uppercase tracking-wider shadow-md hover:shadow-primary/20 transition-all hover:scale-[1.01]"
            >
              <Compass size={18} />
              <span>{isSessionActive ? "RIPRENDI LA SESSIONE NEL VARCO" : "VARCA LA SOGLIA"}</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STAGE 3: IL SIGILLO DELLA VERITÀ (POST-SESSIONE) ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-400">
              <SigilIcon variant="book-of-truth" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  TAPPA III // POST-SESSIONE
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  RESPONSABILITÀ
                </Badge>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground uppercase font-display">
                3. Il Sigillo della Verità & Diario
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1.5 text-xs text-blue-400 border-blue-500/30 bg-blue-500/10">
              <BookOpen size={13} />
              <span>VERITÀ INVIOLABILE</span>
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pt-5">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
              A mercati chiusi o terminata la sessione, ogni trade eseguito deve essere registrato ne
              Il Libro della Verità. Valuta la tua aderenza alle regole del piano, annota lo stato
              emotivo e sigilla il recap della giornata.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Shield size={13} className="text-emerald-400" />
              <span>
                Zero overtrading = Indice di Integrità intatto verso il Grado successivo.
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              href="/journal"
              className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-6 py-3 font-mono text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition-all"
            >
              <span>APRI IL LIBRO DELLA VERITÀ</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STAGE 4: ADDESTRAMENTO & ASCESA (OFF-MARKET) ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <SigilIcon variant="forge" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  TAPPA IV // ADDESTRAMENTO CONTINUO
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  MAESTRIA
                </Badge>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground uppercase font-display">
                4. Addestramento, Studio & Ascesa
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">OFF-MARKET & WEEKEND</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          {/* Card La Forgia */}
          <Link
            href="/backtest"
            className="group flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 hover:border-amber-500/40 hover:bg-secondary/60 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <FlaskConical size={16} />
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:text-amber-400 transition-colors"
                />
              </div>
              <div className="font-bold text-sm text-foreground group-hover:text-amber-400 transition-colors">
                La Forgia del Passato
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Backtest bar-by-bar per raccogliere evidenze e validare il metodo prima di operare a
                mercato vivo.
              </p>
            </div>
            <div className="pt-3 font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              AVVIA SIMULAZIONE &rarr;
            </div>
          </Link>

          {/* Card La Dottrina */}
          <Link
            href="/academy"
            className="group flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 hover:border-purple-500/40 hover:bg-secondary/60 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
                  <GraduationCap size={16} />
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:text-purple-400 transition-colors"
                />
              </div>
              <div className="font-bold text-sm text-foreground group-hover:text-purple-400 transition-colors">
                La Dottrina del Tempo
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Lezioni, syllabus e principi di struttura di mercato della AUREUS Academy.
              </p>
            </div>
            <div className="pt-3 font-mono text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              CONSULTA LEZIONI &rarr;
            </div>
          </Link>

          {/* Card I 5 Gradi */}
          <Link
            href="/milestones"
            className="group flex flex-col justify-between rounded-xl border border-border/50 bg-secondary/35 p-4 hover:border-primary/40 hover:bg-secondary/60 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <SigilIcon variant="hierarchy" size={16} />
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:text-primary transition-colors"
                />
              </div>
              <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                I 5 Gradi di Ascesa
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Progressione del rango da Neofita a Fondatore d&apos;Eredità basata sulla disciplina.
              </p>
            </div>
            <div className="pt-3 font-mono text-[10px] font-bold text-primary uppercase tracking-wider">
              VERIFICA RANGO &rarr;
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
