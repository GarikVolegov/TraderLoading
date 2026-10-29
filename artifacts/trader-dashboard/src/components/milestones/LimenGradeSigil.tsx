import React from "react";
import { cn } from "@/lib/utils";
import type { LimenGradeNumber } from "../../../../../contracts/limenGrades";

export interface LimenGradeSigilProps {
  readonly grade: number; // 1..5 (clamped)
  readonly size?: number; // pixel width/height
  readonly className?: string;
  readonly detailed?: boolean; // render full ornate outer text & micro-engraving
  readonly animate?: boolean; // subtle ambient rotation/gleam
  readonly idPrefix?: string; // unique prefix for SVG defs/gradients
  readonly userName?: string; // personalized operator username
  readonly customGradeTitle?: string; // personalized grade title override
  readonly customGradeLabel?: string; // personalized grade label, e.g. "GRADO II"
}

/**
 * Returns canonical Roman numeral for a given grade 1..5.
 */
export function getGradeRoman(grade: number): string {
  const clamped = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  const romans = ["I", "II", "III", "IV", "V"];
  return romans[clamped - 1] ?? "I";
}

/**
 * Returns grade Latin motto.
 */
export function getGradeMotto(grade: number): { title: string; motto: string; subtitle: string } {
  const clamped = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  switch (clamped) {
    case 1:
      return {
        title: "NOVIZIO CONSAPEVOLE",
        motto: "INITIUM SAPIENTIAE · PORTA VERITATIS",
        subtitle: "La Disciplina del Varco",
      };
    case 2:
      return {
        title: "IL CUSTODE DELLA REGOLA",
        motto: "CUSTOS REGULAE · VIRTUS ET CONSTANTIA",
        subtitle: "L'Integrità della Soglia",
      };
    case 3:
      return {
        title: "L'OSSERVATORE SOVRANO",
        motto: "SPECTATOR SOVRANUS · DOMINIUM TEMPORIS",
        subtitle: "Il Governo dello Scenario",
      };
    case 4:
      return {
        title: "L'ARCHITETTO DEL REALE",
        motto: "ARCHITECTUS REALIS · GEOMETRIA AUREA",
        subtitle: "La Trasmutazione del Metodo",
      };
    case 5:
    default:
      return {
        title: "IL FONDATORE D'EREDITÀ",
        motto: "FUNDATOR HAEREDITATIS · AETERNUM FOEDUS",
        subtitle: "La Cerchia Interna Sovrana",
      };
  }
}

/**
 * Highly detailed, luxury ceremonial SVG Sigil of Investiture for LIMEN PROTOCOL.
 * Scalable from 48px badge in cards to 800px+ high-res printable certificates.
 */
export const LimenGradeSigil: React.FC<LimenGradeSigilProps> = ({
  grade,
  size = 120,
  className,
  detailed = true,
  animate = false,
  idPrefix = "sigil",
  userName,
  customGradeTitle,
  customGradeLabel,
}) => {
  const clampedGrade = Math.max(1, Math.min(5, Math.floor(grade || 1))) as LimenGradeNumber;
  const uid = `${idPrefix}-g${clampedGrade}`;
  const roman = getGradeRoman(clampedGrade);
  const gradeLabel = customGradeLabel || `GRADO ${roman}`;
  const cartoucheText = userName
    ? `${gradeLabel} · ${userName.trim().toUpperCase()}`
    : gradeLabel;
  const cartoucheFontSize =
    cartoucheText.length > 24 ? "5.2" : cartoucheText.length > 18 ? "6.2" : "7";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("select-none transition-transform duration-500", animate && "hover:scale-105", className)}
      role="img"
      aria-label={`Sigillo di Investitura Grado ${clampedGrade}`}
    >
      <defs>
        {/* Luxury Burnished Gold Linear Gradients */}
        <linearGradient id={`${uid}-gold-linear`} x1="40" y1="20" x2="280" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8A6D30" />
          <stop offset="25%" stopColor="#D4B475" />
          <stop offset="50%" stopColor="#FFF2D1" />
          <stop offset="75%" stopColor="#C5A059" />
          <stop offset="100%" stopColor="#5E481D" />
        </linearGradient>

        <linearGradient id={`${uid}-gold-bright`} x1="160" y1="20" x2="160" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF9E6" />
          <stop offset="30%" stopColor="#E2C78E" />
          <stop offset="70%" stopColor="#C5A059" />
          <stop offset="100%" stopColor="#8A6D30" />
        </linearGradient>

        <radialGradient id={`${uid}-gold-radial`} cx="160" cy="160" r="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7DE" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#D4B475" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#9C7930" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3E2E10" stopOpacity="0.1" />
        </radialGradient>

        {/* Obsidian Deep Background */}
        <radialGradient id={`${uid}-core-bg`} cx="160" cy="160" r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#181920" />
          <stop offset="65%" stopColor="#0D0E12" />
          <stop offset="100%" stopColor="#050507" />
        </radialGradient>

        {/* Grado V Royal Crimson Glow */}
        <radialGradient id={`${uid}-crimson`} cx="160" cy="160" r="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A82828" stopOpacity="0.45" />
          <stop offset="75%" stopColor="#5E1414" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#250505" stopOpacity="0" />
        </radialGradient>

        {/* Circular text paths for detailed legend */}
        <path id={`${uid}-arc-top`} d="M 38 160 A 122 122 0 1 1 282 160" />
        <path id={`${uid}-arc-bottom`} d="M 282 160 A 122 122 0 0 1 38 160" />

        {/* Subtle drop shadow filter for metallic depth */}
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ─── BASE BACKGROUND ─── */}
      <circle cx="160" cy="160" r="150" fill={`url(#${uid}-core-bg)`} />
      {clampedGrade === 5 && <circle cx="160" cy="160" r="148" fill={`url(#${uid}-crimson)`} />}

      {/* ─── OUTER CONCENTRIC GUILLOCHÉ / TICK RIM ─── */}
      <circle
        cx="160"
        cy="160"
        r="149"
        stroke={`url(#${uid}-gold-linear)`}
        strokeWidth="1.75"
        strokeOpacity="0.85"
      />
      <circle
        cx="160"
        cy="160"
        r="145"
        stroke={`url(#${uid}-gold-linear)`}
        strokeWidth="0.75"
        strokeDasharray="2 3"
        strokeOpacity="0.65"
      />

      {/* Fine radial gear/sun ticks around outer rim */}
      <g stroke={`url(#${uid}-gold-linear)`} strokeWidth="1" strokeOpacity="0.5">
        {Array.from({ length: 48 }).map((_, i) => {
          const angle = (i * 360) / 48;
          const isMajor = i % 4 === 0;
          const r1 = isMajor ? 141 : 144;
          const r2 = 148;
          const rad = (angle * Math.PI) / 180;
          const x1 = 160 + r1 * Math.cos(rad);
          const y1 = 160 + r1 * Math.sin(rad);
          const x2 = 160 + r2 * Math.cos(rad);
          const y2 = 160 + r2 * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={isMajor ? 1.5 : 0.75} />;
        })}
      </g>

      <circle
        cx="160"
        cy="160"
        r="140"
        stroke={`url(#${uid}-gold-bright)`}
        strokeWidth="1.25"
        strokeOpacity="0.9"
      />

      {/* ─── CIRCULAR LEGEND TRACK (DETAILED MODE) ─── */}
      {detailed && (
        <>
          <circle cx="160" cy="160" r="106" stroke={`url(#${uid}-gold-linear)`} strokeWidth="0.85" strokeOpacity="0.6" />
          <text
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', 'Cinzel Decorative', monospace, serif)"
            fontSize="7.5"
            fontWeight="bold"
            letterSpacing="2.8"
            opacity="0.88"
          >
            <textPath href={`#${uid}-arc-top`} startOffset="50%" textAnchor="middle">
              {clampedGrade === 5 ? "AUREUS PROTOCOL · CERCHIA INTERNA" : "AUREUS PROTOCOL · INVESTITURA SOVRANA"}
            </textPath>
          </text>

          <text
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', 'Cinzel Decorative', monospace, serif)"
            fontSize="7"
            fontWeight="bold"
            letterSpacing="2.2"
            opacity="0.82"
          >
            <textPath href={`#${uid}-arc-bottom`} startOffset="50%" textAnchor="middle">
              {customGradeTitle ? customGradeTitle.toUpperCase() : getGradeMotto(clampedGrade).title}
            </textPath>
          </text>

          {/* 4 Cardinal Diamond Studs */}
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cx = 160 + 123 * Math.cos(rad);
            const cy = 160 + 123 * Math.sin(rad);
            return (
              <polygon
                key={deg}
                points={`${cx},${cy - 3.5} ${cx + 3.5},${cy} ${cx},${cy + 3.5} ${cx - 3.5},${cy}`}
                fill={`url(#${uid}-gold-bright)`}
              />
            );
          })}
        </>
      )}

      {/* ─── INNER SACRED GEOMETRY RING ─── */}
      <circle
        cx="160"
        cy="160"
        r="102"
        stroke={`url(#${uid}-gold-linear)`}
        strokeWidth="1.75"
        strokeOpacity="0.95"
      />
      <circle
        cx="160"
        cy="160"
        r="98"
        stroke={`url(#${uid}-gold-linear)`}
        strokeWidth="0.7"
        strokeDasharray="4 2"
        strokeOpacity="0.5"
      />

      {/* ─── GRADE SPECIFIC HERALDIC EMBLEM ─── */}
      {renderGradeEmblem(clampedGrade, uid)}

      {/* ─── PERSONALIZED OPERATOR NAME CARTOUCHE ─── */}
      {detailed && userName && (
        <g id={`${uid}-operator-cartouche`}>
          <rect
            x="72"
            y="246"
            width="176"
            height="18"
            rx="3"
            fill="#090A0E"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.1"
          />
          <rect
            x="74.5"
            y="248.5"
            width="171"
            height="13"
            rx="1.5"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="0.5"
            strokeDasharray="3 2"
            strokeOpacity="0.6"
          />
          <text
            x="160"
            y="258"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize={cartoucheFontSize}
            fontWeight="bold"
            letterSpacing="1.2"
          >
            {cartoucheText}
          </text>
        </g>
      )}

      {/* ─── METALLIC SPECULAR SHEEN OVERLAY ─── */}
      <circle
        cx="160"
        cy="160"
        r="150"
        fill={`url(#${uid}-gold-radial)`}
        opacity="0.12"
        pointerEvents="none"
      />
    </svg>
  );
};

/**
 * Detailed Sacred Heraldry by Grade.
 */
function renderGradeEmblem(grade: LimenGradeNumber, uid: string): React.ReactNode {
  switch (grade) {
    case 1:
      // GRADO I — Il Neofita al Varco (The Sovereign Architectural Gateway & Singularity)
      return (
        <g id="emblem-grade-1">
          {/* Subtle 12-point calibration rays */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            const rad = (angle * Math.PI) / 180;
            const x1 = 160 + 50 * Math.cos(rad);
            const y1 = 160 + 50 * Math.sin(rad);
            const x2 = 160 + 94 * Math.cos(rad);
            const y2 = 160 + 94 * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#${uid}-gold-linear)`}
                strokeWidth="0.6"
                strokeDasharray="3 3"
                strokeOpacity="0.4"
              />
            );
          })}

          {/* Outer Gateway Pediment / Keystone Apex */}
          <polygon
            points="160,82 226,118 94,118"
            fill="none"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.8"
          />
          <polygon
            points="160,92 214,121 106,121"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="0.8"
            strokeOpacity="0.6"
          />

          {/* Limen Superum Lintel Beam */}
          <rect
            x="90"
            y="118"
            width="140"
            height="10"
            rx="1"
            fill={`url(#${uid}-gold-linear)`}
            fillOpacity="0.25"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.5"
          />

          {/* Limen Inferum Ground Threshold Sill */}
          <rect
            x="86"
            y="222"
            width="148"
            height="11"
            rx="1.5"
            fill={`url(#${uid}-gold-linear)`}
            fillOpacity="0.3"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.5"
          />
          <line x1="80" y1="237" x2="240" y2="237" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1" strokeOpacity="0.7" />

          {/* Monolith Twin Columns (Jachin/Boaz Initiatic Pillars) */}
          {/* Left Pillar */}
          <rect x="104" y="128" width="18" height="94" fill="#0A0B0F" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.4" />
          <line x1="113" y1="130" x2="113" y2="220" stroke={`url(#${uid}-gold-bright)`} strokeWidth="0.8" strokeOpacity="0.6" />
          <rect x="101" y="128" width="24" height="4" fill={`url(#${uid}-gold-linear)`} />
          <rect x="101" y="218" width="24" height="4" fill={`url(#${uid}-gold-linear)`} />

          {/* Right Pillar */}
          <rect x="198" y="128" width="18" height="94" fill="#0A0B0F" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.4" />
          <line x1="207" y1="130" x2="207" y2="220" stroke={`url(#${uid}-gold-bright)`} strokeWidth="0.8" strokeOpacity="0.6" />
          <rect x="195" y="128" width="24" height="4" fill={`url(#${uid}-gold-linear)`} />
          <rect x="195" y="218" width="24" height="4" fill={`url(#${uid}-gold-linear)`} />

          {/* Inner Sacred Portal Arch */}
          <path
            d="M 132 222 V 158 C 132 142 188 142 188 158 V 222"
            fill="none"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.2"
          />

          {/* Sovereign Vertical Plumbline Axis of Truth */}
          <line x1="160" y1="75" x2="160" y2="135" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.4" />
          <line x1="160" y1="190" x2="160" y2="238" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.4" />

          {/* Central Singularity Diamond (Il Varco) */}
          <polygon
            points="160,136 178,162 160,188 142,162"
            fill="#14151C"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="2"
          />
          <polygon
            points="160,143 172,162 160,181 148,162"
            fill={`url(#${uid}-gold-linear)`}
            fillOpacity="0.35"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="0.8"
          />

          {/* Sovereign Roman Numeral I */}
          <text
            x="160"
            y="170"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize="21"
            fontWeight="900"
            letterSpacing="0"
          >
            I
          </text>

          {/* Flanking mini stars */}
          <polygon points="135,162 137,159 139,162 137,165" fill={`url(#${uid}-gold-bright)`} />
          <polygon points="185,162 183,159 181,162 183,165" fill={`url(#${uid}-gold-bright)`} />
        </g>
      );

    case 2:
      // GRADO II — Il Custode della Regola (The Twin Pillars, Diamond Vault & Key of Integrity)
      return (
        <g id="emblem-grade-2">
          {/* Concentric diamond shield contour */}
          <polygon
            points="160,78 240,160 160,242 80,160"
            fill="#0E0F14"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="2"
          />
          <polygon
            points="160,88 230,160 160,232 90,160"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="0.8"
            strokeOpacity="0.5"
            strokeDasharray="4 2"
          />

          {/* Vesica Piscis Intersecting Arcs */}
          <path
            d="M 160 88 A 72 72 0 0 1 160 232 A 72 72 0 0 1 160 88"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="1"
            strokeOpacity="0.45"
          />

          {/* Crossed Ceremonial Sceptres / Keys behind Vault */}
          <line x1="108" y1="108" x2="212" y2="212" stroke={`url(#${uid}-gold-linear)`} strokeWidth="2.4" strokeLinecap="round" />
          <line x1="212" y1="108" x2="108" y2="212" stroke={`url(#${uid}-gold-linear)`} strokeWidth="2.4" strokeLinecap="round" />

          {/* Sceptre Key Heads */}
          <circle cx="108" cy="108" r="8" fill="#0C0D12" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
          <circle cx="212" cy="108" r="8" fill="#0C0D12" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
          <circle cx="108" cy="108" r="3" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="212" cy="108" r="3" fill={`url(#${uid}-gold-bright)`} />

          {/* Sceptre Key Teeth */}
          <path d="M 205 205 L 210 210 L 217 203" stroke={`url(#${uid}-gold-bright)`} strokeWidth="2" fill="none" />
          <path d="M 115 205 L 110 210 L 103 203" stroke={`url(#${uid}-gold-bright)`} strokeWidth="2" fill="none" />

          {/* Central Diamond Vault Keystone */}
          <rect
            x="132"
            y="132"
            width="56"
            height="56"
            rx="4"
            fill="#12141A"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="2"
          />
          <circle cx="160" cy="160" r="22" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.2" strokeOpacity="0.75" />

          {/* Roman Numeral II */}
          <text
            x="160"
            y="167"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize="20"
            fontWeight="900"
            letterSpacing="1"
          >
            II
          </text>

          {/* Keyhole and lock rivets */}
          <circle cx="140" cy="140" r="2" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="180" cy="140" r="2" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="140" cy="180" r="2" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="180" cy="180" r="2" fill={`url(#${uid}-gold-bright)`} />

          {/* Vertical axis plumb */}
          <line x1="160" y1="78" x2="160" y2="128" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
          <line x1="160" y1="192" x2="160" y2="242" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
        </g>
      );

    case 3:
      // GRADO III — L'Osservatore Sovrano (The All-Seeing Sacred Eye of Horizon & Astrolabe)
      return (
        <g id="emblem-grade-3">
          {/* Concentric Astrolabe Coordinate Circles */}
          <circle cx="160" cy="160" r="76" stroke={`url(#${uid}-gold-linear)`} strokeWidth="0.8" strokeOpacity="0.45" strokeDasharray="5 3" />
          <circle cx="160" cy="160" r="54" stroke={`url(#${uid}-gold-linear)`} strokeWidth="0.7" strokeOpacity="0.4" />

          {/* Radiating Horizon Beams from the Apex */}
          {[-45, -30, -15, 0, 15, 30, 45].map((deg) => {
            const rad = ((deg + 90) * Math.PI) / 180;
            const x2 = 160 + 88 * Math.cos(rad);
            const y2 = 82 + 88 * Math.sin(rad);
            return (
              <line
                key={deg}
                x1="160"
                y1="82"
                x2={x2}
                y2={y2}
                stroke={`url(#${uid}-gold-bright)`}
                strokeWidth="0.7"
                strokeOpacity="0.5"
              />
            );
          })}

          {/* Sacred Equilateral Triangle of Vision */}
          <polygon
            points="160,78 238,214 82,214"
            fill="#0F1017"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="2.2"
          />
          <polygon
            points="160,92 225,206 95,206"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="1"
            strokeOpacity="0.6"
          />

          {/* The All-Seeing Eye of Market Flow */}
          <g transform="translate(0, -6)">
            {/* Almond Eye Outlines */}
            <path
              d="M 120 160 C 135 140 185 140 200 160 C 185 180 135 180 120 160 Z"
              fill="#161822"
              stroke={`url(#${uid}-gold-bright)`}
              strokeWidth="1.8"
            />
            {/* Iris */}
            <circle cx="160" cy="160" r="14" fill="#0C0D12" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.5" />
            <circle cx="160" cy="160" r="9" fill={`url(#${uid}-gold-bright)`} fillOpacity="0.4" />
            {/* Pupil */}
            <circle cx="160" cy="160" r="5" fill={`url(#${uid}-gold-bright)`} />
            <circle cx="162" cy="158" r="1.5" fill="#FFFFFF" />

            {/* Horizon Line piercing through */}
            <line x1="90" y1="160" x2="116" y2="160" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.2" strokeOpacity="0.7" />
            <line x1="204" y1="160" x2="230" y2="160" stroke={`url(#${uid}-gold-linear)`} strokeWidth="1.2" strokeOpacity="0.7" />
          </g>

          {/* Roman Numeral III in Base Keystone */}
          <text
            x="160"
            y="198"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize="18"
            fontWeight="900"
            letterSpacing="1"
          >
            III
          </text>

          {/* Apex Golden Singularity */}
          <circle cx="160" cy="78" r="4" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="82" cy="214" r="3.5" fill={`url(#${uid}-gold-bright)`} />
          <circle cx="238" cy="214" r="3.5" fill={`url(#${uid}-gold-bright)`} />
        </g>
      );

    case 4:
      // GRADO IV — L'Architetto del Reale (Sacred Octagram, Compass & Square of Creation)
      return (
        <g id="emblem-grade-4">
          {/* Sacred Octagram (Two interlocking rotated squares) */}
          <rect
            x="105"
            y="105"
            width="110"
            height="110"
            fill="#0E0F16"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.8"
          />
          <rect
            x="105"
            y="105"
            width="110"
            height="110"
            transform="rotate(45 160 160)"
            fill="#0E0F16"
            fillOpacity="0.75"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.8"
          />

          {/* Blueprint matrix crosslines */}
          <circle cx="160" cy="160" r="74" stroke={`url(#${uid}-gold-linear)`} strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="3 3" />
          <circle cx="160" cy="160" r="48" stroke={`url(#${uid}-gold-linear)`} strokeWidth="0.8" strokeOpacity="0.5" />

          {/* Master Architect Compass (Sesto) */}
          {/* Hinge Joint */}
          <circle cx="160" cy="98" r="7" fill="#14161F" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.8" />
          <circle cx="160" cy="98" r="2.5" fill={`url(#${uid}-gold-bright)`} />
          {/* Compass Legs */}
          <line x1="160" y1="98" x2="114" y2="216" stroke={`url(#${uid}-gold-bright)`} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="160" y1="98" x2="206" y2="216" stroke={`url(#${uid}-gold-bright)`} strokeWidth="2.2" strokeLinecap="round" />

          {/* Master Architect Set Square (Squadra) */}
          <path
            d="M 124 218 L 196 218 L 196 146"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="2.5"
            strokeLinecap="square"
          />
          <path
            d="M 132 210 L 188 210 L 188 154"
            fill="none"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1"
            strokeOpacity="0.6"
          />

          {/* Central Keystone Diamond with Roman IV */}
          <polygon
            points="160,138 182,160 160,182 138,160"
            fill="#12131C"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="1.5"
          />
          <text
            x="160"
            y="167"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize="18"
            fontWeight="900"
            letterSpacing="0.5"
          >
            IV
          </text>

          {/* 8 Star Vertex Studs */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const sx = 160 + 78 * Math.cos(rad);
            const sy = 160 + 78 * Math.sin(rad);
            return <circle key={deg} cx={sx} cy={sy} r="2.5" fill={`url(#${uid}-gold-bright)`} />;
          })}
        </g>
      );

    case 5:
    default:
      // GRADO V — Il Fondatore d'Eredità (Imperial Crown, 12-Ray Radiant Sunburst & Golden Laurel)
      return (
        <g id="emblem-grade-5">
          {/* Imperial Radiant 24-point Sunburst */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const isMajor = i % 2 === 0;
            const r1 = 66;
            const r2 = isMajor ? 96 : 84;
            const rad = (angle * Math.PI) / 180;
            const x1 = 160 + r1 * Math.cos(rad);
            const y1 = 160 + r1 * Math.sin(rad);
            const x2 = 160 + r2 * Math.cos(rad);
            const y2 = 160 + r2 * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#${uid}-gold-bright)`}
                strokeWidth={isMajor ? 1.6 : 0.8}
                strokeOpacity={isMajor ? 0.75 : 0.45}
              />
            );
          })}

          {/* Emperor's Golden Laurel Wreath (Corona d'Alloro) */}
          <g stroke={`url(#${uid}-gold-linear)`} strokeWidth="1" fill={`url(#${uid}-gold-bright)`} fillOpacity="0.4">
            {/* Left Wreath Branch */}
            {[-60, -40, -20, 0, 20, 40, 60].map((deg) => {
              const rad = ((180 + deg) * Math.PI) / 180;
              const lx = 160 + 64 * Math.cos(rad);
              const ly = 168 + 58 * Math.sin(rad);
              return (
                <ellipse
                  key={`left-${deg}`}
                  cx={lx}
                  cy={ly}
                  rx="6"
                  ry="3.2"
                  transform={`rotate(${deg - 30} ${lx} ${ly})`}
                />
              );
            })}
            {/* Right Wreath Branch */}
            {[-60, -40, -20, 0, 20, 40, 60].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const rx = 160 + 64 * Math.cos(rad);
              const ry = 168 + 58 * Math.sin(rad);
              return (
                <ellipse
                  key={`right-${deg}`}
                  cx={rx}
                  cy={ry}
                  rx="6"
                  ry="3.2"
                  transform={`rotate(${-deg + 30} ${rx} ${ry})`}
                />
              );
            })}
          </g>

          {/* Central Sovereign Crimson Medallion */}
          <circle
            cx="160"
            cy="165"
            r="44"
            fill="#5E1414"
            stroke={`url(#${uid}-gold-bright)`}
            strokeWidth="2.2"
          />
          <circle
            cx="160"
            cy="165"
            r="39"
            fill="none"
            stroke={`url(#${uid}-gold-linear)`}
            strokeWidth="0.8"
            strokeDasharray="3 2"
            strokeOpacity="0.8"
          />

          {/* Imperial Sovereign Crown */}
          <g transform="translate(0, 8)">
            {/* Crown Base Circlet */}
            <path
              d="M 132 124 Q 160 128 188 124 L 186 130 Q 160 134 134 130 Z"
              fill={`url(#${uid}-gold-bright)`}
              stroke={`url(#${uid}-gold-linear)`}
              strokeWidth="0.8"
            />
            {/* Crown Spikes */}
            <polygon
              points="132,124 130,105 142,118 160,94 178,118 190,105 188,124"
              fill="#181922"
              stroke={`url(#${uid}-gold-bright)`}
              strokeWidth="1.8"
            />
            {/* Crown Jewels on Spikes */}
            <circle cx="130" cy="105" r="2.8" fill={`url(#${uid}-gold-bright)`} />
            <circle cx="160" cy="94" r="3.6" fill={`url(#${uid}-gold-bright)`} />
            <circle cx="190" cy="105" r="2.8" fill={`url(#${uid}-gold-bright)`} />
            {/* Cross at Apex */}
            <line x1="160" y1="87" x2="160" y2="93" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
            <line x1="157" y1="90" x2="163" y2="90" stroke={`url(#${uid}-gold-bright)`} strokeWidth="1.5" />
          </g>

          {/* Majestic Roman Numeral V */}
          <text
            x="160"
            y="176"
            textAnchor="middle"
            fill={`url(#${uid}-gold-bright)`}
            fontFamily="var(--tl-font-mono, 'Cinzel', serif)"
            fontSize="28"
            fontWeight="900"
            letterSpacing="1"
          >
            V
          </text>

          {/* Tiny Golden Star at bottom of medallion */}
          <polygon
            points="160,195 162,198 166,198 163,200 164,204 160,202 156,204 157,200 154,198 158,198"
            fill={`url(#${uid}-gold-bright)`}
          />
        </g>
      );
  }
}
