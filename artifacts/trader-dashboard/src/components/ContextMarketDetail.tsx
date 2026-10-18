import { useId } from 'react';
import type { MarketContext } from '@workspace/api-client-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
export function PriceHistory({data}:{data:MarketContext|undefined}) {
 const {t}=useLanguage();const id=useId();const points=data?.priceHistory??[];
 if(points.length<2) return null;
 const low=Math.min(...points.map(p=>p.close)),high=Math.max(...points.map(p=>p.close)),span=high-low||1;
 const path=points.map((p,i)=>`${i?'L':'M'}${i/(points.length-1)*600},${62-(p.close-low)/span*54}`).join(' ');
 return <div className="context-price-history"><span>{t('center.price_history',{count:points.length})}</span><svg viewBox="0 0 600 76" preserveAspectRatio="none" role="img" aria-label={t('center.price_history',{count:points.length})}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d={`${path} L600,76 L0,76 Z`} fill={`url(#${id})`}/><path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div><small>{points[0].time.slice(0,10)}</small><small>{points.at(-1)?.time.slice(0,10)}</small></div></div>;
}
export function ContextMarketDetail({data}:{data:MarketContext|undefined}) {
 const {t,language}=useLanguage();const fmt=(n:number)=>new Intl.NumberFormat(language,{maximumFractionDigits:Math.abs(n)<1?5:2}).format(n);
 const reports=data?.cotReports??[];
 return <section className="context-depth" aria-label={t('center.market_detail')}>
 <div className="context-cot"><header><h2>{t('center.cot')}</h2><span>{t('center.cot_provider')} · {t('center.weekly')}</span></header>
 <p className="context-depth-note">{t('center.cot_scope')}</p>
 {reports.length?reports.map(r=><div key={r.currency} className={`context-cot-row ${r.status==='stale'?'is-stale':''}`}><div><strong>{r.currency}</strong><small>{t('center.report_date',{date:r.date})}</small></div><div><strong>{r.nonCommNet>0?'+':''}{fmt(r.nonCommNet)}</strong><small>{r.status==='stale'?t('market.stale'):t('center.net_contracts')}</small></div></div>):<p className="context-empty">{t('market.unavailable')}</p>}
 <details><summary>{t('center.cot_history')}</summary>{reports.map(r=><div key={r.currency}><strong>{r.market}</strong><p>{t('market.fetched',{time:r.fetchedAt})}</p><table><thead><tr><th>{t('center.category')}</th><th>{t('center.long')}</th><th>{t('center.short')}</th><th>{t('center.net')}</th></tr></thead><tbody>{[{name:t('center.non_comm'),long:r.nonCommLong,short:r.nonCommShort,net:r.nonCommNet},{name:t('center.comm'),long:r.commLong,short:r.commShort,net:r.commNet},{name:t('center.non_reportable'),long:r.retailLong,short:r.retailShort,net:r.retailNet}].map(row=><tr key={row.name}><td>{row.name}</td><td>{fmt(row.long)}</td><td>{fmt(row.short)}</td><td>{fmt(row.net)}</td></tr>)}</tbody></table><table><thead><tr><th>{t('center.report')}</th><th>{t('center.non_comm')}</th><th>{t('center.comm')}</th></tr></thead><tbody>{r.history.slice().reverse().map(h=><tr key={h.date}><td>{h.date}</td><td>{fmt(h.nonCommNet)}</td><td>{fmt(h.commNet)}</td></tr>)}</tbody></table></div>)}</details>
 </div>
 <div className="context-range-detail"><header><h2>{t('center.volatility')}</h2><span>{t('center.adr_tf')}</span></header><p className="context-depth-note">{t('center.adr_scope')}</p>
 <div className="context-range-grid">{[5,22,66,132,252].map((days,i)=>{const r=data?.ranges?.find(row=>row.days===days);return <div key={days}><span>{['1W','1M','3M','6M','1Y'][i]}</span><strong>{r?.value!==null&&r?.value!==undefined?fmt(r.value):'—'}</strong><small>{r?`${r.samples}/${days}`:'—'} {t('center.bars')}</small></div>;})}</div><p className="context-depth-note">{t('center.range_note')}</p>
 <Link href="/journal?t=piano&vista=agenda">{t('center.calendar_link')}</Link><Link href="/?vista=notizie">{t('center.news_link')}</Link>
 </div></section>;
}
