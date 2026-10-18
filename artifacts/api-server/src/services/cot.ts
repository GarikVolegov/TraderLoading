/** CFTC Legacy Futures Only. No synthetic rows/history and no mixing of
 * financial/disaggregated trader categories with legacy non-commercials. */
export const COT_MARKETS: Record<string, string> = {
  'EURO FX': 'EUR', 'BRITISH POUND': 'GBP', 'JAPANESE YEN': 'JPY',
  'SWISS FRANC': 'CHF', 'CANADIAN DOLLAR': 'CAD', 'AUSTRALIAN DOLLAR': 'AUD',
  'NZ DOLLAR': 'NZD', GOLD: 'XAU', SILVER: 'XAG', 'USD INDEX': 'USD',
};
export const COT_SOURCE = 'CFTC · Legacy Futures Only';
export interface CotReport {
  market: string; currency: string; date: string;
  nonCommLong: number; nonCommShort: number; commLong: number; commShort: number;
  retailLong: number; retailShort: number; nonCommNet: number; commNet: number; retailNet: number;
  history: { date: string; nonCommNet: number; commNet: number }[];
  source: string; fetchedAt: string; publishedAt: null;
  status: 'available' | 'stale';
}
export interface CotOutlook {
  reports: CotReport[]; status: 'available' | 'stale' | 'unavailable';
  fetchedAt: string | null; source: string; cached: boolean; fallback: false;
  nextUpdate: string;
}
type Row = Record<string, unknown>;
const fields = ['noncomm_positions_long_all','noncomm_positions_short_all','comm_positions_long_all','comm_positions_short_all','nonrept_positions_long_all','nonrept_positions_short_all'];
const DAY = 86_400_000;
export function cotReportFresh(date: string, now: number) {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && stamp <= now && now - stamp <= 11 * DAY;
}
export function parseCotRows(rows: Row[], fetchedAt: string): CotReport[] {
  const grouped = new Map<string, CotReport[]>();
  const now = Date.parse(fetchedAt);
  for (const row of rows) {
    const market = String(row.market_and_exchange_names ?? '').trim().toUpperCase();
    const key = Object.keys(COT_MARKETS).find(k => market === k || market.startsWith(`${k} - `));
    if (!key) continue;
    const date = String(row.report_date_as_yyyy_mm_dd ?? '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date)>now) continue;
    const values = fields.map(k => row[k] === null || row[k] === undefined || String(row[k]).trim() === '' ? NaN : Number(row[k]));
    if (!values.every(n=>Number.isSafeInteger(n) && n>=0)) continue;
    const [nonCommLong,nonCommShort,commLong,commShort,retailLong,retailShort] = values;
    if(nonCommLong+nonCommShort===0) continue;
    const currency=COT_MARKETS[key];
    const report: CotReport={ market, currency, date, nonCommLong,nonCommShort,commLong,commShort,retailLong,retailShort,
      nonCommNet:nonCommLong-nonCommShort, commNet:commLong-commShort, retailNet:retailLong-retailShort,
      history:[], source:COT_SOURCE, fetchedAt, publishedAt:null, status:cotReportFresh(date,now)?'available':'stale' };
    const list=grouped.get(currency)??[];
    if(!list.some(r=>r.date===date)) list.push(report);
    grouped.set(currency,list);
  }
  return [...grouped.values()].map(list=>{
    list.sort((a,b)=>b.date.localeCompare(a.date));
    return {...list[0],history:list.slice(0,12).reverse().map(r=>({date:r.date,nonCommNet:r.nonCommNet,commNet:r.commNet}))};
  });
}

async function fetchReports(): Promise<CotReport[]> {
  const url=new URL('https://publicreporting.cftc.gov/resource/6dca-aqww.json');
  url.searchParams.set('$where',Object.keys(COT_MARKETS).map(k=>`starts_with(market_and_exchange_names, '${k} - ')`).join(' OR '));
  url.searchParams.set('$order','report_date_as_yyyy_mm_dd DESC');
  url.searchParams.set('$limit','400');
  url.searchParams.set('$select',['market_and_exchange_names','report_date_as_yyyy_mm_dd',...fields].join(','));
  try {
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12_000)});
    if(!response.ok) throw new Error('CFTC unavailable');
    const rows: unknown=await response.json();
    const reports=Array.isArray(rows)?parseCotRows(rows,new Date().toISOString()):[];
    if(reports.length) return reports;
  } catch { /* Same legacy categories in the official weekly fallback below. */ }
  const response=await fetch('https://www.cftc.gov/dea/newcot/deafut.txt',{signal:AbortSignal.timeout(8_000)});
  if(!response.ok) throw new Error('CFTC unavailable');
  const text=await response.text();
  const rows: Row[]=text.split('\n').flatMap(line=>{
    const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
    if(cols.length<17) return [];
    return [{market_and_exchange_names:cols[0].replace('U.S. DOLLAR INDEX','USD INDEX'),report_date_as_yyyy_mm_dd:cols[2],...Object.fromEntries(fields.map((k,i)=>[k,cols[[8,9,11,12,15,16][i]]]))}];
  });
  return parseCotRows(rows,new Date().toISOString());
}

export function createCotService(load=fetchReports, now=Date.now) {
  let reports: CotReport[]=[];
  let fetchedAt: string|null=null, retryAt=0, failed=false;
  let pending: Promise<void>|null=null;
  return async (): Promise<CotOutlook> => {
    const cached=now()<retryAt;
    if(!cached) {
      pending??=(async()=>{
        try {
          const next=await load();
          if(!next.length) throw new Error('No valid CFTC records');
          reports=next;fetchedAt=new Date(now()).toISOString();failed=false;
          retryAt=now()+3_600_000;
        } catch { failed=true;retryAt=now()+60_000; }
      })().finally(()=>{pending=null;});
      await pending;
    }
    const visible=reports.filter(r=>now()-Date.parse(r.date)<=45*DAY).map(r=>({...r,status:failed||!cotReportFresh(r.date,now())?'stale' as const:'available' as const}));
    return {reports:visible,status:!visible.length?'unavailable':visible.some(r=>r.status==='available')?'available':'stale',source:COT_SOURCE,fetchedAt,cached,fallback:false,nextUpdate:new Date(retryAt).toISOString()};
  };
}
export const getCotOutlook=createCotService();
