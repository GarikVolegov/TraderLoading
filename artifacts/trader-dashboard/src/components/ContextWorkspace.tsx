import { lazy, Suspense, useState } from 'react';
import { Calculator, Wallet, Target, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
const Lot=lazy(()=>import('./LotCalculatorWidget').then(m=>({default:m.LotCalculatorWidget})));
const Broker=lazy(()=>import('./broker-hub/BrokerHubWidget').then(m=>({default:m.BrokerHubWidget})));
const Missions=lazy(()=>import('./MissionsWidget').then(m=>({default:m.MissionsWidget})));
const PANELS=[{id:'account',icon:Wallet,component:Broker},{id:'size',icon:Calculator,component:Lot},{id:'missions',icon:Target,component:Missions}] as const;
export function ContextWorkspace() {
 const {t}=useLanguage();const [panel,setPanel]=useState<string|null>(null);
 const active=PANELS.find(p=>p.id===panel);const Content=active?.component;
 return <><section className="context-workspace" aria-label={t('center.workspace')}><h2>{t('center.workspace')}</h2>
  <div>{PANELS.map(p=><button key={p.id} onClick={()=>setPanel(p.id)}><p.icon size={16}/><span>{t(`center.tool_${p.id}`)}</span><ChevronRight size={13}/></button>)}</div>
  <Link href="/?vista=strumenti&strumento=sessioni">{t("workspace.sessions")}<ChevronRight size={13}/></Link><Link href="/?vista=strumenti">{t('center.tools')}<ChevronRight size={13}/></Link>
 </section><Modal isOpen={Boolean(active)} onClose={()=>setPanel(null)} title={active?t(`center.tool_${active.id}`):''}><Suspense fallback={<Skeleton className="h-48"/>}>{Content&&<Content/>}</Suspense></Modal></>;
}
