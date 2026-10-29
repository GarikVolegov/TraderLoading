import React, { useMemo } from "react";
import { Shield, Sparkles, Compass, Flame, BookOpen, Target, HeartHandshake } from "lucide-react";

export interface MasteryPillarData {
  id: "patience" | "risk" | "technique" | "composure" | "integrity";
  name: string;
  score: number; // 0 - 100
  description: string;
}

export interface MasteryRadarChartProps {
  pillars?: MasteryPillarData[];
  overallScore?: number;
  className?: string;
}

export const DEFAULT_PILLARS: MasteryPillarData[] = [
  {
    id: "patience",
    name: "Pazienza nell'Attesa",
    score: 88,
    description: "Attesa della finestra temporale e del contesto HTF conforme",
  },
  {
    id: "risk",
    name: "Rispetto del Rischio",
    score: 96,
    description: "Presenza inderogabile dello stop loss e rischio unitario ≤ 1%",
  },
  {
    id: "technique",
    name: "Precisione Tecnica",
    score: 85,
    description: "Allineamento rigoroso alle 4 Fasi del Custode della Soglia",
  },
  {
    id: "composure",
    name: "Fermezza Emotiva",
    score: 90,
    description: "Assenza di overtrading, controllo del drawdown e respiro tattico",
  },
  {
    id: "integrity",
    name: "Integrità del Registro",
    score: 94,
    description: "Compilazione sistematica del Libro della Verità con schematica",
  },
];

const PILLAR_ICONS = {
  patience: Compass,
  risk: Shield,
  technique: Target,
  composure: Flame,
  integrity: BookOpen,
};

export function MasteryRadarChart({
  pillars = DEFAULT_PILLARS,
  overallScore,
  className = "",
}: MasteryRadarChartProps) {
  const cx = 150;
  const cy = 135;
  const maxR = 85;

  const averageScore = useMemo(() => {
    if (overallScore != null) return overallScore;
    const sum = pillars.reduce((acc, p) => acc + p.score, 0);
    return Math.round(sum / pillars.length);
  }, [pillars, overallScore]);

  // Calcolo delle 5 direzioni angolari (partendo dall'alto a ore 12: -PI/2)
  const angles = useMemo(() => {
    return pillars.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);
  }, [pillars]);

  // Generatore di punti del poligono regolare a raggio r
  const getPolygonPoints = (r: number) => {
    return angles
      .map((angle) => {
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Punti del poligono dati effettivo
  const dataPoints = useMemo(() => {
    return pillars.map((p, i) => {
      const clampedScore = Math.max(10, Math.min(100, p.score));
      const r = (clampedScore / 100) * maxR;
      const angle = angles[i];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return { x, y, score: p.score };
    });
  }, [pillars, angles, maxR]);

  const dataPolygonString = dataPoints.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  // Coordinate delle etichette esterne ai vertici
  const labelPositions = useMemo(() => {
    const labelR = maxR + 26;
    return pillars.map((p, i) => {
      const angle = angles[i];
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);

      // Posizionamento orizzontale del testo
      let textAnchor: "middle" | "start" | "end" = "middle";
      if (Math.cos(angle) > 0.3) textAnchor = "start";
      else if (Math.cos(angle) < -0.3) textAnchor = "end";

      return { x, y, textAnchor, pillar: p };
    });
  }, [pillars, angles, maxR]);

  return (
    <div
      role="region"
      aria-label="Pentagramma della Maestria AUREUS"
      className={`rounded-2xl border border-[#C5A059]/35 bg-[#07080b]/95 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.6)] backdrop-blur-md flex flex-col items-center select-none ${className}`}
    >
      {/* TESTATA GRAFICO */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A]">
            <Sparkles size={14} />
          </div>
          <div>
            <h4 className="font-mono text-xs uppercase font-extrabold tracking-widest text-[#E8C56A]">
              Pentagramma della Maestria
            </h4>
            <p className="text-[10px] text-muted-foreground font-mono">
              I 5 Pilastri della Disciplina Operativa AUREUS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] font-mono text-[10.5px] font-bold">
          <span>Indice:</span>
          <span className="text-white whitespace-nowrap">{averageScore}%</span>
        </div>
      </div>

      {/* SVG RADAR CHART GEOMETRIA SACRA */}
      <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center my-1">
        <svg
          viewBox="0 0 300 280"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Grafico a radar dei 5 pilastri della maestria con punteggio medio ${averageScore}%`}
        >
          <defs>
            {/* Gradiente AUREUS Sovrano per l'area del poligono */}
            <radialGradient id="mastery-radar-gradient" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#C5A059" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#C5A059" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#E8C56A" stopOpacity="0.05" />
            </radialGradient>

            {/* Bagliore dorato */}
            <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Griglie Concentriche a Pentagono Regolare (33%, 66%, 100%) */}
          {[0.33, 0.66, 1.0].map((level, idx) => (
            <polygon
              key={level}
              points={getPolygonPoints(maxR * level)}
              className="fill-transparent stroke-[#C5A059]/20"
              strokeWidth={idx === 2 ? "1.5" : "1"}
              strokeDasharray={idx < 2 ? "3 3" : undefined}
            />
          ))}

          {/* Raggi da Centro a Vertici */}
          {angles.map((angle, i) => {
            const x = cx + maxR * Math.cos(angle);
            const y = cy + maxR * Math.sin(angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                className="stroke-[#C5A059]/25"
                strokeWidth="1"
              />
            );
          })}

          {/* Poligono Dati Effettivi dell'Operatore */}
          <polygon
            points={dataPolygonString}
            fill="url(#mastery-radar-gradient)"
            className="stroke-[#E8C56A]"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#gold-glow)"
          />

          {/* Nodi Vertici Dati */}
          {dataPoints.map((pt, i) => (
            <g key={i}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4"
                className="fill-[#E8C56A] stroke-[#07080b]"
                strokeWidth="2"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r="7"
                className="fill-transparent stroke-[#E8C56A]/40"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Etichette dei 5 Vertici */}
          {labelPositions.map((lbl, i) => {
            return (
              <g key={i} transform={`translate(${lbl.x}, ${lbl.y})`}>
                <text
                  textAnchor={lbl.textAnchor}
                  className="fill-[#E8C56A] font-mono text-[9px] font-bold tracking-wider"
                  dy="-2"
                >
                  {lbl.pillar.name.toUpperCase()}
                </text>
                <text
                  textAnchor={lbl.textAnchor}
                  className="fill-white font-mono text-[10px] font-extrabold"
                  dy="10"
                >
                  {lbl.pillar.score}%
                </text>
              </g>
            );
          })}

          {/* Sigillo Centrale Aureus */}
          <circle cx={cx} cy={cy} r="3" className="fill-[#C5A059]" />
        </svg>
      </div>

      {/* BENTO GRID DEI 5 PILASTRI */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-white/10">
        {pillars.map((p) => {
          const Icon = PILLAR_ICONS[p.id] || Shield;
          const isSuperior = p.score >= 90;
          return (
            <div
              key={p.id}
              className="flex flex-col p-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-[#C5A059]/30 transition-all text-left"
              title={p.description}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <Icon size={12} className="text-[#C5A059] shrink-0" />
                <span
                  className={`font-mono text-[10px] font-bold whitespace-nowrap ${
                    isSuperior ? "text-[#10b981]" : "text-[#E8C56A]"
                  }`}
                >
                  {p.score}%
                </span>
              </div>
              <span className="font-mono text-[9px] font-semibold text-foreground/90 truncate">
                {p.name}
              </span>
              <span className="text-[8px] text-muted-foreground truncate mt-0.5">
                {isSuperior ? "Maestria" : "In Convalida"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
