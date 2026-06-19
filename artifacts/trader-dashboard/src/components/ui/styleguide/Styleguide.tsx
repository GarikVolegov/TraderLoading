import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-label">{title}</h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-14 w-20 rounded-md border border-border-subtle"
        style={{ backgroundColor: `hsl(var(${varName}))` }}
      />
      <span className="text-[10px] text-text-lo">{name}</span>
    </div>
  );
}

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-mono">Design System — Liquid Glass / Neutral Jade</h1>
        <p className="text-text-lo">Single source of truth for tokens, material, motion &amp; primitives.</p>
      </header>

      <Section title="Neutral ramp">
        <Swatch name="surface-0" varName="--surface-0" />
        <Swatch name="surface-1" varName="--surface-1" />
        <Swatch name="surface-2" varName="--surface-2" />
        <Swatch name="surface-3" varName="--surface-3" />
        <Swatch name="border-subtle" varName="--border-subtle" />
        <Swatch name="text-hi" varName="--text-hi" />
        <Swatch name="text-lo" varName="--text-lo" />
      </Section>

      <Section title="Accent & P&L">
        <Swatch name="jade" varName="--accent-jade" />
        <Swatch name="win" varName="--success" />
        <Swatch name="loss" varName="--destructive" />
        <Swatch name="be" varName="--warning" />
      </Section>

      <Section title="Glass tiers">
        <div className="glass-bar h-20 w-40 rounded-lg p-3 text-xs">glass-bar</div>
        <div className="glass-panel h-20 w-40 p-3 text-xs">glass-panel</div>
        <div className="glass-raised h-20 w-40 p-3 text-xs">glass-raised</div>
        <div className="glass-inset h-20 w-40 p-3 text-xs">glass-inset</div>
      </Section>

      <Section title="Motion">
        <div className="glass-panel animate-fade-in-up h-16 w-24 p-2 text-[10px]">fade-in-up</div>
        <div className="glass-panel animate-float h-16 w-24 p-2 text-[10px]">float</div>
        <div className="glass-panel animate-glow-pulse h-16 w-24 p-2 text-[10px]">glow-pulse</div>
        <div className="animate-shimmer h-16 w-24 rounded-md" />
      </Section>

      <Section title="Buttons">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="glass">Glass</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Section>

      <Section title="Card / Badge / Input">
        <Card className="w-64">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-text-lo text-sm">Liquid-glass card body.</p>
            <div className="flex gap-2">
              <Badge>Default</Badge>
            </div>
            <Input placeholder="Glass-inset input" />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
