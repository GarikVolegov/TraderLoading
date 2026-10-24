import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Eye, RotateCcw, Sparkles, Move3d } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GradeCharacterData {
  readonly grade: number;
  readonly code: string;
  readonly title: string;
  readonly characterName: string;
  readonly src: string;
  readonly caption: string;
  readonly details: string;
  readonly highlights: readonly string[];
}

export const GRADE_CHARACTERS_DATA: Record<number, GradeCharacterData> = {
  1: {
    grade: 1,
    code: "GRADO I",
    title: "Novizio Consapevole",
    characterName: "L'Iniziato al Codice",
    src: "/images/grades/grado-1-character.png",
    caption: "Statua 3D Iniziatica: Il Custode del Libro & Le Pergamene del Patto",
    details:
      "Scultura e render 3D dell'Iniziato al Grado I: operatore in tunica cerimoniale di addestramento, mantellina con cappuccio, cinturone da campo con borse per pergamene, chiavi della soglia e campanella rituale. Tra le mani regge il Libro della Verità aperto, eretto sul piedistallo circolare in bronzo forgiato recante l'incisione «GRADO I // NOVIZIO CONSAPEVOLE».",
    highlights: [
      "Tunica cerimoniale d'addestramento e mantellina con cappuccio",
      "Il Grande Libro della Verità aperto tra le mani per lo studio del Codice",
      "Cinturone da campo con bisacce per pergamene, chiavi della soglia e campanella",
      "Piedistallo monumentale in bronzo forgiato con incisione «GRADO I // NOVIZIO CONSAPEVOLE»",
    ],
  },
  2: {
    grade: 2,
    code: "GRADO II",
    title: "Il Custode della Regola",
    characterName: "Il Guardiano della Regola",
    src: "/images/grades/grado-2-character.png",
    caption: "Statua 3D Iniziatica: L'Armatura d'Acciaio & Lo Spadone del Codice",
    details:
      "Scultura e render 3D del Custode della Regola (Grado II): guerriero templare in possente armatura a piastre rivettate, cotta di maglia, spallacci rinforzati e manto scuro. Impugna a due mani il monumentale spadone del rigore matematico appoggiato sulla punta, con la chiave della soglia al fianco, eretto sul piedistallo circolare in bronzo forgiato recante l'incisione «GRADO II // IL CUSTODE DELLA REGOLA».",
    highlights: [
      "Armatura a piastre d'acciaio forgiato e cotta di maglia ad anelli",
      "Monumentale spadone a due mani retto sulla punta del rigore",
      "Cinturone da battaglia con chiave della soglia e spallacci corazzati",
      "Piedistallo in bronzo forgiato con incisione «GRADO II // IL CUSTODE DELLA REGOLA»",
    ],
  },
  3: {
    grade: 3,
    code: "GRADO III",
    title: "L'Osservatore Sovrano",
    characterName: "Lo Stratega Celeste",
    src: "/images/grades/grado-3-character.png",
    caption: "Statua 3D Iniziatica: Il Telescopio d'Ottone & Gli Astrolabi Macro",
    details:
      "Scultura e render 3D dell'Osservatore Sovrano (Grado III): veterano dell'Ordine in maestosa armatura a piastre brunite con incisioni dorate, sopravveste damascata e sontuoso mantello in velluto blu notte con bordure in filigrana d'oro. Impugna il telescopio d'ottone e l'astrolabio di precisione per il controllo distaccato delle traiettorie macro, con strumenti di calcolo e cilindri per pergamene al cinturone, eretto sul piedistallo circolare in bronzo forgiato recante l'incisione «GRADO III // L'OSSERVATORE SOVRANO».",
    highlights: [
      "Armatura a piastre brunite e mantello in velluto blu notte damascato con bordure auree",
      "Telescopio astronomico in ottone forgiato e astrolabio per la scansione macro",
      "Cinturone d'ordinanza con astrolabi pendenti, lenti focali e cilindri cartografici",
      "Piedistallo in bronzo forgiato con incisione «GRADO III // L'OSSERVATORE SOVRANO»",
    ],
  },
  4: {
    grade: 4,
    code: "GRADO IV",
    title: "L'Architetto del Reale",
    characterName: "Il Maestro Costruttore",
    src: "/images/grades/grado-4-character.png",
    caption: "Statua 3D Iniziatica: Il Compasso Geometrico & La Mappa del Reale",
    details:
      "Scultura e render 3D dell'Architetto del Reale (Grado IV): maestro costruttore e ingegnere dell'Ordine in giubba di velluto scuro bordata d'oro, grembiule da maestro in cuoio rinforzato con tasche portastrumenti e occhiali/monocolo di precisione ottica. Nella mano destra impugna il compasso aureo millimetrico e srotola con la sinistra la monumentale planimetria della fortezza e della geometria sacra del mercato, eretto sul piedistallo circolare in bronzo forgiato recante l'incisione «SCALA INIZIATICA // LIMEN — GRADO IV // L'ARCHITETTO DEL REALE».",
    highlights: [
      "Grembiule da lavoro in cuoio forgiato con squadra, calibri e lenti di precisione",
      "Grande planimetria architettonica srotolata con schemi di geometria sacra",
      "Occhiali ottici multifocali, monocolo da maestro e guanti da laboratorio",
      "Piedistallo in bronzo forgiato con incisione «GRADO IV // L'ARCHITETTO DEL REALE»",
    ],
  },
  5: {
    grade: 5,
    code: "GRADO V",
    title: "Il Fondatore d'Eredità",
    characterName: "Il Sovrano dell'Ordine",
    src: "/images/grades/grado-5-character.png",
    caption: "Statua 3D Iniziatica: Lo Scettro Imperiale & Il Patto Ereditario",
    details:
      "Scultura e render 3D del Fondatore d'Eredità (Grado V): vertice assoluto dell'Ordine in corona aurea forgiata, possente armatura a piastre intarsiate d'oro e sontuoso mantello cerimoniale bordato di pelliccia in velluto cremisi imperiale damascato. Nella mano sinistra erige lo scettro monumentale col sigillo della triade Limen, mentre nella destra reca il patto costitutivo sigillato con ceralacca scarlatta, con corno di comando e chiavi della cerchia interna al cinturone, eretto sul piedistallo circolare in bronzo forgiato recante l'incisione «GRADO V // IL FONDATORE D'EREDITÀ».",
    highlights: [
      "Corona imperiale aurea e armatura cerimoniale a piastre d'acciaio e oro",
      "Manto sovrano in velluto cremisi con bordura in pelliccia e damasco aureo",
      "Scettro monumentale dell'Ordine e pergamena costitutiva con sigillo in ceralacca",
      "Piedistallo in bronzo forgiato con incisione «GRADO V // IL FONDATORE D'EREDITÀ»",
    ],
  },
};

interface GradeCharacter3DViewerProps {
  readonly grade: number;
  readonly unlocked?: boolean;
  readonly isCurrent?: boolean;
  readonly onInspect?: (charData: GradeCharacterData) => void;
  readonly className?: string;
}

export const GradeCharacter3DViewer: React.FC<GradeCharacter3DViewerProps> = ({
  grade,
  unlocked = false,
  isCurrent = false,
  onInspect,
  className,
}) => {
  const charData = GRADE_CHARACTERS_DATA[grade] ?? GRADE_CHARACTERS_DATA[1];
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag & rotation physics state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({
    x: 0,
    y: 0,
    rotX: 0,
    rotY: 0,
  });

  // Animated rotation angles with spring damping
  const rawRotX = useMotionValue(0);
  const rawRotY = useMotionValue(0);
  const rotX = useSpring(rawRotX, { stiffness: 220, damping: 20 });
  const rotY = useSpring(rawRotY, { stiffness: 220, damping: 20 });

  // Reset rotation to home
  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    rawRotX.set(0);
    rawRotY.set(0);
  };

  // Hover pointer move (subtle tilt + lighting tracking)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (isDragging) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      // Dragging allows full turntable rotation
      const newY = Math.max(-50, Math.min(50, dragStartRef.current.rotY + deltaX * 0.45));
      const newX = Math.max(-25, Math.min(25, dragStartRef.current.rotX - deltaY * 0.35));
      rawRotY.set(newY);
      rawRotX.set(newX);
    } else {
      // Natural 3D hover parallax
      const hoverY = (nx - 0.5) * 22;
      const hoverX = (0.5 - ny) * 16;
      rawRotY.set(hoverY);
      rawRotX.set(hoverX);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX: rawRotX.get(),
      rotY: rawRotY.get(),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const dist = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      // If clicked without dragging, open inspection
      if (dist < 6 && onInspect) {
        onInspect(charData);
      }
    }
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      rawRotX.set(0);
      rawRotY.set(0);
    }
  };

  return (
    <div
      className={cn(
        "relative flex-1 -mx-2 w-[calc(100%+1rem)] min-h-[260px] h-full flex flex-col items-center justify-end select-none group",
        className
      )}
      style={{ perspective: 1100 }}
    >
      <motion.div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{
          rotateX: rotX,
          rotateY: rotY,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full h-full flex flex-col items-center justify-end cursor-grab active:cursor-grabbing transition-transform bg-transparent"
      >
        {/* Clean 3D Character Figurine (True RGBA cutout, no background, blends seamlessly with the app) */}
        <div className="relative z-10 w-full h-full flex items-end justify-center">
          <img
            src={`${charData.src}?v=20261023alpha`}
            alt={charData.characterName}
            loading="eager"
            decoding="async"
            draggable={false}
            className="w-full h-full max-h-full object-contain object-bottom pointer-events-none filter contrast-[1.04] drop-shadow-[0_14px_24px_rgba(0,0,0,0.75)] transition-transform duration-300 origin-bottom scale-100 group-hover:scale-[1.02]"
          />
        </div>
      </motion.div>
    </div>
  );
};
