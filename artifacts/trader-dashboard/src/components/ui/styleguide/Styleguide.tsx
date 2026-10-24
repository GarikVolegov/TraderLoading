import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/StatTile";
import { SigilIcon } from "@/components/ui/SigilIcon";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">{title}</h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-14 w-24 rounded-lg border border-border shadow-inner"
        style={{ backgroundColor: `hsl(var(${varName}))` }}
      />
      <span className="font-mono text-[10px] text-muted-foreground uppercase">{name}</span>
    </div>
  );
}

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-2 border-b border-border/60 pb-6">
        <div className="flex items-center gap-2">
          <SigilIcon variant="threshold" size={24} className="text-primary" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
            LIMEN PROTOCOL // LIVING DESIGN SYSTEM
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-display">
          Architectural Monolith / Obsidian Glass
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Il sistema visivo ufficiale di LIMEN PROTOCOL: palette Nero Ossidiana, Pietra Antracite, Oro Brunito (#C5A059),
          Cremisi Scuro e tipografia Cinzel, Space Grotesk e JetBrains Mono.
        </p>
      </header>

      <Section title="Institutional Palette · Monolith & Accent">
        <Swatch name="surface-0 (Ossidiana)" varName="--surface-0" />
        <Swatch name="surface-1 (Pietra)" varName="--surface-1" />
        <Swatch name="surface-2 (Slate)" varName="--surface-2" />
        <Swatch name="surface-3 (Inset)" varName="--surface-3" />
        <Swatch name="border-subtle" varName="--border-subtle" />
        <Swatch name="oro-brunito" varName="--primary" />
        <Swatch name="cremisi" varName="--destructive" />
        <Swatch name="verde-p&l" varName="--success" />
        <Swatch name="ambra-be" varName="--warning" />
      </Section>

      <Section title="Typography · 3-Tier Hierarchy">
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6 w-full">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">FONT-DISPLAY // CINZEL</span>
            <p className="text-2xl font-black uppercase tracking-wider text-foreground font-display">
              Limen Protocol · Il Varco Operativo
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">FONT-SANS // SPACE GROTESK</span>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">
              Interfaccia ergonomica ad alta leggibilità, metriche contestuali e disciplina chirurgica.
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">FONT-MONO // JETBRAINS MONO</span>
            <p className="text-sm font-mono text-foreground font-bold tracking-wider">
              XAUUSD · 1.00 LOTTO · +2.45R · 100% INTEGRITÀ · CET 14:30
            </p>
          </div>
        </div>
      </Section>

      <Section title="Opaque Surfaces · Architectural Panels">
        <div className="glass-bar h-20 w-44 rounded-xl p-3 text-xs border border-border">glass-bar</div>
        <div className="glass-panel h-20 w-44 rounded-xl p-3 text-xs border border-border">glass-panel</div>
        <div className="glass-raised h-20 w-44 rounded-xl p-3 text-xs border border-border">glass-raised</div>
        <div className="glass-inset h-20 w-44 rounded-xl p-3 text-xs border border-border">glass-inset</div>
      </Section>

      <Section title="Stat Tiles">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <StatTile label="CAPITALE TOTALE" value="100.000 €" size="md" tone="gold" subtitle="Patrimonio Sigillato" />
          <StatTile label="WIN RATE" value="68.4%" size="md" tone="success" subtitle="Ultimi 30 giorni" />
          <StatTile label="DRAWDOWN MAX" value="-1.2%" size="md" tone="destructive" subtitle="Soglia protetta" />
          <StatTile label="PROFIT FACTOR" value="2.35" size="md" tone="primary" subtitle="Rendimento atteso" />
        </div>
      </Section>

      <Section title="Badges · Semantic Tokens">
        <Badge variant="gold">GOLD / PRIMARIO</Badge>
        <Badge variant="success">SUCCESS / VERDE P&amp;L</Badge>
        <Badge variant="destructive">DESTRUCTIVE / PERDITA</Badge>
        <Badge variant="crimson">CRIMSON / CREMISI</Badge>
        <Badge variant="warning">WARNING / ATTENZIONE</Badge>
        <Badge variant="secondary">SECONDARY / NEUTRO</Badge>
        <Badge variant="outline">OUTLINE / PROFILO</Badge>
        <Badge variant="muted">MUTED / SUBACQUEO</Badge>
        <Badge variant="brand">BRAND / LIMEN</Badge>
      </Section>

      <Section title="Buttons · Action Tokens">
        <Button variant="default">Oro Brunito (Default)</Button>
        <Button variant="secondary">Pietra Antracite (Secondary)</Button>
        <Button variant="outline">Grigio Ferro (Outline)</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Cremisi (Destructive)</Button>
        <Button variant="glass">Glass Surface</Button>
      </Section>

      <Section title="Card / Input Showcase">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Custode della Soglia</CardTitle>
            <CardDescription>Parametri di protezione del capitale attivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Limiti invalicabili e regole codificate per la sessione corrente.
            </p>
            <div className="flex gap-2">
              <Badge variant="gold">100% REGOLA</Badge>
              <Badge variant="success">ATTIVO</Badge>
            </div>
            <Input placeholder="Inserisci nota operativa..." />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
