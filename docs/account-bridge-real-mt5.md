# TraderLoading Collegamento MetaTrader

MetaTrader 5 non e' obbligatorio nel percorso utente. L'app supporta due strade:

- SmartLink locale: gratuito e consigliato quando MetaTrader 5 e' installato/loggato sul PC. `mt5_bridge.py` legge conto/posizioni/storico tramite l'API Python ufficiale MT5 e invia snapshot reali al Broker Hub.
- Collegamento senza terminale: usa numero conto, server e password tramite il provider cloud configurato lato server. La password non viene salvata nel profilo e il conto appare collegato solo se il provider conferma uno snapshot reale.

Nel percorso principale dell'app l'utente non vede token, porte, host, WebRequest o codici di pairing.

## Avvio dall'app

1. Apri TraderLoading.
2. Vai in Broker Hub > Collega conto.
3. Scegli FP Trading o Broker MetaTrader.
4. Se hai MetaTrader 5, aprilo con il tuo conto e clicca `Avvia SmartLink`.
5. Se non hai MetaTrader 5, inserisci numero conto, server e password e clicca `Collega senza MetaTrader`.

Il conto appare come collegato solo dopo uno snapshot reale con account, balance/equity e timestamp recente.

## SmartLink locale per supporto

1. Apri MetaTrader 5 e accedi al conto reale o demo del broker.
2. Avvia SmartLink con il profilo creato dall'app:

```powershell
cd tools\mt5-local-bridge
.\start-smartlink.ps1 -ProfileId "<profile-id>"
```

Se FP Trading installa MetaTrader in una cartella personalizzata:

```powershell
.\start-smartlink.ps1 -ProfileId "<profile-id>" -TerminalPath "C:\Percorso\FP Trading MetaTrader 5\terminal64.exe"
```

Se il terminale non e' gia' loggato:

```powershell 
.\start-smartlink.ps1 -ProfileId "<profile-id>" -Login "123456" -Server "Broker-Live" -Password "<password>"
```

La password viene passata solo alla sessione locale MT5 e non viene salvata nel profilo Broker Hub.

## Collegamento senza terminale

Il collegamento senza terminale richiede un provider server-side configurato per broker MetaTrader. In produzione questo percorso deve avere chiavi provider valide sul backend e deve confermare account, saldo/equity e stato trading prima di creare il profilo.

Se il provider non e' configurato o rifiuta le credenziali, l'app deve mostrare un errore operativo semplice e non deve marcare il conto come collegato.

## Modalita' socket legacy

La vecchia modalita' socket resta disponibile per compatibilita':

```powershell
python mt5_bridge.py --host 127.0.0.1 --port 8765
```

## Sicurezza

- Gli ordini live sono bloccati finche' `tradingEnabled` non e' attivo.
- Il backend invia ordini solo con snapshot sincronizzato.
- L'app richiede conferma manuale prima di ogni ordine live.
- Con SmartLink locale MetaTrader deve restare aperto quando si vuole sincronizzare o tradare.
- Senza terminale il collegamento dipende dal provider cloud configurato lato server.

## Protocollo socket legacy

Messaggi newline-delimited JSON:

```json
{"type":"snapshot","payload":{}}
{"type":"place_order","payload":{"requestId":"mt5-1","order":{"symbol":"EURUSD","direction":"buy","volume":0.1}}}
```

Risposte bridge:

```json
{"type":"snapshot","payload":{"account":{"login":"123456","server":"Broker-Live","broker":"Broker","tradeMode":"real"},"metrics":{"balance":10000,"equity":10020,"margin":0,"freeMargin":10020,"currency":"USD","dailyProfit":0},"openTrades":[],"closedTrades":[]}}
{"type":"order_ack","payload":{"requestId":"mt5-1","result":{"accepted":true,"ticket":"1001"}}}
```
