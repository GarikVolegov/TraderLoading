import React, {useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '@/contexts/LanguageContext';
import {ReplayChart} from '@/components/backtest-terminal/ReplayChart';
import {ToolRail} from '@/components/backtest-terminal/ToolRail';
import {FavoriteToolsBar} from '@/components/backtest-terminal/FavoriteToolsBar';
import {TerminalSettingsDialog} from '@/components/backtest-terminal/TerminalSettingsDialog';
import {useChartPreferences} from '@/components/backtest-terminal/useChartPreferences';
import {DEFAULT_TERMINAL_SETTINGS,DEFAULT_TICKET} from '@/lib/replay/terminalPersistence';
import '@/components/backtest-terminal/terminal.css';
import './fixture.css';
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>originalFetch(input,{...init,headers:{...Object.fromEntries(new Headers(init.headers)), 'x-fixture-user':new URLSearchParams(location.search).get('user')||'chart-a'}});
const candles=Array.from({length:180},(_,i)=>{const open=100+Math.sin(i/8)*3+i*.025;const close=open+Math.sin(i*1.7)*.65;return {time:1735689600+i*60,open,close,high:Math.max(open,close)+.35,low:Math.min(open,close)-.35,volume:100+i*3};});
function App(){
 const chartPreferences=useChartPreferences(DEFAULT_TERMINAL_SETTINGS);
 const chartApi=useRef<any>(null);
 const settings={...DEFAULT_TERMINAL_SETTINGS,...chartPreferences.preferences.settings};
 const setSettings=(next:any)=>chartPreferences.update(p=>({...p,settings:next}));
 const [drawings,setDrawings]=useState<any[]>([]),[indicators,setIndicators]=useState<any[]>([{id:'volume',type:'volume',on:true,color:'#26a69a'}]);
 const [activeTool,setActiveTool]=useState<any>('cursor'),[modal,setModal]=useState(false);
 const engine:any={chartPreferences,settings,setSettings,drawings,setDrawings,indicators,setIndicators, revealed:candles,symbol:'AAPL',interval:'1m',intervalSeconds:60,ticket:DEFAULT_TICKET,position:null,pendingOrder:null,trades:[],hoveredTradeId:null,replayTime:candles.at(-1)!.time,ensureHistoryBefore:()=>{},seekToTime:()=>{}};
 (window as any).qa={zoom:()=>chartApi.current?.zoomIn(),state:()=>({preferences:chartPreferences.preferences,status:chartPreferences.status,drawings,activeTool}),update:chartPreferences.update,resolve:chartPreferences.resolveConflict,retry:chartPreferences.retry,tool:setActiveTool,settings:(value:any)=>setSettings({...settings,...value}),clear:()=>setDrawings([])};
 return <div className="btm-root"><header className="qa-header"><strong>TraderLoadings · Chart workspace</strong><button onClick={()=>setModal(true)}>Impostazioni grafico</button><output data-testid="sync">{chartPreferences.status}</output></header><main className="btm-main"><ToolRail engine={engine} activeTool={activeTool} onToolChange={setActiveTool} onOpenSettings={()=>setModal(true)}/><div className="btm-chartwrap"><ReplayChart apiRef={chartApi} engine={engine} activeTool={activeTool} onToolDone={()=>setActiveTool('cursor')} onOpenChartSettings={()=>setModal(true)}/><FavoriteToolsBar engine={engine} activeTool={activeTool} onToolChange={setActiveTool}/>{modal&&<TerminalSettingsDialog engine={engine} onClose={()=>setModal(false)}/>}</div></main></div>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><App/></LanguageProvider>);
