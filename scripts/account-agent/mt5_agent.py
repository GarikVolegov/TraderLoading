#!/usr/bin/env python3
"""
TraderLoadings - Connettore conto REALE per MetaTrader 5 (agente locale).

Espone lo STESSO protocollo HTTP+SSE dell'agente di riferimento Node, ma legge
dati REALI dal tuo terminale MetaTrader 5 e invia ordini reali tramite il
pacchetto ufficiale `MetaTrader5`.

Sicurezza / privacy:
  - Ascolta SOLO su 127.0.0.1: numero conto e password arrivano solo qui, sul tuo
    PC. Non vengono mai inviati a server esterni nE' salvati su disco; la password
    serve solo per mt5.login() e non viene loggata.
  - Con "ordini reali" disattivato nell'app (mode != live o orderEnabled false)
    l'agente NON invia mai ordini: sola lettura.

Prerequisiti (sul tuo PC Windows):
  1) Installa il terminale MetaTrader 5 del tuo broker ed esegui almeno un login
     manuale una volta.
  2) Installa Python 3.9+ e il pacchetto:  pip install MetaTrader5
  3) Avvia:  python scripts/account-agent/mt5_agent.py --port 8765
     (opzionale: --mt5-path "C:\\Program Files\\MetaTrader 5\\terminal64.exe")

Endpoint (identici all'agente demo):
  POST /login  { broker, accountNumber, password, server, mode, orderEnabled }
  GET  /stream  (SSE: snapshot, order_ack, error)
  POST /order  { symbol, direction, volume, stopLoss?, takeProfit? }
  POST /logout
"""

import argparse
import json
import queue
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import MetaTrader5 as mt5  # type: ignore
except Exception:  # pragma: no cover - dipendenza esterna
    mt5 = None

# ── Stato condiviso ──────────────────────────────────────────────────────────
mt5_lock = threading.Lock()        # MetaTrader5 non e' thread-safe: serializza
clients_lock = threading.Lock()
clients = set()                    # set di queue.Queue, una per client SSE

session = None                     # { broker, accountNumber, server, mode, orderEnabled }
mt5_path = None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def mask_account(n):
    s = str(n or "")
    return "****" if len(s) <= 4 else "****" + s[-4:]


# ── Lettura snapshot REALE da MT5 ────────────────────────────────────────────
def empty_metrics():
    return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0,
            "currency": "USD", "dailyProfit": 0}


def build_snapshot():
    """Costruisce lo snapshot nel formato atteso dall'app leggendo MT5."""
    if not session or mt5 is None:
        return {
            "status": "offline", "mode": (session or {}).get("mode", "demo"),
            "adapter": "mt5-local-socket", "orderEnabled": bool((session or {}).get("orderEnabled")),
            "metrics": empty_metrics(), "openTrades": [], "closedTrades": [],
            "lastUpdated": now_iso(),
        }

    with mt5_lock:
        info = mt5.account_info()
        positions = mt5.positions_get()

    if info is None:
        return {
            "status": "error", "mode": session["mode"], "adapter": "mt5-local-socket",
            "orderEnabled": bool(session["orderEnabled"]), "metrics": empty_metrics(),
            "openTrades": [], "closedTrades": [], "lastUpdated": now_iso(),
            "error": "MT5 non risponde (terminale chiuso o disconnesso).",
        }

    trade_mode_map = {0: "demo", 1: "contest", 2: "real"}
    account = {
        "login": str(info.login),
        "name": info.name,
        "server": info.server,
        "broker": getattr(info, "company", session["broker"]),
        "leverage": info.leverage,
        "tradeMode": trade_mode_map.get(info.trade_mode, "real"),
    }
    metrics = {
        "balance": round(info.balance, 2),
        "equity": round(info.equity, 2),
        "margin": round(info.margin, 2),
        "freeMargin": round(info.margin_free, 2),
        "currency": info.currency,
        "dailyProfit": round(info.profit, 2),  # P/L flottante delle posizioni aperte
    }
    open_trades = []
    for p in (positions or []):
        open_trades.append({
            "ticket": str(p.ticket),
            "symbol": p.symbol,
            "direction": "buy" if p.type == 0 else "sell",
            "volume": p.volume,
            "openTime": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
            "entryPrice": p.price_open,
            "stopLoss": p.sl or None,
            "takeProfit": p.tp or None,
            "profit": round(p.profit, 2),
            "commission": getattr(p, "commission", 0.0),
            "swap": getattr(p, "swap", 0.0),
            "status": "open",
            "source": "mt5",
        })

    return {
        "status": "connected", "mode": session["mode"], "adapter": "mt5-local-socket",
        "orderEnabled": bool(session["orderEnabled"]), "account": account,
        "metrics": metrics, "openTrades": open_trades, "closedTrades": [],
        "lastUpdated": now_iso(),
    }


def broadcast(event):
    data = "data: " + json.dumps(event) + "\n\n"
    with clients_lock:
        for q in list(clients):
            q.put(data)


def push_snapshot():
    broadcast({"type": "snapshot", "snapshot": build_snapshot()})


# ── Login / Logout REALI ─────────────────────────────────────────────────────
def do_login(payload):
    global session
    if mt5 is None:
        return {"ok": False, "reason": "Pacchetto MetaTrader5 non installato (pip install MetaTrader5)."}

    broker = payload.get("broker") or "Broker"
    account = payload.get("accountNumber")
    password = payload.get("password")
    server = payload.get("server")
    mode = "live" if payload.get("mode") == "live" else "demo"
    order_enabled = bool(payload.get("orderEnabled"))

    if not account or not password or not server:
        return {"ok": False, "reason": "Servono numero conto, password e server."}
    try:
        login_id = int(str(account).strip())
    except ValueError:
        return {"ok": False, "reason": "Il numero conto deve essere numerico."}

    with mt5_lock:
        init_ok = mt5.initialize(path=mt5_path) if mt5_path else mt5.initialize()
        if not init_ok:
            code, desc = mt5.last_error()
            return {"ok": False, "reason": f"Avvio terminale MT5 fallito: {desc} ({code})."}
        authorized = mt5.login(login=login_id, password=str(password), server=str(server))
        if not authorized:
            code, desc = mt5.last_error()
            mt5.shutdown()
            return {"ok": False, "reason": f"Login MT5 fallito: {desc} ({code})."}
        info = mt5.account_info()

    # La password NON viene conservata: MT5 mantiene la sessione del terminale.
    session = {"broker": broker, "accountNumber": str(account), "server": server,
               "mode": mode, "orderEnabled": order_enabled}
    print(f"[mt5-agent] login conto {mask_account(account)} @ {server} ({mode}, ordini {'ON' if order_enabled else 'OFF'})", flush=True)
    push_snapshot()
    return {"ok": True, "account": {"login": str(info.login) if info else str(account),
                                    "server": server, "broker": broker}}


def do_logout():
    global session
    session = None
    if mt5 is not None:
        with mt5_lock:
            mt5.shutdown()
    print("[mt5-agent] logout", flush=True)
    push_snapshot()
    return {"ok": True}


# ── Invio ordine REALE ───────────────────────────────────────────────────────
def do_order(payload):
    if not session:
        return {"accepted": False, "reason": "Conto non collegato."}
    if session["mode"] != "live" or not session["orderEnabled"]:
        return {"accepted": False, "reason": "Ordini reali disabilitati (sola lettura)."}
    if mt5 is None:
        return {"accepted": False, "reason": "MetaTrader5 non disponibile."}

    symbol = (payload.get("symbol") or "").upper().strip()
    direction = payload.get("direction")
    try:
        volume = float(payload.get("volume"))
    except (TypeError, ValueError):
        volume = 0.0
    if not symbol or direction not in ("buy", "sell") or volume <= 0:
        return {"accepted": False, "reason": "Ordine non valido."}

    sl = payload.get("stopLoss")
    tp = payload.get("takeProfit")

    with mt5_lock:
        if not mt5.symbol_select(symbol, True):
            return {"accepted": False, "reason": f"Simbolo {symbol} non disponibile."}
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"accepted": False, "reason": f"Nessun prezzo per {symbol}."}
        order_type = mt5.ORDER_TYPE_BUY if direction == "buy" else mt5.ORDER_TYPE_SELL
        price = tick.ask if direction == "buy" else tick.bid

        base = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "deviation": 20,
            "magic": 770011,
            "comment": "TraderLoadings",
            "type_time": mt5.ORDER_TIME_GTC,
        }
        if sl is not None:
            base["sl"] = float(sl)
        if tp is not None:
            base["tp"] = float(tp)

        # Prova diverse modalita' di riempimento (variano per broker).
        result = None
        for filling in (mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_RETURN):
            req = dict(base, type_filling=filling)
            result = mt5.order_send(req)
            if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
                break

    if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
        ticket = str(result.order)
        print(f"[mt5-agent] ordine {direction} {volume} {symbol} -> ticket {ticket}", flush=True)
        broadcast({"type": "order_ack", "result": {"accepted": True, "ticket": ticket}})
        push_snapshot()
        return {"accepted": True, "ticket": ticket}

    reason = result.comment if result is not None else "order_send fallito"
    broadcast({"type": "order_ack", "result": {"accepted": False, "reason": reason}})
    return {"accepted": False, "reason": reason}


# ── HTTP server (solo 127.0.0.1) ─────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # niente log HTTP rumorosi (e mai credenziali)

    def _cors(self):
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0 or length > 1_000_000:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/stream":
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            q = queue.Queue()
            with clients_lock:
                clients.add(q)
            try:
                first = "data: " + json.dumps({"type": "snapshot", "snapshot": build_snapshot()}) + "\n\n"
                self.wfile.write(first.encode())
                self.wfile.flush()
                while True:
                    try:
                        data = q.get(timeout=15)
                    except queue.Empty:
                        data = ": ping\n\n"
                    self.wfile.write(data.encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ValueError):
                pass
            finally:
                with clients_lock:
                    clients.discard(q)
            return

        if self.path.split("?")[0] in ("/", "/health"):
            self._json(200, {"ok": True, "status": "connected" if session else "offline",
                             "clients": len(clients)})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/login":
            result = do_login(self._read_json())
            self._json(200 if result.get("ok") else 400, result)
        elif path == "/order":
            self._json(200, do_order(self._read_json()))
        elif path == "/logout":
            self._json(200, do_logout())
        else:
            self._json(404, {"error": "Not found"})


def poller():
    """Aggiorna lo snapshot reale verso i client SSE ~ ogni 1.5s."""
    while True:
        time.sleep(1.5)
        if session and clients:
            try:
                push_snapshot()
            except Exception as exc:  # pragma: no cover
                broadcast({"type": "error", "message": str(exc)})


def main():
    global mt5_path
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--mt5-path", default=None, help="Percorso a terminal64.exe (opzionale)")
    args = parser.parse_args()
    mt5_path = args.mt5_path

    threading.Thread(target=poller, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    if mt5 is None:
        print("[mt5-agent] ATTENZIONE: pacchetto MetaTrader5 non trovato. Installa con: pip install MetaTrader5", flush=True)
    print(f"[mt5-agent] in ascolto su http://{args.host}:{args.port} - credenziali solo in locale, mai salvate.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        do_logout()
        server.shutdown()


if __name__ == "__main__":
    main()
