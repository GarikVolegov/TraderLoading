// TraderLoading Connector for MetaTrader 5
// Install in MQL5/Experts, enable Algo Trading, and allow WebRequest to ApiBase.
#property strict
#property version "0.1"

#include <Trade/Trade.mqh>

input string ApiBase = "http://127.0.0.1:3001/api/brokers";
input string ProfileId = "";
input string PairingCode = "";
input bool AllowLiveTrading = false;
input int SyncSeconds = 5;

CTrade Trade;

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "");
   StringReplace(value, "\n", "\\n");
   return value;
}

string Http(string method, string path, string body)
{
   string headers = "Content-Type: application/json\r\n";
   char payload[];
   char result[];
   string resultHeaders;
   StringToCharArray(body, payload, 0, WHOLE_ARRAY, CP_UTF8);
   int code = WebRequest(method, ApiBase + path, headers, 10000, payload, result, resultHeaders);
   if(code < 200 || code >= 300)
   {
      Print("TraderLoading Connector HTTP ", code, " ", path, " ", CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
      return "";
   }
   return CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
}

string AccountJson()
{
   return StringFormat(
      "\"account\":{\"id\":\"%I64d\",\"label\":\"%s %I64d\",\"brokerName\":\"%s\",\"currency\":\"%s\",\"environment\":\"live\"}",
      AccountInfoInteger(ACCOUNT_LOGIN),
      JsonEscape(AccountInfoString(ACCOUNT_COMPANY)),
      AccountInfoInteger(ACCOUNT_LOGIN),
      JsonEscape(AccountInfoString(ACCOUNT_COMPANY)),
      JsonEscape(AccountInfoString(ACCOUNT_CURRENCY))
   );
}

string MetricsJson()
{
   return StringFormat(
      "\"metrics\":{\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"freeMargin\":%.2f,\"currency\":\"%s\",\"dailyProfit\":0}",
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE),
      JsonEscape(AccountInfoString(ACCOUNT_CURRENCY))
   );
}

string PositionsJson()
{
   string items = "";
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      string side = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL ? "sell" : "buy";
      string item = StringFormat(
         "{\"id\":\"%I64u\",\"brokerPositionId\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"entryPrice\":%.8f,\"markPrice\":%.8f,\"profit\":%.2f,\"source\":\"metatrader-local-companion\"}",
         ticket,
         ticket,
         JsonEscape(PositionGetString(POSITION_SYMBOL)),
         side,
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_PRICE_CURRENT),
         PositionGetDouble(POSITION_PROFIT)
      );
      items += (items == "" ? "" : ",") + item;
   }
   return "\"positions\":[" + items + "]";
}

void SendHeartbeat()
{
   string body = StringFormat(
      "{\"profileId\":\"%s\",\"token\":\"%s\",\"terminal\":\"MetaTrader 5\"}",
      JsonEscape(ProfileId),
      JsonEscape(PairingCode)
   );
   Http("POST", "/companion/heartbeat", body);
}

void SendSnapshot()
{
   string body = StringFormat(
      "{\"profileId\":\"%s\",\"token\":\"%s\",%s,%s,%s,\"orders\":[],\"capabilities\":{\"placeOrders\":%s,\"closePositions\":%s}}",
      JsonEscape(ProfileId),
      JsonEscape(PairingCode),
      AccountJson(),
      MetricsJson(),
      PositionsJson(),
      AllowLiveTrading ? "true" : "false",
      AllowLiveTrading ? "true" : "false"
   );
   Http("POST", "/companion/snapshot", body);
}

string ExtractString(string text, string key)
{
   string marker = "\"" + key + "\":\"";
   int start = StringFind(text, marker);
   if(start < 0) return "";
   start += StringLen(marker);
   int end = StringFind(text, "\"", start);
   if(end < 0) return "";
   return StringSubstr(text, start, end - start);
}

double ExtractNumber(string text, string key)
{
   string marker = "\"" + key + "\":";
   int start = StringFind(text, marker);
   if(start < 0) return 0;
   start += StringLen(marker);
   int end = start;
   while(end < StringLen(text))
   {
      ushort ch = StringGetCharacter(text, end);
      if((ch < '0' || ch > '9') && ch != '.' && ch != '-') break;
      end++;
   }
   return StringToDouble(StringSubstr(text, start, end - start));
}

void SendOrderResult(string orderId, bool accepted, string brokerOrderId, string reason)
{
   string body = StringFormat(
      "{\"profileId\":\"%s\",\"token\":\"%s\",\"accepted\":%s,\"brokerOrderId\":\"%s\",\"reason\":\"%s\"}",
      JsonEscape(ProfileId),
      JsonEscape(PairingCode),
      accepted ? "true" : "false",
      JsonEscape(brokerOrderId),
      JsonEscape(reason)
   );
   Http("POST", "/companion/orders/" + orderId + "/result", body);
}

void PollOrders()
{
   if(!AllowLiveTrading) return;
   string path = "/companion/orders/pending?profileId=" + ProfileId + "&token=" + PairingCode;
   string response = Http("GET", path, "");
   if(response == "" || StringFind(response, "\"orders\":[]") >= 0) return;

   string orderId = ExtractString(response, "id");
   string symbol = ExtractString(response, "symbol");
   string side = ExtractString(response, "side");
   string type = ExtractString(response, "type");
   double volume = ExtractNumber(response, "volume");

   if(orderId == "" || symbol == "" || volume <= 0)
   {
      Print("TraderLoading Connector: ordine non leggibile.");
      return;
   }
   if(type != "market")
   {
      SendOrderResult(orderId, false, "", "Solo ordini market supportati da questa versione del Connector MT5.");
      return;
   }

   bool ok = side == "sell" ? Trade.Sell(volume, symbol) : Trade.Buy(volume, symbol);
   string brokerOrderId = ok ? IntegerToString((int)Trade.ResultOrder()) : "";
   string reason = ok ? "" : Trade.ResultRetcodeDescription();
   SendOrderResult(orderId, ok, brokerOrderId, reason);
}

int OnInit()
{
   if(ProfileId == "" || PairingCode == "")
   {
      Print("TraderLoading Connector: set ProfileId and PairingCode.");
      return INIT_PARAMETERS_INCORRECT;
   }
   EventSetTimer(MathMax(1, SyncSeconds));
   SendHeartbeat();
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendHeartbeat();
   SendSnapshot();
   PollOrders();
}
