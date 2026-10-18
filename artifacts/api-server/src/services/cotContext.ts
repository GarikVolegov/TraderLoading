import { getPairEntry } from '@workspace/pair-catalog';
import { cotReportFresh, type CotOutlook, type CotReport } from './cot.js';
export function cotForPair(pair: string, outlook: CotOutlook | undefined, now: number): { score: number|null; reports: CotReport[] } {
  const entry=getPairEntry(pair);
  if(!entry || !outlook) return {score:null,reports:[]};
  const base=pair.slice(0,3), quote=pair.slice(3,6);
  // FX futures already express the currency against USD; don't double-count DXY.
  const legs=entry.category==='metal'?[base]:entry.category.startsWith('forex')?[base,quote].filter(c=>c!=='USD'):[];
  const reports=legs.flatMap(c=>outlook.reports.find(r=>r.currency===c)??[]);
  if(!legs.length || reports.length!==legs.length || outlook.status!=='available' || reports.some(r=>r.status!=='available'||!Number.isFinite(Date.parse(r.fetchedAt))||r.nonCommLong<0||r.nonCommShort<0||!cotReportFresh(r.date,now)||now-Date.parse(r.fetchedAt)>2*3_600_000||Date.parse(r.fetchedAt)>now)) return {score:null,reports};
  if(new Set(reports.map(r=>r.date)).size!==1) return {score:null,reports};
  const values=reports.map(r=>100*(r.nonCommLong-r.nonCommShort)/(r.nonCommLong+r.nonCommShort));
  if(!values.every(Number.isFinite)) return {score:null,reports};
  const score=values.length===2?(values[0]-values[1])/2:base==='USD'?-values[0]:values[0];
  return {score:Math.round(Math.max(-100,Math.min(100,score))),reports};
}
