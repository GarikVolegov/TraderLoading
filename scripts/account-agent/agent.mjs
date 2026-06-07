#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TraderLoadings — Agente conto LOCALE (riferimento, zero dipendenze)
//
// Fa da ponte tra l'app e il tuo conto di trading. Gira SOLO sul tuo PC e
// ascolta esclusivamente su 127.0.0.1: le credenziali (numero conto + password)
// che l'app invia restano sul tuo computer, non vengono mai salvate su disco né
// inviate a server esterni.
//
// Questa è un'implementazione di RIFERIMENTO: simula il login e i dati del conto
// così la connessione è verificabile end-to-end. Per un provider reale (MT4/MT5,
// cTrader, broker API…) sostituisci la sezione marcata `CONNETTORE REALE` con
// l'autenticazione e la lettura dati effettive del tuo broker.
//
// Protocollo (HTTP + SSE), tutte le risposte con CORS verso l'app:
//   POST /login   { broker, accountNumber, password, server, mode, orderEnabled }
//   GET  /stream  → SSE: { type:"snapshot"|"order_ack"|"error", ... }
//   POST /order   { symbol, direction, volume, stopLoss?, takeProfit? }
//   POST /logout
//
// Avvio:  node scripts/account-agent/agent.mjs --port 8765
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";

// ── Argomenti ────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const HOST = arg("host", "127.0.0.1");
const PORT = Number(arg("port", "8765"));

// ── Stato sessione (solo in memoria; la password non viene mai persistita) ──────
let session = null; // { broker, accountNumber, server, mode, orderEnabled }
let password = null; // tenuta solo in RAM, mai loggata né scritta su disco
let account = null;
let metrics = emptyMetrics();
let openTrades = [];
let closedTrades = [];
let ticketSeq = 1;

function emptyMetrics() {
  return { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 };
}

function maskAccount(n) {
  const s = String(n ?? "");
  return s.length <= 4 ? "****" : `****${s.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function status() {
  return session ? "connected" : "offline";
}

function snapshot() {
  return {
    status: status(),
    mode: session?.mode ?? "demo",
    adapter: "mt5-local-socket",
    orderEnabled: Boolean(session?.orderEnabled),
    account: account ?? undefined,
    metrics,
    openTrades,
    closedTrades,
    lastUpdated: nowIso(),
  };
}

// ── SSE: client connessi ───────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(line); } catch { /* client chiuso */ }
  }
}

function pushSnapshot() {
  broadcast({ type: "snapshot", snapshot: snapshot() });
}

// ── Simulazione dati live (sostituire col CONNETTORE REALE) ─────────────────────
function recomputeMetrics() {
  // P/L fittizio delle posizioni aperte + piccola oscillazione
  const floating = openTrades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
  metrics.equity = round2(metrics.balance + floating);
  metrics.freeMargin = round2(metrics.equity - metrics.margin);
  metrics.dailyProfit = round2(metrics.equity - metrics.balance);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function tickPrices() {
  if (!session) return;
  for (const t of openTrades) {
    const drift = (Math.random() - 0.5) * t.volume * 20; // oscillazione P/L fittizia
    t.profit = round2((t.profit ?? 0) + drift);
  }
  recomputeMetrics();
  pushSnapshot();
}

setInterval(tickPrices, 2000).unref?.();

// ── Logica conto (RIFERIMENTO — qui aggancerai il broker reale) ─────────────────
function login(payload) {
  const { broker, accountNumber, password: pwd, server, mode, orderEnabled } = payload ?? {};
  if (!accountNumber || !pwd || !server) {
    return { ok: false, reason: "Servono numero conto, password e server." };
  }

  // ╔═══════════════════════ CONNETTORE REALE ═══════════════════════╗
  // Qui un provider reale autenticherebbe col broker usando accountNumber,
  // pwd e server (es. avvio terminale MT5 / API broker) e leggerebbe i dati
  // reali del conto. In questa versione di riferimento simuliamo il successo.
  // La password (pwd) NON viene loggata né scritta da nessuna parte.
  // ╚════════════════════════════════════════════════════════════════╝

  session = {
    broker: broker || "Broker",
    accountNumber: String(accountNumber),
    server: String(server),
    mode: mode === "live" ? "live" : "demo",
    orderEnabled: Boolean(orderEnabled),
  };
  password = String(pwd);
  account = {
    login: session.accountNumber,
    name: `${session.broker} ${maskAccount(session.accountNumber)}`,
    server: session.server,
    broker: session.broker,
    leverage: 100,
    tradeMode: session.mode === "live" ? "real" : "demo",
  };
  metrics = { balance: 10000, equity: 10000, margin: 0, freeMargin: 10000, currency: "USD", dailyProfit: 0 };
  openTrades = [];
  closedTrades = [];

  console.log(`[agent] login conto ${maskAccount(session.accountNumber)} @ ${session.server} (${session.mode}, ordini ${session.orderEnabled ? "ON" : "OFF"})`);
  pushSnapshot();
  return { ok: true, account };
}

function logout() {
  session = null;
  password = null; // azzera la credenziale in memoria
  account = null;
  metrics = emptyMetrics();
  openTrades = [];
  closedTrades = [];
  console.log("[agent] logout — credenziali azzerate");
  pushSnapshot();
}

function placeOrder(order) {
  if (!session) return { accepted: false, reason: "Conto non collegato." };
  // In demo gli ordini sono simulati; in live servono gli "ordini reali" abilitati.
  if (session.mode === "live" && !session.orderEnabled) {
    return { accepted: false, reason: "Ordini reali disabilitati per questo conto." };
  }
  const { symbol, direction, volume, stopLoss, takeProfit } = order ?? {};
  if (!symbol || (direction !== "buy" && direction !== "sell") || !(volume > 0)) {
    return { accepted: false, reason: "Ordine non valido." };
  }
  const ticket = `T${Date.now()}-${ticketSeq++}`;
  openTrades = [
    {
      ticket,
      symbol: String(symbol).toUpperCase(),
      direction,
      volume: Number(volume),
      openTime: nowIso(),
      entryPrice: round2(1 + Math.random()),
      stopLoss: stopLoss != null ? Number(stopLoss) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit) : undefined,
      profit: 0,
      status: "open",
      source: "mt5",
    },
    ...openTrades,
  ];
  metrics.margin = round2(metrics.margin + Number(volume) * 1000);
  recomputeMetrics();
  console.log(`[agent] ordine ${direction} ${volume} ${symbol} → ticket ${ticket}`);
  broadcast({ type: "order_ack", result: { accepted: true, ticket } });
  pushSnapshot();
  return { accepted: true, ticket };
}

// ── HTTP server (solo 127.0.0.1) ────────────────────────────────────────────────
function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "snapshot", snapshot: snapshot() })}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* */ } }, 15000);
    ping.unref?.();
    req.on("close", () => { clearInterval(ping); sseClients.delete(res); });
    return;
  }

  if (req.method === "POST" && path === "/login") {
    const result = login(await readBody(req));
    json(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === "POST" && path === "/order") {
    json(res, 200, placeOrder(await readBody(req)));
    return;
  }

  if (req.method === "POST" && path === "/logout") {
    logout();
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && (path === "/" || path === "/health")) {
    json(res, 200, { ok: true, status: status(), connectedClients: sseClients.size });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[agent] in ascolto su http://${HOST}:${PORT}`);
  console.log("[agent] le credenziali ricevute restano solo qui (in memoria), non vengono salvate.");
});
