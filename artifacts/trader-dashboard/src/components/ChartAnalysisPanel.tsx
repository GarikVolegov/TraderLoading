import { uiText } from "@/contexts/LanguageContext";
import type {
  ChartAnalysisState,
  SessionBoxId,
  SessionBoxSettings,
  VolumeProfileSettings,
  VwapSettings,
} from "./chartAnalysisTypes";

interface ChartAnalysisPanelProps {
  analysisState: ChartAnalysisState;
  estimatedVolume: boolean;
  onVwapChange: (settings: VwapSettings) => void;
  onVolumeProfileChange: (settings: VolumeProfileSettings) => void;
  onSessionChange: (id: SessionBoxId, settings: SessionBoxSettings) => void;
  onDefaultDrawingStyleChange: (style: ChartAnalysisState["defaultDrawingStyle"]) => void;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs normal-case tracking-normal text-foreground"
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-9 rounded border border-border bg-transparent"
      />
    </label>
  );
}

export function ChartAnalysisPanel({
  analysisState,
  estimatedVolume,
  onVwapChange,
  onVolumeProfileChange,
  onSessionChange,
  onDefaultDrawingStyleChange,
}: ChartAnalysisPanelProps) {
  const { vwap, volumeProfile } = analysisState.indicators;
  const style = analysisState.defaultDrawingStyle;
  const activeSessions = Object.values(analysisState.sessionBoxes).filter((session) => session.enabled).length;
  const activeIndicators = [vwap.enabled, volumeProfile.enabled].filter(Boolean).length;

  return (
    <div
      data-testid="chart-analysis-panel"
      className="absolute right-2 top-2 z-20 w-[min(310px,calc(100%-72px))] rounded-lg border border-border/50 bg-background/90 p-3 shadow-xl backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold leading-tight">{uiText("auto.ui.aa653bb2bd")}</h4>
          {estimatedVolume && <p className="text-[10px] text-orange-300">{uiText("auto.ui.a6652efb4f")}</p>}
        </div>
      </div>

      <div data-testid="analysis-state-strip" className="mb-3 grid grid-cols-3 gap-1 rounded-md border border-border/40 bg-card/55 p-1">
        <div className="rounded bg-background/70 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.339f7cc2f8")}</div>
          <div className="text-xs font-mono font-bold">{activeIndicators}/2</div>
        </div>
        <div className="rounded bg-background/70 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.ebff7a6dc6")}</div>
          <div className="text-xs font-mono font-bold">{activeSessions}/3</div>
        </div>
        <div className="rounded bg-background/70 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.bfa50c7a38")}</div>
          <div className="text-xs font-mono font-bold">{analysisState.drawings.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        <section className="space-y-2">
          <ToggleRow label="VWAP giornaliero" checked={vwap.enabled} onChange={(enabled) => onVwapChange({ ...vwap, enabled })} />
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Colore" value={vwap.color} onChange={(color) => onVwapChange({ ...vwap, color })} />
            <NumberInput label="Spessore" value={vwap.lineWidth} min={1} max={5} onChange={(lineWidth) => onVwapChange({ ...vwap, lineWidth })} />
          </div>
        </section>

        <section className="space-y-2 border-t border-border/40 pt-3">
          <ToggleRow
            label="Volume Profile daily"
            checked={volumeProfile.enabled}
            onChange={(enabled) => onVolumeProfileChange({ ...volumeProfile, enabled })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Righe" value={volumeProfile.rows} min={4} max={100} onChange={(rows) => onVolumeProfileChange({ ...volumeProfile, rows })} />
            <NumberInput
              label="Value area"
              value={volumeProfile.valueAreaPercent}
              min={1}
              max={100}
              onChange={(valueAreaPercent) => onVolumeProfileChange({ ...volumeProfile, valueAreaPercent })}
            />
            <NumberInput label="Opacita" value={volumeProfile.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onVolumeProfileChange({ ...volumeProfile, opacity })} />
            <NumberInput label="Larghezza" value={volumeProfile.width} min={48} max={220} onChange={(width) => onVolumeProfileChange({ ...volumeProfile, width })} />
          </div>
        </section>

        <section className="space-y-2 border-t border-border/40 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.d8a77b8dd3")}</div>
          {(Object.keys(analysisState.sessionBoxes) as SessionBoxId[]).map((id) => {
            const session = analysisState.sessionBoxes[id];
            return (
              <div key={id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <ToggleRow label={session.label} checked={session.enabled} onChange={(enabled) => onSessionChange(id, { ...session, enabled })} />
                <input
                  type="color"
                  value={session.color}
                  onChange={(event) => onSessionChange(id, { ...session, color: event.target.value })}
                  className="h-7 w-9 rounded border border-border bg-transparent"
                  aria-label={`${session.label} colore`}
                />
                <input
                  type="number"
                  value={session.opacity}
                  min={0}
                  max={0.4}
                  step={0.01}
                  onChange={(event) => onSessionChange(id, { ...session, opacity: Number(event.target.value) })}
                  className="h-7 w-14 rounded-md border border-border bg-background px-1 text-[11px]"
                  aria-label={`${session.label} opacita`}
                />
              </div>
            );
          })}
        </section>

        <section className="space-y-2 border-t border-border/40 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.ee55a9166a")}</div>
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Linea" value={style.stroke} onChange={(stroke) => onDefaultDrawingStyleChange({ ...style, stroke })} />
            <ColorInput label="Fill" value={style.fill} onChange={(fill) => onDefaultDrawingStyleChange({ ...style, fill })} />
            <NumberInput label="Spessore" value={style.strokeWidth} min={1} max={8} onChange={(strokeWidth) => onDefaultDrawingStyleChange({ ...style, strokeWidth })} />
            <NumberInput label="Opacita" value={style.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onDefaultDrawingStyleChange({ ...style, opacity })} />
          </div>
        </section>
      </div>
    </div>
  );
}
