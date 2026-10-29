/**
 * AUREUS PROTOCOL — Generatore di Schede d'Onore & Condivisione Virale
 * Retina Canvas (1200x630 a 2x DPI -> buffer 2400x1260)
 *
 * Concepito secondo l'Ethos AUREUS: finiture in Ossidiana e Oro Imperiale (#C5A059),
 * geometria sacra, bento grid di telemetria e certificazione crittografica.
 * Zero dipendenze esterne: rendering Canvas 2D nativo ad altissima velocità.
 */

export interface HonorCardData {
  title?: string;
  subtitle?: string;
  operatorName: string;
  asset?: string;
  winRate?: number;
  winTrades?: number;
  totalTrades?: number;
  drawdown?: number;
  maxAllowedDrawdown?: number;
  totalProfitFormatted?: string;
  integrityScore?: number;
  isDisqualified?: boolean;
  seasonLabel?: string;
  verificationHash?: string;
  timestamp?: string;
}

/**
 * Calcola l'hash crittografico di validazione della scheda d'onore
 */
export function computeHonorHash(data: HonorCardData): string {
  const payload = `${data.operatorName}:${data.winRate ?? 0}:${data.drawdown ?? 0}:${data.timestamp || ""}:${data.totalTrades ?? 0}`;
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  return `0x${part1}${part2}`;
}

/**
 * Traccia un rettangolo con angoli arrotondati su un contesto Canvas 2D
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Disegna il sigillo geometrico aureo a 8 punte (Aureus Octagram)
 */
function drawAureusEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // Bagliore centrale
  const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR * 1.6);
  radialGlow.addColorStop(0, "rgba(232, 197, 106, 0.45)");
  radialGlow.addColorStop(0.5, "rgba(197, 160, 89, 0.15)");
  radialGlow.addColorStop(1, "rgba(197, 160, 89, 0)");
  ctx.fillStyle = radialGlow;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Cerchio interno e stella a 8 punte
  ctx.strokeStyle = "#C5A059";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // Raggi a 8 punte
  ctx.fillStyle = "#E8C56A";
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const isMajor = i % 2 === 0;
    const r = isMajor ? outerR : outerR * 0.72;
    const x1 = Math.cos(angle) * r;
    const y1 = Math.sin(angle) * r;
    const x2 = Math.cos(angle + 0.18) * (outerR * 0.35);
    const y2 = Math.sin(angle + 0.18) * (outerR * 0.35);
    const x3 = Math.cos(angle - 0.18) * (outerR * 0.35);
    const y3 = Math.sin(angle - 0.18) * (outerR * 0.35);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  // Nucleo diamante
  ctx.fillStyle = "#FFF7DF";
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renderizza l'intera Scheda d'Onore ad altissima fedeltà su Canvas HTML5
 * Standard Retina: buffer 2400x1260, layout logico 1200x630.
 */
export function renderHonorCardToCanvas(data: HonorCardData): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("renderHonorCardToCanvas richiede un ambiente DOM");
  }

  const canvas = document.createElement("canvas");
  const logicalW = 1200;
  const logicalH = 630;
  const dpi = 2; // Retina multiplier

  canvas.width = logicalW * dpi;
  canvas.height = logicalH * dpi;
  canvas.style.width = `${logicalW}px`;
  canvas.style.height = `${logicalH}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Impossibile inizializzare il contesto Canvas 2D");
  }

  // Scala il contesto per garantire rendering nitido a 2x
  ctx.scale(dpi, dpi);

  // 1. SFONDO REALE IN OSSIDIANA PROFONDA CON RADIAL GLOW
  const bg = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 80, logicalW / 2, logicalH / 2, 750);
  bg.addColorStop(0, "#10131d");
  bg.addColorStop(0.55, "#0b0c11");
  bg.addColorStop(1, "#050608");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, logicalW, logicalH);

  // 2. ORBITE CELESTI / SACRA GEOMETRIA SULLO SFONDO
  ctx.save();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.04)";
  ctx.lineWidth = 1;
  const centerRingX = logicalW / 2;
  const centerRingY = logicalH / 2;
  [160, 280, 420, 560].forEach((r) => {
    ctx.beginPath();
    ctx.arc(centerRingX, centerRingY, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  // 3. CORNICE IMPERIALE AUREUS E GUILLOCHE CORNER BRACKETS
  // Bordo esterno principale
  ctx.save();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 24, 24, logicalW - 48, logicalH - 48, 16);
  ctx.stroke();

  // Bordo interno hairline
  ctx.strokeStyle = "rgba(197, 160, 89, 0.16)";
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 32, 32, logicalW - 64, logicalH - 64, 12);
  ctx.stroke();

  // 4 Staffe Imperiali agli Angoli
  const cornerSize = 22;
  const corners = [
    { x: 38, y: 38, dx: 1, dy: 1 },
    { x: logicalW - 38, y: 38, dx: -1, dy: 1 },
    { x: 38, y: logicalH - 38, dx: 1, dy: -1 },
    { x: logicalW - 38, y: logicalH - 38, dx: -1, dy: -1 },
  ];
  ctx.strokeStyle = "#C5A059";
  ctx.lineWidth = 2.5;
  corners.forEach(({ x, y, dx, dy }) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * cornerSize, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * cornerSize);
    ctx.stroke();
  });
  ctx.restore();

  // 4. TESTATA OPERATIVA & EMBLEMA REGALE
  drawAureusEmblem(ctx, logicalW / 2, 70, 22);

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#C5A059";
  ctx.font = "bold 11px ui-monospace, 'Space Grotesk', monospace";
  ctx.letterSpacing = "0.22em";
  ctx.fillText("AUREUS PROTOCOL · ORDINE OPERATIVO SOVRANO", logicalW / 2, 108);

  // Linea separatrice con diamante centrale
  const sepW = 420;
  const sepY = 118;
  const lineGrad = ctx.createLinearGradient((logicalW - sepW) / 2, sepY, (logicalW + sepW) / 2, sepY);
  lineGrad.addColorStop(0, "rgba(197, 160, 89, 0)");
  lineGrad.addColorStop(0.5, "rgba(197, 160, 89, 0.45)");
  lineGrad.addColorStop(1, "rgba(197, 160, 89, 0)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((logicalW - sepW) / 2, sepY);
  ctx.lineTo((logicalW + sepW) / 2, sepY);
  ctx.stroke();

  // Mini diamante al centro
  ctx.fillStyle = "#E8C56A";
  ctx.beginPath();
  ctx.moveTo(logicalW / 2, sepY - 3);
  ctx.lineTo(logicalW / 2 + 3, sepY);
  ctx.lineTo(logicalW / 2, sepY + 3);
  ctx.lineTo(logicalW / 2 - 3, sepY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. TITOLO DELL'IMPRESA & NOME OPERATORE
  ctx.save();
  ctx.textAlign = "center";
  const mainTitle = (data.title || "PROVA DEL FUOCO SUPERATA").toUpperCase();
  ctx.font = "bold 28px 'Cinzel', 'Cinzel Decorative', 'Times New Roman', Georgia, serif";
  ctx.fillStyle = "#F4F4F6";
  ctx.shadowColor = "rgba(232, 197, 106, 0.35)";
  ctx.shadowBlur = 12;
  ctx.fillText(mainTitle, logicalW / 2, 160);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "italic 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  const subtitle = data.subtitle || "Esecuzione chirurgica e fedeltà al Codice. Disciplina prima del profitto.";
  ctx.fillText(subtitle, logicalW / 2, 185);
  ctx.restore();

  // Chip Operatore Nobilitata
  const cleanOpName = (data.operatorName || "OPERATORE").trim().toUpperCase();
  const assetName = (data.asset || "XAUUSD").replace("/", "").toUpperCase();
  const chipText = `OPERATORE: ${cleanOpName} · ${assetName}`;
  const chipW = Math.max(340, cleanOpName.length * 12 + 160);
  const chipH = 34;
  const chipX = (logicalW - chipW) / 2;
  const chipY = 202;

  ctx.save();
  drawRoundedRect(ctx, chipX, chipY, chipW, chipH, 8);
  ctx.fillStyle = "rgba(197, 160, 89, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(197, 160, 89, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 12.5px ui-monospace, monospace";
  ctx.fillStyle = "#E8C56A";
  ctx.fillText(chipText, logicalW / 2, chipY + chipH / 2);
  ctx.restore();

  // 6. BENTO GRID TELEMETRIA (4 CARDS)
  const cardCount = 4;
  const cardW = 250;
  const cardH = 180;
  const cardGap = 20;
  const totalBentoW = cardCount * cardW + (cardCount - 1) * cardGap;
  const bentoStartX = (logicalW - totalBentoW) / 2;
  const bentoY = 255;

  const winRateVal = typeof data.winRate === "number" ? `${data.winRate.toFixed(1)}%` : "100.0%";
  const winTradesVal = data.winTrades ?? 0;
  const totalTradesVal = data.totalTrades ?? 0;
  const tradesSub = totalTradesVal > 0 ? `${winTradesVal} su ${totalTradesVal} Trade` : "Esecuzioni Perfette";

  const ddVal = typeof data.drawdown === "number" ? `${data.drawdown.toFixed(2)}%` : "0.00%";
  const maxDDVal = typeof data.maxAllowedDrawdown === "number" ? `${data.maxAllowedDrawdown}%` : "10.0%";

  const integScore = typeof data.integrityScore === "number" ? data.integrityScore : 100;
  const integLabel = integScore >= 95 ? "INCORRUTTIBILE" : integScore >= 80 ? "CONFORME" : "RIGORE MINIMO";

  const profitVal = data.totalProfitFormatted || "+0.00 R";

  const cards = [
    {
      label: "TASSO DI VITTORIA",
      val: winRateVal,
      valColor: "#34d399",
      sub: tradesSub,
      badge: "CONVALIDATO",
      badgeColor: "#10b981",
    },
    {
      label: "DRAWDOWN MASSIMO",
      val: ddVal,
      valColor: data.isDisqualified ? "#ef4444" : "#E8C56A",
      sub: `Soglia Limite ${maxDDVal}`,
      badge: data.isDisqualified ? "VIOLATO" : "CONFORME",
      badgeColor: data.isDisqualified ? "#ef4444" : "#10b981",
    },
    {
      label: "INDICE D'INTEGRITÀ",
      val: `${integScore}%`,
      valColor: "#34d399",
      sub: "FEDELTÀ AL PIANO",
      badge: integLabel,
      badgeColor: "#10b981",
    },
    {
      label: "RENDICONTO NETTO",
      val: profitVal,
      valColor: profitVal.startsWith("-") ? "#ef4444" : "#34d399",
      sub: "BILANCIO SESSIONE",
      badge: "PROTOCOLLATO",
      badgeColor: "#C5A059",
    },
  ];

  cards.forEach((c, idx) => {
    const cx = bentoStartX + idx * (cardW + cardGap);
    const cy = bentoY;

    // Card background con gradient sottile
    ctx.save();
    drawRoundedRect(ctx, cx, cy, cardW, cardH, 12);
    const cardGrad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
    cardGrad.addColorStop(0, "rgba(18, 20, 28, 0.9)");
    cardGrad.addColorStop(1, "rgba(10, 11, 16, 0.95)");
    ctx.fillStyle = cardGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(197, 160, 89, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Etichetta metrica
    ctx.textAlign = "left";
    ctx.font = "bold 9.5px ui-monospace, monospace";
    ctx.fillStyle = "#8E8E98";
    ctx.letterSpacing = "0.12em";
    ctx.fillText(c.label, cx + 16, cy + 30);

    // Valore primario
    ctx.font = "bold 28px ui-monospace, 'Space Grotesk', monospace";
    ctx.fillStyle = c.valColor;
    ctx.fillText(c.val, cx + 16, cy + 76);

    // Sottotitolo
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(c.sub, cx + 16, cy + 104);

    // Status chip inferiore
    const badgeText = c.badge;
    const badgeW = badgeText.length * 7.5 + 16;
    const badgeH = 22;
    const badgeX = cx + 16;
    const badgeY = cy + 138;

    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fillStyle = "rgba(197, 160, 89, 0.08)";
    ctx.fill();
    ctx.strokeStyle = c.badgeColor === "#ef4444" ? "rgba(239, 68, 68, 0.4)" : "rgba(197, 160, 89, 0.35)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillStyle = c.badgeColor;
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();
  });

  // 7. FOOTER CRITTOGRAFICO DI VALIDITÀ
  const footerY = 540;
  const hash = data.verificationHash || computeHonorHash(data);
  const now = data.timestamp || new Date().toISOString().replace("T", " ").substring(0, 16);

  ctx.save();
  // Linea separatrice inferiore
  ctx.strokeStyle = "rgba(197, 160, 89, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 510);
  ctx.lineTo(logicalW - 48, 510);
  ctx.stroke();

  // Hash & validità a sinistra
  ctx.textAlign = "left";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#71717a";
  ctx.fillText(`HASH DI VERIFICA: ${hash}`, 52, footerY);
  ctx.fillText(`DATA PROTOCOLLO: ${now} UTC`, 52, footerY + 18);

  // Sigillo centrale
  ctx.textAlign = "center";
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#C5A059";
  ctx.fillText("NESSUNA DERIVA EMOTIVA · RIGORE MATEMATICO", logicalW / 2, footerY + 8);

  // Link e codice a destra
  ctx.textAlign = "right";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillStyle = "#E8C56A";
  ctx.fillText("AUREUS PROTOCOL · aureus.trade", logicalW - 52, footerY);
  ctx.font = "9.5px ui-monospace, monospace";
  ctx.fillStyle = "#71717a";
  ctx.fillText("IL CODICE DELLA PRESENZA E DELL'EREDITÀ", logicalW - 52, footerY + 18);
  ctx.restore();

  return canvas;
}

/**
 * Converte il canvas renderizzato in un Blob PNG ad alta risoluzione
 */
export function generateHonorCardBlob(data: HonorCardData): Promise<Blob> {
  const canvas = renderHonorCardToCanvas(data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Errore durante la generazione del Blob PNG"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Converte il canvas in un dataURL PNG per anteprima immediata nel DOM
 */
export function generateHonorCardDataUrl(data: HonorCardData): string {
  const canvas = renderHonorCardToCanvas(data);
  return canvas.toDataURL("image/png");
}

/**
 * Verifica se l'API Web Share nativa con supporto file è disponibile
 */
export function canShareHonorCard(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  return true;
}

/**
 * Condivide la scheda d'onore sfruttando l'ecosistema del dispositivo:
 * 1. Web Share API nativa con file allegato (iOS, Android, Safari macOS)
 * 2. Clipboard API (copia dell'immagine PNG)
 * 3. Download diretto del file come fallback sicuro
 */
export async function shareHonorCard(data: HonorCardData): Promise<{
  success: boolean;
  method: "native" | "clipboard" | "download";
}> {
  const blob = await generateHonorCardBlob(data);
  const cleanOpName = (data.operatorName || "Operatore").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `AUREUS-SCHEDA-ONORE-${cleanOpName}.png`;
  const shareTitle = `AUREUS PROTOCOL — Scheda d'Onore: ${data.operatorName}`;
  const hash = data.verificationHash || computeHonorHash(data);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://aureus.trade";
  const verifyUrl = `${origin}/api/public/verify-honor/${encodeURIComponent(hash)}`;
  const shareText = `Prova del Fuoco superata ne Il Protocollo Aureus. Operatore: ${data.operatorName}. Win Rate: ${data.winRate ?? 100}%. Disciplina prima del profitto.`;

  // 1. Prova Web Share nativo con file PNG allegato
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n${verifyUrl}`,
          files: [file],
        });
        return { success: true, method: "native" };
      }
      // Se non supporta la condivisione diretta di file, prova share testuale con link OpenGraph
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: verifyUrl,
      });
      return { success: true, method: "native" };
    } catch (err: unknown) {
      // Se l'utente chiude la finestra di share nativa (AbortError), termina pacificamente
      if (err instanceof Error && err.name === "AbortError") {
        return { success: true, method: "native" };
      }
    }
  }

  // 2. Fallback su Clipboard API (Copia immagine PNG diretta)
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      return { success: true, method: "clipboard" };
    } catch {
      // Fallback su download
    }
  }

  // 3. Fallback universale: Download automatico su disco/rullino
  await downloadHonorCardPng(data, fileName);
  return { success: true, method: "download" };
}

/**
 * Copia l'immagine della Scheda d'Onore negli Appunti di sistema
 */
export async function copyHonorCardToClipboard(data: HonorCardData): Promise<boolean> {
  const blob = await generateHonorCardBlob(data);
  if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
    return false;
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scarica direttamente il file PNG della Scheda d'Onore
 */
export async function downloadHonorCardPng(data: HonorCardData, filename?: string): Promise<void> {
  const blob = await generateHonorCardBlob(data);
  const cleanOpName = (data.operatorName || "Operatore").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualName = filename || `AUREUS-SCHEDA-ONORE-${cleanOpName}.png`;

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = actualName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
