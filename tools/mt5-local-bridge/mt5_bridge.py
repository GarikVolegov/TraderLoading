#!/usr/bin/env python3
"""Local MetaTrader 5 account bridge for TraderLoading.

Run this on the same Windows machine where the MetaTrader 5 terminal is logged
into the real broker account. The Node API connects to this TCP server and
exchanges newline-delimited JSON messages.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    import MetaTrader5 as mt5
except ImportError as exc:
    raise SystemExit("Install dependencies first: python -m pip install -r requirements.txt") from exc


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def send_message(conn: socket.socket, message_type: str, payload: dict[str, Any]) -> None:
    conn.sendall((json.dumps({"type": message_type, "payload": payload}, separators=(",", ":")) + "\n").encode("utf-8"))


def direction_from_position(position_type: int) -> str:
    return "buy" if position_type == mt5.POSITION_TYPE_BUY else "sell"


def trade_from_position(position: Any) -> dict[str, Any]:
    return {
        "ticket": str(position.ticket),
        "symbol": position.symbol,
        "direction": direction_from_position(position.type),
        "volume": float(position.volume),
        "openTime": datetime.fromtimestamp(position.time, timezone.utc).isoformat().replace("+00:00", "Z"),
        "entryPrice": float(position.price_open),
        "stopLoss": float(position.sl) if position.sl else None,
        "takeProfit": float(position.tp) if position.tp else None,
        "profit": float(position.profit),
        "status": "open",
        "source": "mt5",
    }


def closed_trades(days: int) -> list[dict[str, Any]]:
    started = datetime.now(timezone.utc) - timedelta(days=days)
    deals = mt5.history_deals_get(started, datetime.now(timezone.utc))
    if deals is None:
        return []

    rows: list[dict[str, Any]] = []
    for deal in deals:
        if getattr(deal, "entry", None) != mt5.DEAL_ENTRY_OUT:
            continue
        rows.append(
            {
                "ticket": str(deal.ticket),
                "symbol": deal.symbol,
                "direction": "sell" if deal.type == mt5.DEAL_TYPE_BUY else "buy",
                "volume": float(deal.volume),
                "openTime": datetime.fromtimestamp(deal.time, timezone.utc).isoformat().replace("+00:00", "Z"),
                "closeTime": datetime.fromtimestamp(deal.time, timezone.utc).isoformat().replace("+00:00", "Z"),
                "entryPrice": float(deal.price),
                "exitPrice": float(deal.price),
                "profit": float(deal.profit),
                "commission": float(deal.commission),
                "swap": float(deal.swap),
                "status": "closed",
                "source": "mt5",
            }
        )
    return rows[-200:]


def snapshot(days: int) -> dict[str, Any]:
    account = mt5.account_info()
    positions = mt5.positions_get() or []
    if account is None:
        raise RuntimeError(f"MT5 account unavailable: {mt5.last_error()}")

    return {
        "account": {
            "login": str(account.login),
            "name": account.name,
            "server": account.server,
            "broker": account.company,
            "leverage": int(account.leverage),
            "tradeMode": "real" if account.trade_mode == mt5.ACCOUNT_TRADE_MODE_REAL else "demo",
        },
        "metrics": {
            "balance": float(account.balance),
            "equity": float(account.equity),
            "margin": float(account.margin),
            "freeMargin": float(account.margin_free),
            "currency": account.currency,
            "dailyProfit": 0.0,
        },
        "openTrades": [trade_from_position(position) for position in positions],
        "closedTrades": closed_trades(days),
        "lastUpdated": iso_now(),
    }


def broker_snapshot_payload(profile_id: str, token: str, days: int) -> dict[str, Any]:
    data = snapshot(days)
    account = data["account"]
    return {
        "profileId": profile_id,
        "token": token,
        "account": {
            "id": str(account["login"]),
            "label": f"{account.get('broker') or 'MetaTrader'} {account['login']}",
            "brokerName": account.get("broker") or "MetaTrader",
            "currency": data["metrics"]["currency"],
            "environment": "demo" if account.get("tradeMode") == "demo" else "live",
        },
        "metrics": data["metrics"],
        "positions": [
            {
                "id": trade["ticket"],
                "brokerPositionId": trade["ticket"],
                "symbol": trade["symbol"],
                "side": trade["direction"],
                "volume": trade["volume"],
                "entryPrice": trade.get("entryPrice"),
                "profit": trade.get("profit"),
                "openedAt": trade.get("openTime"),
                "source": "traderloading-mt5-smartlink",
            }
            for trade in data["openTrades"]
        ],
        "orders": [],
        "capabilities": {
            "readAccount": True,
            "readPositions": True,
            "readHistory": True,
            "placeOrders": True,
            "closePositions": True,
            "realtimeUpdates": True,
            "requiresTerminal": True,
        },
    }


def broker_history_payload(profile_id: str, token: str, days: int) -> dict[str, Any]:
    return {
        "profileId": profile_id,
        "token": token,
        "deals": [
            {
                "id": trade["ticket"],
                "symbol": trade["symbol"],
                "side": trade["direction"],
                "volume": trade["volume"],
                "entryPrice": trade.get("entryPrice"),
                "exitPrice": trade.get("exitPrice"),
                "profit": trade.get("profit"),
                "openedAt": trade.get("openTime"),
                "closedAt": trade.get("closeTime"),
                "source": "traderloading-mt5-smartlink",
            }
            for trade in closed_trades(days)
        ],
    }


def post_json(api_base: str, path: str, payload: dict[str, Any]) -> tuple[int, str]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        api_base.rstrip("/") + path,
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def get_json(api_base: str, path: str) -> tuple[int, dict[str, Any]]:
    request = urllib.request.Request(api_base.rstrip("/") + path, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode("utf-8"))
        except json.JSONDecodeError:
            return exc.code, {}


def poll_smartlink_orders(args: argparse.Namespace) -> None:
    code, payload = get_json(
        args.smartlink_api,
        f"/companion/orders/pending?profileId={urllib.parse.quote(args.profile_id)}&token={urllib.parse.quote(args.token)}",
    )
    if code >= 400:
        print(f"Order polling failed {code}: {payload}", flush=True)
        return
    for pending in payload.get("orders", []):
        order = pending.get("order") or {}
        if order.get("type") != "market":
            result = {"accepted": False, "reason": "SmartLink MT5 v1 supporta solo ordini market."}
        else:
            result = place_order(
                {
                    "symbol": order.get("symbol"),
                    "direction": order.get("side"),
                    "volume": order.get("volume"),
                    "stopLoss": order.get("stopLoss"),
                    "takeProfit": order.get("takeProfit"),
                    "closePositionId": order.get("closePositionId"),
                    "comment": "TraderLoading SmartLink",
                },
                args.deviation,
            )
        post_json(
            args.smartlink_api,
            f"/companion/orders/{urllib.parse.quote(str(pending.get('id')))}/result",
            {
                "profileId": args.profile_id,
                "token": args.token,
                "accepted": bool(result.get("accepted")),
                "brokerOrderId": result.get("ticket"),
                "reason": result.get("reason"),
            },
        )


def run_smartlink(args: argparse.Namespace) -> None:
    assert args.profile_id
    assert args.token
    print("TraderLoading SmartLink started", flush=True)
    while True:
        heartbeat_code, heartbeat_body = post_json(
            args.smartlink_api,
            "/companion/heartbeat",
            {"profileId": args.profile_id, "token": args.token, "terminal": "MetaTrader 5"},
        )
        snapshot_code, snapshot_body = post_json(
            args.smartlink_api,
            "/companion/snapshot",
            broker_snapshot_payload(args.profile_id, args.token, args.history_days),
        )
        history_code, history_body = post_json(
            args.smartlink_api,
            "/companion/history",
            broker_history_payload(args.profile_id, args.token, args.history_days),
        )
        if snapshot_code >= 400:
            print(f"Snapshot sync failed {snapshot_code}: {snapshot_body}", flush=True)
        elif heartbeat_code >= 400:
            print(f"Heartbeat failed {heartbeat_code}: {heartbeat_body}", flush=True)
        elif history_code >= 400:
            print(f"History sync failed {history_code}: {history_body}", flush=True)
        else:
            print("SmartLink snapshot synchronized", flush=True)
        poll_smartlink_orders(args)
        time.sleep(args.snapshot_interval)


def order_type(direction: str) -> int:
    return mt5.ORDER_TYPE_BUY if direction == "buy" else mt5.ORDER_TYPE_SELL


def place_order(order: dict[str, Any], deviation: int) -> dict[str, Any]:
    symbol = str(order.get("symbol", "")).upper()
    direction = str(order.get("direction", ""))
    volume = float(order.get("volume", 0))

    if direction not in {"buy", "sell"}:
        return {"accepted": False, "reason": "Direction must be buy or sell"}
    if volume <= 0:
        return {"accepted": False, "reason": "Volume must be greater than zero"}
    if not mt5.symbol_select(symbol, True):
        return {"accepted": False, "reason": f"Symbol {symbol} is not available in MT5"}

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {"accepted": False, "reason": f"No tick available for {symbol}"}

    side = order_type(direction)
    price = tick.ask if side == mt5.ORDER_TYPE_BUY else tick.bid
    request: dict[str, Any] = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": side,
        "price": price,
        "deviation": deviation,
        "magic": 260606,
        "comment": str(order.get("comment") or "TraderLoading")[:31],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    if order.get("stopLoss"):
        request["sl"] = float(order["stopLoss"])
    if order.get("takeProfit"):
        request["tp"] = float(order["takeProfit"])
    if order.get("closePositionId"):
        request["position"] = int(order["closePositionId"])

    result = mt5.order_send(request)
    if result is None:
        return {"accepted": False, "reason": f"MT5 order_send failed: {mt5.last_error()}"}
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return {"accepted": False, "reason": f"MT5 retcode {result.retcode}: {result.comment}"}

    return {"accepted": True, "ticket": str(result.order or result.deal)}


def handle_client(conn: socket.socket, args: argparse.Namespace) -> None:
    stop = threading.Event()

    def publish_snapshots() -> None:
        while not stop.is_set():
            try:
                send_message(conn, "snapshot", snapshot(args.history_days))
            except Exception as exc:  # noqa: BLE001 - bridge must stay alive and report errors.
                try:
                    send_message(conn, "error", {"message": str(exc)})
                except OSError:
                    return
            stop.wait(args.snapshot_interval)

    thread = threading.Thread(target=publish_snapshots, daemon=True)
    thread.start()

    buffer = ""
    try:
        with conn:
            while True:
                chunk = conn.recv(65536)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8")
                lines = buffer.split("\n")
                buffer = lines.pop() or ""
                for line in lines:
                    if not line.strip():
                        continue
                    message = json.loads(line)
                    payload = message.get("payload") or {}
                    if message.get("type") == "snapshot":
                        send_message(conn, "snapshot", snapshot(args.history_days))
                    if message.get("type") == "place_order":
                        request_id = payload.get("requestId")
                        result = place_order(payload.get("order") or {}, args.deviation)
                        send_message(conn, "order_ack", {"requestId": request_id, "result": result})
    finally:
        stop.set()


def main() -> None:
    parser = argparse.ArgumentParser(description="TraderLoading MT5 local bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--history-days", type=int, default=14)
    parser.add_argument("--snapshot-interval", type=float, default=2.0)
    parser.add_argument("--deviation", type=int, default=20)
    parser.add_argument("--terminal-path", default=os.environ.get("MT5_TERMINAL_PATH"))
    parser.add_argument("--smartlink-api", default=os.environ.get("TRADERLOADING_SMARTLINK_API"))
    parser.add_argument("--profile-id", default=os.environ.get("TRADERLOADING_SMARTLINK_PROFILE_ID"))
    parser.add_argument("--token", default=os.environ.get("TRADERLOADING_SMARTLINK_TOKEN", "smartlink"))
    parser.add_argument("--login", type=int)
    parser.add_argument("--password")
    parser.add_argument("--server")
    args = parser.parse_args()

    initialize_kwargs: dict[str, Any] = {}
    if args.terminal_path:
        initialize_kwargs["path"] = args.terminal_path
    if args.login:
        initialize_kwargs["login"] = args.login
    if args.password:
        initialize_kwargs["password"] = args.password
    if args.server:
        initialize_kwargs["server"] = args.server

    initialized = mt5.initialize(**initialize_kwargs)
    if not initialized:
        raise SystemExit(f"MT5 initialize failed: {mt5.last_error()}")

    try:
        if args.smartlink_api and args.profile_id:
            run_smartlink(args)
            return
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server.bind((args.host, args.port))
            server.listen(1)
            print(f"TraderLoading MT5 bridge listening on {args.host}:{args.port}", flush=True)
            while True:
                conn, address = server.accept()
                print(f"API connected from {address[0]}:{address[1]}", flush=True)
                handle_client(conn, args)
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
