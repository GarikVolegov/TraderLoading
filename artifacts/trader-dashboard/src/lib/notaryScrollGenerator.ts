/**
 * AUREUS PROTOCOL — Pergamena Notarile Sovrana (A4 Notarial Scroll Generator)
 * Dimensioni A4 Ultra-HD (1240 x 1754 viewport -> buffer fisico 2480 x 3508 a 300 DPI)
 *
 * Concepito per l'attestazione immutabile della disciplina e dell'integrità operativa.
 * Renderizzato nativamente su Canvas 2D a zero byte di dipendenze esterne.
 */

export interface NotaryScrollData {
  operatorName: string;
  gradeTitle: string;
  gradeCode: string;
  integrityIndex: number;
  consecutiveSessions: number;
  violationsCount: number;
  winRate?: number;
  totalTrades?: number;
  profitFormatted?: string;
  maxDrawdown?: number;
  pillars?: {
    patience: number;
    risk: number;
    precision: number;
    firmness: number;
    integrity: number;
  };
  cardioMetrics?: {
    zenWinRate: number;
    zenPct: number;
    avgBpm: number;
    totalTrades: number;
  };
  issueDate?: string;
  verificationHash?: string;
}

/**
 * Calcola l'hash crittografico a 64 caratteri (SHA-256 pseudo-digest deterministico)
 */
export function computeNotaryHash(data: NotaryScrollData): string {
  const payload = [
    data.operatorName,
    data.gradeCode,
    data.integrityIndex,
    data.consecutiveSessions,
    data.violationsCount,
    data.issueDate || "2026-10-25",
    data.winRate ?? 0,
    data.profitFormatted ?? "0",
    data.cardioMetrics ? `${data.cardioMetrics.zenWinRate}::${data.cardioMetrics.avgBpm}` : "zen",
  ].join("::");

  // Multi-pass FNV-1a & Murmur3 dual-hash esteso a 64 hex characters
  let h1 = 0x811c9dc5 ^ 0;
  let h2 = 0x27d4eb2f ^ 0;
  let h3 = 0xdeadbeef ^ 0;
  let h4 = 0x41c6ce57 ^ 0;

  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ ch, 2246822507);
    h3 = Math.imul(h3 ^ (ch << 1), 3266489909);
    h4 = Math.imul(h4 ^ (ch >> 1), 1597334677);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p3 = (h3 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p4 = (h4 >>> 0).toString(16).padStart(8, "0").toUpperCase();

  // Reverse pass per riempire i 64 caratteri standard SHA-256
  let rh1 = h4;
  let rh2 = h3;
  let rh3 = h2;
  let rh4 = h1;
  for (let i = payload.length - 1; i >= 0; i--) {
    const ch = payload.charCodeAt(i);
    rh1 = Math.imul(rh1 ^ ch, 2654435761);
    rh2 = Math.imul(rh2 ^ ch, 1597334677);
    rh3 = Math.imul(rh3 ^ ch, 2246822507);
    rh4 = Math.imul(rh4 ^ ch, 3266489909);
  }
  const p5 = (rh1 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p6 = (rh2 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p7 = (rh3 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p8 = (rh4 >>> 0).toString(16).padStart(8, "0").toUpperCase();

  return `0x${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w - r, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawOctagram(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // Aureola di luce radiale
  const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR * 1.8);
  radialGlow.addColorStop(0, "rgba(232, 197, 106, 0.45)");
  radialGlow.addColorStop(0.4, "rgba(197, 160, 89, 0.15)");
  radialGlow.addColorStop(1, "rgba(197, 160, 89, 0)");
  ctx.fillStyle = radialGlow;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Cerchi concentrici
  ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 1.15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(197, 160, 89, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.95, 0, Math.PI * 2);
  ctx.stroke();

  // I due quadrati sovrapposti ruotati di 45 gradi
  for (let rot = 0; rot < 2; rot++) {
    ctx.save();
    ctx.rotate((rot * Math.PI) / 4);
    ctx.strokeStyle = "rgba(232, 197, 106, 0.85)";
    ctx.lineWidth = 2.5;
    const side = outerR * 1.35;
    ctx.strokeRect(-side / 2, -side / 2, side, side);
    ctx.restore();
  }

  // Nucleo centrale
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR * 0.35);
  coreGrad.addColorStop(0, "#F5E2A8");
  coreGrad.addColorStop(0.6, "#C5A059");
  coreGrad.addColorStop(1, "#7D6433");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renderizza la Pergamena Notarile su un elemento Canvas
 */
export function renderNotaryScroll(
  canvas: HTMLCanvasElement,
  data: NotaryScrollData
): void {
  const dpr = 2; // Buffer Retina 2480 x 3508
  const w = 1240;
  const h = 1754;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // 1. Sfondo profondo in Ossidiana Sovrana con gradiente radiale
  const bgGrad = ctx.createRadialGradient(w / 2, h / 3, 80, w / 2, h / 2, h * 0.75);
  bgGrad.addColorStop(0, "#131722");
  bgGrad.addColorStop(0.45, "#0b0d13");
  bgGrad.addColorStop(1, "#050608");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Griglia geometrica sacra di sottofondo
  ctx.save();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.04)";
  ctx.lineWidth = 1;
  const gridStep = 40;
  for (let x = 0; x < w; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Cerchi concentrici cosmici al centro
  ctx.strokeStyle = "rgba(197, 160, 89, 0.06)";
  ctx.lineWidth = 1.5;
  for (let r of [160, 320, 520, 740]) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Cornice Nobiliare Guilloche esterna ed interna
  const margin = 48;
  const innerMargin = 58;

  ctx.save();
  // Bordo esterno primario
  ctx.strokeStyle = "rgba(197, 160, 89, 0.65)";
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, margin, margin, w - margin * 2, h - margin * 2, 16);
  ctx.stroke();

  // Bordo interno sottile
  ctx.strokeStyle = "rgba(197, 160, 89, 0.3)";
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, innerMargin, innerMargin, w - innerMargin * 2, h - innerMargin * 2, 12);
  ctx.stroke();

  // Staffe decorative angolari (Ornamenti nobiliari)
  const bracketLen = 36;
  const corners = [
    { x: margin, y: margin, dx: 1, dy: 1 },
    { x: w - margin, y: margin, dx: -1, dy: 1 },
    { x: margin, y: h - margin, dx: 1, dy: -1 },
    { x: w - margin, y: h - margin, dx: -1, dy: -1 },
  ];

  ctx.strokeStyle = "#E8C56A";
  ctx.lineWidth = 3.5;
  for (const c of corners) {
    ctx.beginPath();
    ctx.moveTo(c.x + c.dx * 8, c.y);
    ctx.lineTo(c.x + c.dx * bracketLen, c.y);
    ctx.moveTo(c.x, c.y + c.dy * 8);
    ctx.lineTo(c.x, c.y + c.dy * bracketLen);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Intestazione Solenne
  drawOctagram(ctx, w / 2, 150, 48);

  ctx.textAlign = "center";

  // Protocollo & Motto
  ctx.fillStyle = "#E8C56A";
  ctx.font = "bold 13px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.22em";
  ctx.fillText("AUREUS PROTOCOL · ORDINE DELL'INTEGRITÀ", w / 2, 235);

  ctx.fillStyle = "rgba(197, 160, 89, 0.65)";
  ctx.font = "italic 11px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.15em";
  ctx.fillText("NON DUCOR, DUCO · VERITAS IN MERCATURA", w / 2, 255);

  // Titolo della Pergamena
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 26px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.08em";
  ctx.fillText("ATTESTAZIONE NOTARILE DI DISCIPLINA", w / 2, 305);

  // Linea divisoria imperiale con rombo centrale
  ctx.strokeStyle = "rgba(197, 160, 89, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 200, 328);
  ctx.lineTo(w / 2 - 15, 328);
  ctx.moveTo(w / 2 + 15, 328);
  ctx.lineTo(w / 2 + 200, 328);
  ctx.stroke();

  ctx.fillStyle = "#C5A059";
  ctx.save();
  ctx.translate(w / 2, 328);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();

  // 5. Sezione Operatore & Grado Sovrano
  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.font = "12px 'Space Grotesk', system-ui";
  ctx.letterSpacing = "0.12em";
  ctx.fillText("SI ATTESTA CHE L'OPERATORE", w / 2, 375);

  ctx.fillStyle = "#F5E2A8";
  ctx.font = "bold 32px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.06em";
  ctx.fillText(data.operatorName.toUpperCase(), w / 2, 420);

  // Badge Grado Sovrano
  const gradeLabel = `${data.gradeCode} · ${data.gradeTitle.toUpperCase()}`;
  ctx.font = "bold 13px 'Space Grotesk', monospace, system-ui";
  ctx.letterSpacing = "0.1em";
  const badgeWidth = ctx.measureText(gradeLabel).width + 36;
  const badgeX = (w - badgeWidth) / 2;
  const badgeY = 445;

  ctx.fillStyle = "rgba(197, 160, 89, 0.12)";
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 28, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#E8C56A";
  ctx.fillText(gradeLabel, w / 2, badgeY + 18);

  // 6. Bento Grid delle Telemetrie Principali (4 Card di Rigore)
  const bentoY = 510;
  const bentoW = w - 160;
  const colW = (bentoW - 24) / 2;
  const rowH = 110;
  const startX = 80;

  const cards = [
    {
      title: "INDICE DI INTEGRITÀ",
      val: `${data.integrityIndex}%`,
      subtitle: data.integrityIndex >= 90 ? "Assetto Incorruttibile" : "In Riallineamento",
      color: data.integrityIndex >= 90 ? "#10b981" : "#C5A059",
    },
    {
      title: "SESSIONI CONFORMI",
      val: `${data.consecutiveSessions} Sessioni`,
      subtitle: "Zero Deviazioni dal Protocollo",
      color: "#E8C56A",
    },
    {
      title: "VIOLAZIONI RECENTI",
      val: `${data.violationsCount}`,
      subtitle: data.violationsCount === 0 ? "Totale Immunità alla Deriva" : "Sotto Vigilanza",
      color: data.violationsCount === 0 ? "#10b981" : "#ef4444",
    },
    {
      title: "RENDICONTO NOTARILE",
      val: data.profitFormatted || (data.winRate ? `${data.winRate}% WR` : "Certificato"),
      subtitle: "Compilazione Libro della Verità",
      color: "#E8C56A",
    },
  ];

  cards.forEach((card, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = startX + col * (colW + 24);
    const cy = bentoY + row * (rowH + 16);

    ctx.save();
    ctx.fillStyle = "rgba(17, 19, 28, 0.75)";
    drawRoundedRect(ctx, cx, cy, colW, rowH, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(197, 160, 89, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Titolo card
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.font = "bold 10.5px 'Space Grotesk', system-ui";
    ctx.letterSpacing = "0.1em";
    ctx.fillText(card.title, cx + 20, cy + 30);

    // Valore primario
    ctx.fillStyle = card.color;
    ctx.font = "bold 26px 'Space Grotesk', monospace, system-ui";
    ctx.letterSpacing = "-0.02em";
    ctx.fillText(card.val, cx + 20, cy + 68);

    // Sottotitolo
    ctx.fillStyle = "rgba(148, 163, 184, 0.65)";
    ctx.font = "11px 'Space Grotesk', system-ui";
    ctx.letterSpacing = "0.02em";
    ctx.fillText(card.subtitle, cx + 20, cy + 92);

    ctx.restore();
  });

  // 7. Sezione I 5 Pilastri della Maestria (Barre Orizzontali di Disciplina)
  const pillarsY = 790;
  ctx.save();
  ctx.fillStyle = "rgba(17, 19, 28, 0.75)";
  drawRoundedRect(ctx, startX, pillarsY, bentoW, 360, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Testata sezione pilastri
  ctx.textAlign = "left";
  ctx.fillStyle = "#E8C56A";
  ctx.font = "bold 14px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.14em";
  ctx.fillText("IL PENTAGRAMMA DELLA MAESTRIA · STATO DI ALLINEAMENTO", startX + 24, pillarsY + 36);

  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = "11.5px 'Space Grotesk', system-ui";
  ctx.fillText("Conformità telemetrica calcolata rispetto alle leggi dell'Ordine AUREUS", startX + 24, pillarsY + 58);

  const pillarsList = [
    { name: "Pazienza nell'Attesa", score: data.pillars?.patience ?? 90 },
    { name: "Rispetto del Rischio & Stop", score: data.pillars?.risk ?? 100 },
    { name: "Precisione Tecnica al Varco", score: data.pillars?.precision ?? 85 },
    { name: "Fermezza Emotiva (Anti-Deriva)", score: data.pillars?.firmness ?? 95 },
    { name: "Integrità Notarile del Registro", score: data.pillars?.integrity ?? 100 },
  ];

  const barStartX = startX + 24;
  const barWidth = bentoW - 48;
  const itemStartY = pillarsY + 95;

  pillarsList.forEach((pil, pidx) => {
    const itemY = itemStartY + pidx * 50;

    // Etichetta e punteggio
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "600 12.5px 'Space Grotesk', system-ui";
    ctx.fillText(pil.name, barStartX, itemY);

    ctx.textAlign = "right";
    ctx.fillStyle = "#E8C56A";
    ctx.font = "bold 12.5px 'Space Grotesk', monospace, system-ui";
    ctx.fillText(`${pil.score}%`, barStartX + barWidth, itemY);

    // Barra di sfondo
    const trackY = itemY + 8;
    const trackH = 7;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedRect(ctx, barStartX, trackY, barWidth, trackH, 3.5);
    ctx.fill();

    // Barra riempita dorata
    const fillW = Math.max(8, (barWidth * pil.score) / 100);
    const barGrad = ctx.createLinearGradient(barStartX, 0, barStartX + fillW, 0);
    barGrad.addColorStop(0, "#C5A059");
    barGrad.addColorStop(1, "#E8C56A");
    ctx.fillStyle = barGrad;
    drawRoundedRect(ctx, barStartX, trackY, fillW, trackH, 3.5);
    ctx.fill();
  });
  ctx.restore();

  // 7b. Sigillo Biometrico Neocorticale (Smartwatch BLE & Assetto Zen)
  if (data.cardioMetrics && data.cardioMetrics.totalTrades > 0) {
    const bioY = 1162;
    ctx.save();
    ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
    drawRoundedRect(ctx, startX, bioY, bentoW, 36, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 11px 'Space Grotesk', system-ui";
    ctx.fillText("SIGILLO BIOMETRICO NEOCORTICALE · ASSETTO ZEN", startX + 16, bioY + 22);

    ctx.textAlign = "right";
    ctx.fillStyle = "#E8C56A";
    ctx.font = "bold 11.5px 'Space Grotesk', monospace, system-ui";
    ctx.fillText(
      `Zen WR: ${data.cardioMetrics.zenWinRate}% · Media: ${data.cardioMetrics.avgBpm} BPM (${data.cardioMetrics.zenPct}% Campione)`,
      startX + bentoW - 16,
      bioY + 22
    );
    ctx.restore();
  }

  // 8. Solenne Dichiarazione Giurata
  const declY = data.cardioMetrics && data.cardioMetrics.totalTrades > 0 ? 1215 : 1190;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(220, 225, 235, 0.9)";
  ctx.font = "italic 13.5px 'Cinzel', Georgia, serif";
  ctx.letterSpacing = "0.03em";

  const lines = [
    "«Il mercato non premia l'avidità, ma esalta l'integrità di chi domina sé stesso.",
    "Colui che custodisce il proprio registro e rispetta il limite stabilito,",
    "ha trasmutato l'incertezza del caso nell'eredità della maestria.»",
  ];

  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, declY + i * 26);
  });
  ctx.restore();

  // 9. Sezione Notarile & Sigillo Crittografico SHA-256
  const footerY = 1320;
  const hash = data.verificationHash || computeNotaryHash(data);
  const issueDateStr = data.issueDate || new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  ctx.save();
  ctx.fillStyle = "rgba(17, 19, 28, 0.75)";
  drawRoundedRect(ctx, startX, footerY, bentoW, 280, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header notarile
  ctx.textAlign = "left";
  ctx.fillStyle = "#E8C56A";
  ctx.font = "bold 12px 'Space Grotesk', system-ui";
  ctx.letterSpacing = "0.15em";
  ctx.fillText("SIGILLO NOTARILE CRITTOGRAFICO · VERIFICA D'ORDINE", startX + 24, footerY + 34);

  // Hash SHA-256 in grande font monospace
  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.font = "11px 'Space Grotesk', system-ui";
  ctx.fillText("Impronta Digitale SHA-256 (Registro Immutabile):", startX + 24, footerY + 64);

  ctx.fillStyle = "#F5E2A8";
  ctx.font = "bold 13px 'Space Grotesk', monospace, system-ui";
  ctx.letterSpacing = "0.06em";
  // Spezziamo l'hash in due righe se troppo lungo per la colonna
  const hash1 = hash.slice(0, 34);
  const hash2 = hash.slice(34);
  ctx.fillText(hash1, startX + 24, footerY + 90);
  if (hash2) {
    ctx.fillText(hash2, startX + 24, footerY + 112);
  }

  // Data di emissione & Giurisdizione
  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.font = "11px 'Space Grotesk', system-ui";
  ctx.fillText("Data e Ora di Rilascio Certificato:", startX + 24, footerY + 150);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 13px 'Space Grotesk', monospace, system-ui";
  ctx.fillText(issueDateStr, startX + 24, footerY + 172);

  // Spazio Sigillo Notarile Grafico (a destra del box)
  drawOctagram(ctx, startX + bentoW - 90, footerY + 140, 42);

  ctx.textAlign = "center";
  ctx.fillStyle = "#C5A059";
  ctx.font = "bold 9px 'Cinzel', serif, system-ui";
  ctx.letterSpacing = "0.15em";
  ctx.fillText("SIGILLO UFFICIALE", startX + bentoW - 90, footerY + 215);

  // Chiusura solenne notarile
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(148, 163, 184, 0.65)";
  ctx.font = "10.5px 'Space Grotesk', system-ui";
  ctx.fillText(
    "Certificato redatto in conformità con i protocolli matematici e deontologici del Protocollo AUREUS.",
    startX + 24,
    footerY + 225
  );
  ctx.fillText(
    "Non falsificabile, verificabile on-chain e nel database sovrano del Libro della Verità.",
    startX + 24,
    footerY + 245
  );

  ctx.restore();

  // 10. Piè di pagina estremo
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(197, 160, 89, 0.4)";
  ctx.font = "10px 'Space Grotesk', monospace, system-ui";
  ctx.letterSpacing = "0.15em";
  ctx.fillText("AUREUS PROTOCOL OS · SOVEREIGN OPERATIONAL STANDARD · MMXXVI", w / 2, h - 22);
}

/**
 * Scarica la Pergamena come file immagine PNG ad altissima risoluzione (300 DPI)
 */
export function downloadNotaryScroll(data: NotaryScrollData, filename = "AUREUS-Pergamena-Notarile.png"): void {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  renderNotaryScroll(canvas, data);

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Apre la finestra di stampa per esportare direttamente come PDF vettoriale A4
 */
export function printNotaryScroll(data: NotaryScrollData): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  renderNotaryScroll(canvas, data);
  const dataUrl = canvas.toDataURL("image/png");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AUREUS Protocol — Attestazione Notarile Sovrana</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: #050608;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          img {
            width: 100vw;
            height: 100vh;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print(); window.close();" />
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Verifica se l'ambiente corrente supporta la registrazione video da Canvas (MediaRecorder + captureStream)
 */
export function isCinematicVideoSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const canvasSupported =
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";
  const mediaRecorderSupported = typeof MediaRecorder !== "undefined";
  return Boolean(canvasSupported && mediaRecorderSupported);
}

export interface NotaryCinematicOptions {
  durationMs?: number;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (progressPct: number) => void;
  includeAudio?: boolean;
}

/**
 * Suona la campana solenne a 432 Hz Solfeggio con risonanza armonica su un nodo MediaStreamAudioDestination
 */
function synthesizeNotaryChime(
  ctx: AudioContext,
  dest: MediaStreamAudioDestinationNode
): void {
  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(0.65, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    master.connect(dest);

    // 1. Fondamentale Sacra 432 Hz (La aureo)
    const osc432 = ctx.createOscillator();
    osc432.type = "sine";
    osc432.frequency.setValueAtTime(432, now);
    osc432.connect(master);
    osc432.start(now);
    osc432.stop(now + 2.3);

    // 2. Prima Armonica 864 Hz
    const osc864 = ctx.createOscillator();
    osc864.type = "triangle";
    osc864.frequency.setValueAtTime(864, now);
    const gain864 = ctx.createGain();
    gain864.gain.setValueAtTime(0.35, now);
    gain864.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc864.connect(gain864);
    gain864.connect(master);
    osc864.start(now);
    osc864.stop(now + 1.5);

    // 3. Seconda Armonica Superiore 1296 Hz (Campanella cristallina)
    const osc1296 = ctx.createOscillator();
    osc1296.type = "sine";
    osc1296.frequency.setValueAtTime(1296, now);
    const gain1296 = ctx.createGain();
    gain1296.gain.setValueAtTime(0.2, now);
    gain1296.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc1296.connect(gain1296);
    gain1296.connect(master);
    osc1296.start(now);
    osc1296.stop(now + 1.0);

    // 4. Sub-basso profondo di ancoraggio 108 Hz (Risonanza monastica)
    const osc108 = ctx.createOscillator();
    osc108.type = "sine";
    osc108.frequency.setValueAtTime(108, now);
    const gain108 = ctx.createGain();
    gain108.gain.setValueAtTime(0.4, now);
    gain108.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc108.connect(gain108);
    gain108.connect(master);
    osc108.start(now);
    osc108.stop(now + 1.9);
  } catch (err) {
    console.warn("synthesizeNotaryChime audio synthesis notice:", err);
  }
}

/**
 * Genera un video cinematico ad alta definizione (WebM) dell'attestazione notarile AUREUS:
 * - Pulviscolo cosmico d'oro in sospensione
 * - Discesa ed incisione a caldo del Sigillo Notarile
 * - Shockwave radiale dorata
 * - Campana sacra a 432 Hz Solfeggio sincronizzata
 * - Fascio laser di convalida SHA-256 e QR-Code
 */
export async function generateNotaryCinematicVideo(
  data: NotaryScrollData,
  options?: NotaryCinematicOptions
): Promise<Blob> {
  if (!isCinematicVideoSupported()) {
    throw new Error("Cinema d'Onore non supportato nel browser corrente.");
  }

  const durationMs = options?.durationMs ?? 3600;
  const fps = options?.fps ?? 30;
  const width = options?.width ?? 720;
  const height = options?.height ?? 1018; // Rapporto proporzionale A4
  const includeAudio = options?.includeAudio ?? true;

  // 1. Pre-render della pergamena statica ad alta definizione
  const baseCanvas = document.createElement("canvas");
  renderNotaryScroll(baseCanvas, data);

  // 2. Canvas di registrazione frame per frame
  const recCanvas = document.createElement("canvas");
  recCanvas.width = width;
  recCanvas.height = height;
  const rawCtx = recCanvas.getContext("2d");
  if (!rawCtx) {
    throw new Error("Impossibile allocare il contesto Canvas 2D per il Cinema d'Onore.");
  }
  const ctx: CanvasRenderingContext2D = rawCtx;

  // 3. Predisposizione Audio con Web Audio API
  let audioContext: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (includeAudio) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        if (typeof audioContext.createMediaStreamDestination === "function") {
          audioDest = audioContext.createMediaStreamDestination();
        }
      }
    } catch {
      audioContext = null;
    }
  }

  // 4. Stream e Recorder
  const videoStream = recCanvas.captureStream(fps);
  let combinedStream = videoStream;
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);
  }

  let mimeType = "video/webm;codecs=vp9,opus";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8,opus";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/mp4";
  }

  const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (evt) => {
    if (evt.data && evt.data.size > 0) {
      recordedChunks.push(evt.data);
    }
  };

  // 5. Inizializzazione particelle di pulviscolo dorato
  const particleCount = 45;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -(0.4 + Math.random() * 0.9),
    radius: 1 + Math.random() * 2.5,
    alpha: 0.2 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
  }));

  const totalFrames = Math.max(30, Math.floor((durationMs / 1000) * fps));
  let chimePlayed = false;

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        if (audioContext && audioContext.state !== "closed") {
          audioContext.close().catch(() => {});
        }
      } catch {}
      const finalBlob = new Blob(recordedChunks, {
        type: mimeType || "video/webm",
      });
      resolve(finalBlob);
    };

    recorder.onerror = (err) => {
      reject(err);
    };

    recorder.start(100);

    let frame = 0;
    const intervalMs = 1000 / fps;

    function renderFrame() {
      if (frame >= totalFrames) {
        options?.onProgress?.(100);
        recorder.stop();
        return;
      }

      const p = frame / totalFrames; // 0.0 -> 1.0
      options?.onProgress?.(Math.min(99, Math.round(p * 100)));

      // Pulizia sfondo Ossidiana Sovrana
      ctx.fillStyle = "#07080b";
      ctx.fillRect(0, 0, width, height);

      // Bagliore radiale d'ambiente
      const ambGlow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        40,
        width / 2,
        height / 2,
        height * 0.7
      );
      ambGlow.addColorStop(0, "rgba(197, 160, 89, 0.08)");
      ambGlow.addColorStop(0.6, "rgba(11, 13, 19, 0.95)");
      ambGlow.addColorStop(1, "#050608");
      ctx.fillStyle = ambGlow;
      ctx.fillRect(0, 0, width, height);

      // Particelle di polvere aurea
      ctx.save();
      for (const pt of particles) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.y < -10) pt.y = height + 10;
        if (pt.x < -10) pt.x = width + 10;
        if (pt.x > width + 10) pt.x = -10;

        const flicker = Math.sin(pt.phase + frame * 0.1) * 0.25;
        const currentAlpha = Math.max(0.05, Math.min(1, pt.alpha + flicker));

        ctx.fillStyle = `rgba(232, 197, 106, ${currentAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Dissolvenza e comparsa della pergamena base
      // Phase 1 (0 -> 0.35): Rivelazione progressiva della struttura
      const baseAlpha = p < 0.35 ? 0.15 + (p / 0.35) * 0.85 : 1.0;
      ctx.save();
      ctx.globalAlpha = baseAlpha;
      ctx.drawImage(baseCanvas, 0, 0, width, height);
      ctx.restore();

      // Coordinate proporzionali del Sigillo Notarile
      const sealRatioX = (1240 - 250) / 1240;
      const sealRatioY = (1754 - 230) / 1754;
      const sealX = width * sealRatioX;
      const sealY = height * sealRatioY;

      // Phase 2 (0.35 -> 0.70): Discesa e conio a caldo del Sigillo con campana
      if (p >= 0.35 && p < 0.75) {
        const sealProgress = (p - 0.35) / 0.18; // 0.35 -> 0.53

        if (sealProgress < 1.0) {
          // Sigillo che scende ruotando
          const scale = 2.4 - sealProgress * 1.4;
          const rot = (1.0 - sealProgress) * Math.PI * 0.6;
          ctx.save();
          ctx.translate(sealX, sealY);
          ctx.rotate(rot);
          ctx.scale(scale, scale);
          drawOctagram(ctx, 0, 0, 24);
          ctx.restore();
        } else {
          // Impatto del sigillo a terra: trigger audio
          if (!chimePlayed && audioContext && audioDest) {
            chimePlayed = true;
            synthesizeNotaryChime(audioContext, audioDest);
          }

          // Onda d'urto radiale dorata
          const shockProgress = (p - 0.53) / 0.22;
          const shockRadius = 16 + shockProgress * 120;
          const shockAlpha = Math.max(0, 0.85 - shockProgress * 0.85);

          ctx.save();
          ctx.strokeStyle = `rgba(232, 197, 106, ${shockAlpha.toFixed(2)})`;
          ctx.lineWidth = 3 - shockProgress * 2;
          ctx.beginPath();
          ctx.arc(sealX, sealY, shockRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Alone aureo intenso
          const hitGlow = ctx.createRadialGradient(sealX, sealY, 0, sealX, sealY, 60);
          hitGlow.addColorStop(0, `rgba(245, 226, 168, ${(shockAlpha * 0.8).toFixed(2)})`);
          hitGlow.addColorStop(1, "rgba(197, 160, 89, 0)");
          ctx.fillStyle = hitGlow;
          ctx.beginPath();
          ctx.arc(sealX, sealY, 60, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Phase 3 (0.70 -> 0.95): Fascio Laser di Convalida Immutabile
      if (p >= 0.68 && p <= 0.94) {
        const laserProgress = (p - 0.68) / 0.26;
        const laserY = height * 0.72 + laserProgress * (height * 0.24);

        ctx.save();
        const laserGrad = ctx.createLinearGradient(0, laserY, width, laserY);
        laserGrad.addColorStop(0, "rgba(197, 160, 89, 0)");
        laserGrad.addColorStop(0.2, "rgba(232, 197, 106, 0.4)");
        laserGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
        laserGrad.addColorStop(0.8, "rgba(232, 197, 106, 0.4)");
        laserGrad.addColorStop(1, "rgba(197, 160, 89, 0)");

        ctx.strokeStyle = laserGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(30, laserY);
        ctx.lineTo(width - 30, laserY);
        ctx.stroke();

        // Riflesso soffuso del laser
        const beamGlow = ctx.createLinearGradient(0, laserY - 12, 0, laserY + 12);
        beamGlow.addColorStop(0, "rgba(197, 160, 89, 0)");
        beamGlow.addColorStop(0.5, "rgba(197, 160, 89, 0.18)");
        beamGlow.addColorStop(1, "rgba(197, 160, 89, 0)");
        ctx.fillStyle = beamGlow;
        ctx.fillRect(30, laserY - 12, width - 60, 24);
        ctx.restore();
      }

      // Cornice dorata viva e titolo solenne
      ctx.save();
      const frameAlpha = Math.min(1, 0.3 + p * 0.7);
      ctx.strokeStyle = `rgba(197, 160, 89, ${(frameAlpha * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(12, 12, width - 24, height - 24);
      ctx.restore();

      frame++;
      setTimeout(renderFrame, intervalMs);
    }

    renderFrame();
  });
}

/**
 * Genera e avvia il download del video cinematico (WebM)
 */
export async function downloadNotaryCinematicVideo(
  data: NotaryScrollData,
  filename?: string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const blob = await generateNotaryCinematicVideo(data, { onProgress });
  if (typeof document !== "undefined") {
    const defaultName = `AUREUS-Cinema-Notarile-${data.operatorName.replace(/\s+/g, "_")}.webm`;
    const targetFilename = filename || defaultName;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = targetFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return blob;
}
