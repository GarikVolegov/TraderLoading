import { type ProjectionBands } from "@/lib/equityProjection";

interface EquityCurveChartProps {
  realized: number[];
  bands: ProjectionBands;
  projectionSteps: number;
}

const W = 560;
const H = 150;
const PAD = 8;
const ACCENT_GREEN = "hsl(142 71% 45%)";
const PROJ_BLUE = "hsl(210 90% 62%)";

export function EquityCurveChart({ realized, bands, projectionSteps }: EquityCurveChartProps) {
  const histN = realized.length;
  const span = Math.max(1, histN - 1 + projectionSteps);
  const allV = [...realized, ...bands.p10, ...bands.p90];
  const max = Math.max(...allV, 0);
  const min = Math.min(...allV, 0);
  const xOf = (idx: number) => PAD + (idx / span) * (W - PAD * 2);
  const yOf = (v: number) => H - PAD - ((v - min) / (max - min || 1)) * (H - PAD * 2);

  const histPts = realized.map((v, i) => [xOf(i), yOf(v)] as const);
  const histLine = histPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastPt = histPts[histPts.length - 1] ?? ([xOf(0), yOf(0)] as const);
  const histArea = `${histLine} L${lastPt[0].toFixed(1)},${H} L${(histPts[0]?.[0] ?? PAD).toFixed(1)},${H} Z`;

  const px = (k: number) => xOf(histN - 1 + k);
  const bandPath = (lo: number[], hi: number[]) => {
    const up = hi.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const down = lo
      .map((_, k) => `L${px(lo.length - 1 - k).toFixed(1)},${yOf(lo[lo.length - 1 - k]).toFixed(1)}`)
      .join(" ");
    return `${up} ${down} Z`;
  };
  const medianLine = bands.p50.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const simPath = (path: number[]) =>
    path.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const divX = px(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT_GREEN} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT_GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={bandPath(bands.p10, bands.p90)} fill={PROJ_BLUE} fillOpacity="0.1" />
      <path d={bandPath(bands.p25, bands.p75)} fill={PROJ_BLUE} fillOpacity="0.14" />
      {bands.samplePaths.map((p, i) => (
        <path key={i} d={simPath(p)} fill="none" stroke={PROJ_BLUE} strokeOpacity="0.12" strokeWidth="1" />
      ))}
      <path d={medianLine} fill="none" stroke={PROJ_BLUE} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

      <line x1={divX} y1={PAD} x2={divX} y2={H - PAD} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 3" />

      <path d={histArea} fill="url(#eqfill)" />
      <path d={histLine} fill="none" stroke={ACCENT_GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {histPts.length > 0 && <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={ACCENT_GREEN} />}
      {bands.p50.length > 0 && (
        <circle cx={px(projectionSteps)} cy={yOf(bands.p50[projectionSteps])} r="3" fill={PROJ_BLUE} />
      )}
    </svg>
  );
}
