# Agente conto locale (TraderLoadings)

Collega il tuo conto di trading all'app TraderLoadings tramite un **socket locale**.
Gira **solo sul tuo computer** e ascolta esclusivamente su `127.0.0.1`.

Due agenti, stesso protocollo (l'app non cambia):

| File | A cosa serve | Dipendenze |
|------|--------------|------------|
| `agent.mjs` | **Demo / prova senza installare nulla**: simula conto e ordini | Node (zero dip) |
| `mt5_agent.py` | **Conto REALE MetaTrader 5**: legge dati veri e invia ordini reali | Python + `MetaTrader5` |

## Privacy

- Le credenziali (numero conto + password) che inserisci nell'app vengono inviate
  **solo a questo agente**, sul tuo PC (`127.0.0.1`).
- **Non** passano dai server di TraderLoadings e **non** vengono salvate su disco:
  restano solo in memoria finché l'agente è in esecuzione e vengono azzerate al logout.

## Avvio

```bash
node scripts/account-agent/agent.mjs --port 8765
# oppure
pnpm --filter @workspace/scripts run account-agent
```

Poi nell'app: pagina **Broker → Conto (socket locale)** → inserisci broker, numero
conto, password e server → **Collega**.

## Conto REALE — MetaTrader 5 (`mt5_agent.py`)

Connettore **reale**: legge conto, saldo e posizioni veri dal tuo terminale MT5 e
invia ordini reali tramite il pacchetto ufficiale `MetaTrader5` (solo Windows).

Prerequisiti (sul tuo PC):

1. Installa il terminale **MetaTrader 5** del tuo broker ed esegui un login manuale almeno una volta.
2. Installa Python 3.9+ e il pacchetto: `pip install -r scripts/account-agent/requirements.txt`
3. Avvia il connettore:
   ```bash
   python scripts/account-agent/mt5_agent.py --port 8765
   # se hai più terminali, indica l'eseguibile:
   python scripts/account-agent/mt5_agent.py --port 8765 --mt5-path "C:\Program Files\MetaTrader 5\terminal64.exe"
   ```
4. Nell'app, **Broker → Conto (socket locale)** → inserisci broker, **numero conto MT5**, **password** e **server** (es. `ICMarketsSC-Live12`) → **Collega**.

### Sicurezza (consigliato)

- La **prima volta** lascia **"Ordini reali" disattivato** (modalità sola lettura): vedrai saldo/posizioni reali senza poter inviare ordini.
- Abilita gli ordini live solo quando sei sicuro. Ogni ordine richiede comunque conferma nell'app.
- La password serve solo a `mt5.login()` sul tuo PC: non viene loggata, salvata, né inviata altrove.

## Protocollo (per implementare un connettore reale)

Questa è un'implementazione di **riferimento** che *simula* il login e i dati del
conto, così la connessione è verificabile subito. Per un provider reale (MT4/MT5,
cTrader, broker API…) sostituisci la sezione `CONNETTORE REALE` in `agent.mjs` con
l'autenticazione e la lettura dati effettive.

Endpoint HTTP (CORS verso l'origine dell'app):

| Metodo | Path      | Body / Risposta |
|--------|-----------|-----------------|
| POST   | `/login`  | `{ broker, accountNumber, password, server, mode, orderEnabled }` → `{ ok, account }` |
| GET    | `/stream` | SSE: `{ type:"snapshot", snapshot }`, `{ type:"order_ack", result }`, `{ type:"error", message }` |
| POST   | `/order`  | `{ symbol, direction:"buy"/"sell", volume, stopLoss?, takeProfit? }` → `{ accepted, ticket?, reason? }` |
| POST   | `/logout` | → `{ ok:true }` |

Lo `snapshot` ha la forma: `{ status, mode, adapter, orderEnabled, account, metrics, openTrades, closedTrades, lastUpdated }`.

Qualsiasi connettore (EA MT5, script Python, ecc.) che espone questi endpoint su
`127.0.0.1` è compatibile con l'app.
