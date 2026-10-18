import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export type TradingCalendar = {verifiedFrom:string;verifiedUntil:string;sourceUrls:string[];closedIntervals:{pair:string;start:string;end:string}[]};
export function validTradingCalendar(value:unknown):value is TradingCalendar {
  if(!value||typeof value!=="object") return false;
  const c=value as TradingCalendar;
  return Number.isFinite(Date.parse(c.verifiedFrom))&&Number.isFinite(Date.parse(c.verifiedUntil))&&Date.parse(c.verifiedUntil)>Date.parse(c.verifiedFrom)&&
    Array.isArray(c.sourceUrls)&&c.sourceUrls.some(u=>typeof u==="string"&&u.startsWith("https://www.dukascopy.com/"))&&
    Array.isArray(c.closedIntervals)&&c.closedIntervals.every(i=>["*","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","XAUUSD"].includes(i.pair)&&
      Number.isFinite(Date.parse(i.start))&&Number.isFinite(Date.parse(i.end))&&Date.parse(i.start)<Date.parse(i.end));
}
/** Normal hours use New York local time, so US DST transitions are explicit.
 * Exceptions require a reviewed, hash-pinned source calendar, not weekday guesses.
 */
export function isTradingWindowOpen(pair:string,start:string,end:string,calendar:TradingCalendar|null):boolean {
  const a=Date.parse(start),b=Date.parse(end);
  if(!validTradingCalendar(calendar) || !Number.isFinite(a)||!Number.isFinite(b)||b<=a||Date.parse(calendar.verifiedFrom)>a||Date.parse(calendar.verifiedUntil)<b||
    !calendar.sourceUrls.some(u=>u.startsWith("https://www.dukascopy.com/"))) return false;
  if(calendar.closedIntervals.some(i=>(i.pair===pair||i.pair==="*")&&Date.parse(i.start)<b&&Date.parse(i.end)>a)) return false;
  const format=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",hourCycle:"h23"});
  for(let t=a;t<=b;t+=60000) {
    const parts=format.formatToParts(t),day=parts.find(p=>p.type==="weekday")?.value,hour=Number(parts.find(p=>p.type==="hour")?.value);
    if(day==="Sat"||day==="Sun"&&hour<17||day==="Fri"&&hour>=17||pair==="XAUUSD"&&hour===17) return false;
  }
  return true;
}
export async function loadTradingCalendar():Promise<TradingCalendar|null> {
  const path=process.env.DIRECTIONAL_CALENDAR_PATH,hash=process.env.DIRECTIONAL_CALENDAR_SHA256;
  if(!path||!hash) return null;
  try {
    const bytes=await readFile(path);
    if(createHash("sha256").update(bytes).digest("hex")!==hash) return null;
    const value=JSON.parse(bytes.toString()) as TradingCalendar;
    return validTradingCalendar(value)?value:null;
  } catch { return null; }
}
