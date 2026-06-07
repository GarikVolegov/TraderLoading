# TraderLoading MetaTrader Connector

This is the advanced fallback route for MetaTrader accounts.

The main MT5 route is now TraderLoading SmartLink, which uses the local
MetaTrader 5 Python integration and does not require visible pairing codes or
WebRequest setup in the normal user flow.

## Install

1. Copy `TraderLoadingConnector.mq5` into `MQL5/Experts`.
2. Compile it from MetaEditor.
3. In MetaTrader, open `Tools > Options > Expert Advisors`.
4. Enable WebRequest for `http://127.0.0.1:3001`.
5. In Broker Hub, download `TraderLoadingConnector.mq5` and `TraderLoadingConnector.set`.
6. Attach the expert to any chart and load the `.set` file from the expert inputs.
7. Enable `AllowLiveTrading` only if you want the app to send live market orders.

The Connector sends heartbeat, account snapshot, open positions, and polls pending market orders from the app.
