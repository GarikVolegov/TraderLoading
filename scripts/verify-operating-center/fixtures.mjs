export function createFixtures() {
  const now = new Date().toISOString();
  const state = {
    settings: { id: 1, language: 'it', selectedPairs: ['EURUSD'], backgroundType: 'default', backgroundDarkness: 60, fontChoice: 'inter', lotDivisor: 11, tradingSessions: [], calendarCurrencies: ['EUR','USD'], calendarImpacts: ['High','Medium'], preMacroMinutes: 15, maxDailyLoss: 100, onboardingTutorialCompletedAt: now, alarmConfigs: {} },
    contextMode: 'available', saveFails: false, guardFails: false, sentiment: 'available', volatility: 'available',
    checklist: [{ id: 1, text: 'Attendo il mio setup', order: 0 }], journal: [],
    requests: [], unknown: new Set(),
  };
  const edge = {
    generatedAt: now,
    overall: { closedTrades: 3, tradesWithR: 3, winRate: 0, expectancyR: -1, avgWinR: null, avgLossR: -1, profitFactor: 0, netProfit: -120, avgWin: null, avgLoss: -40 },
    breakdowns: { bySymbol: [], byDirection: [], bySession: [], byDayOfWeek: [] },
    highlights: { bestSlice: null, worstSlice: null, postLoss: null },
    discipline: { stopDiscipline: null, holdTime: null, overtrading: null, drawdown: null },
    guard: { evaluatedAt: now, tradingDay: now.slice(0,10), todayTrades: 3, todayNetR: -3, alerts: [{ type: 'daily_loss_cash', severity: 'danger', value: -120, threshold: 100 }] },
    stats: { winRateCI: null, kelly: null, maxDrawdown: 120, rHistogram: [] },
  };
  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.slice(4);
    const method = req.method();
    state.requests.push({ path, method, search: url.search });
    let status = 200, data;
    const body = () => req.postDataJSON() ?? {};
    if (path === '/settings') {
      if (method === 'PUT') {
        if (state.saveFails && body().selectedPairs) { status = 500; data = { error: 'Simulated save failure' }; }
        else Object.assign(state.settings, body());
      }
      data ??= state.settings;
    } else if (path === '/profile') data = { id: 1, name: 'Audit Locale', avatarUrl: '/api/uploads/avatars/missing.png', xp: 0, level: 1, xpToNextLevel: 100, streak: 0, levelName: 'Inizio', totalTrades: 0 };
    else if (path === '/uploads/avatars/missing.png') {status=404;data={error:'Missing uploaded file'};}
    else if (path === '/billing/me') data = { pro: true, plan: 'pro', status: 'active', checkoutAvailable: false };
    else if (path === '/journal/edge') { status = state.guardFails ? 503 : 200; data = state.guardFails ? {error:'Simulated outage'} : edge; }
    else if (path === '/tools/market-context') {
      const pair=url.searchParams.get('pair');
      if(!['EURUSD','GBPUSD','BTCUSD'].includes(pair)){status=400;data={error:'Unsupported pair'};}
      else if(state.contextMode==='error'){status=503;data={error:'Simulated outage'};}
      else {
        const mode=state.contextMode, negative=pair==='GBPUSD', stamp=new Date(Date.now()-(mode==='old'?300000:0)).toISOString();
        const scores=negative?[-55,-20,-10,-36]:[55,60,20,49];
        const components=['price','news','retail','cot'].map((id,i)=>({id,weight:[35,30,15,20][i],score:mode==='insufficient'||mode==='warming'||(mode==='partial'&&id==='news')?null:scores[i],status:mode==='insufficient'||mode==='warming'||(mode==='partial'&&id==='news')?'unavailable':'available',reason:mode==='insufficient'||mode==='warming'||(mode==='partial'&&id==='news')?'source_unavailable':null,source:['audit-candles','NewsHub','myfxbook','CFTC'][i],fetchedAt:stamp,observedAt:id==='retail'?null:stamp}));
        const cotReports=[{market:'EURO FX - CME',currency:'EUR',date:stamp.slice(0,10),nonCommLong:745,nonCommShort:255,nonCommNet:490,commLong:200,commShort:400,commNet:-200,retailLong:100,retailShort:50,retailNet:50,history:[{date:stamp.slice(0,10),nonCommNet:490,commNet:-200}],source:'CFTC',fetchedAt:stamp,publishedAt:null,status:'available'}];
        data={refreshing:['warming','collecting-partial'].includes(mode),relatedNews:mode==='warming'?[]:[{title:'Fed may cut rates',url:'https://example.com/audit-scenario',source:'Audit',publishedAt:stamp},{title:'Euro rises after economic release',url:'https://example.com/audit-news',source:'Audit',publishedAt:stamp}],cotReports:mode==='insufficient'?[]:cotReports,priceHistory:mode==='insufficient'?[]:Array.from({length:28},(_,i)=>({time:new Date(Date.now()-(27-i)*86400000).toISOString(),close:1.1+Math.sin(i/4)*.01+i*.0002})),ranges:[5,22,66,132,252].map(days=>({days,samples:days,value:.008})),pair,version:'context-v2-experimental',generatedAt:stamp,tradingDay:stamp.slice(0,10),status:['partial','insufficient','warming'].includes(mode)?mode:'available',score:['insufficient','warming'].includes(mode)?null:mode==='zero'?0:mode==='partial'?46:negative?-34:50,coverage:['insufficient','warming'].includes(mode)?0:mode==='partial'?70:100,disagreement:mode==='conflict',components,news:[{title:'Euro rises after economic release',url:'https://example.com/audit-news',source:'Audit',publishedAt:stamp,direction:1,theme:'macro'}],newsConsidered:2,calendarStatus:'available',events:[],rangePercent:mode==='insufficient'?null:0,price:mode==='insufficient'?null:1.1,priceChangePct:mode==='insufficient'?null:0};
        if(mode==='warming'){Object.assign(data,{news:[],calendarStatus:'unavailable',price:null,priceChangePct:null,priceHistory:[],cotReports:[],ranges:[],rangePercent:null});}
        if(mode==='collecting-partial'){Object.assign(data,{status:'partial',score:46,coverage:70});Object.assign(data.components.find(c=>c.id==='news'),{status:'unavailable',score:null,reason:'no_direction'});}
      }
    }
    else if (path === '/tools/sentiment') data = { status: state.sentiment, source: 'myfxbook', observedAt: null, fetchedAt: state.sentiment === 'unavailable' ? null : now, reason: state.sentiment === 'unavailable' ? 'provider_unavailable' : null, fallback: false, hasCredentials: true, live: state.sentiment === 'available', symbols: state.sentiment === 'unavailable' ? [] : [{name:'EURUSD',longPercentage:60,shortPercentage:40,longPositions:6,shortPositions:4}] };
    else if (path === '/tools/volatility') {
      status = state.volatility === 'unavailable' ? 503 : 200;
      data = status === 503 ? {error:'Simulated warming',status:'unavailable'} : {pair:url.searchParams.get('pair'),todayPips:state.volatility === 'invalid' ? null : 0,y1:100,status:state.volatility === 'stale' ? 'stale' : 'available',source:'audit-candles',fetchedAt:now,observedAt:now.slice(0,10)+'T00:00:00Z'};
    } else if (path === '/tools/watchlist') data = {items:(url.searchParams.get('pairs')??'').split(',').map(pair=>({pair,price:1.1,changePct:0,spark:[1,1.1],time:Date.now()/1000,supported:true}))};
    else if (path === '/tools/cot') data = {reports:[],cached:false};
    else if (path === '/tools/macro-news') data = {articles:[],sentiment:'neutrale',summary:'Fixture di audit',fetchedAt:now};
    else if (path === '/news') data = {articles:[],fetchedAt:now,source:'rss',providerStatuses:[],watchedPairs:state.settings.selectedPairs,totalCount:0,nextCursor:null};
    else if (path === '/checklist') {
      if (method === 'POST') state.checklist.push({id:Date.now(),...body()});
      data = state.checklist;
    } else if (path === '/journal') {
      if (method === 'POST') { const entry={id:Date.now(),...body(),images:[],createdAt:now,updatedAt:now};state.journal.push(entry);data=entry; }
      else data=state.journal;
    } else if (/^\/journal\/\d+$/.test(path)) { data = state.journal.find(e=>e.id===Number(path.split('/').at(-1))); if(method==='PUT' && data) Object.assign(data,body()); }
    else if (path === '/chat/unread') data={count:0};
    else if (path === '/reviews/prompt-status') data={eligible:false, shouldPrompt:false};
    else if (path === '/push/preferences') data={};
    else if (path === '/quotes/random') data={id:1,text:'Attendi il tuo setup.',author:'Audit'};
    else if (path === '/brokers/profiles') data={profiles:[],activeProfileId:null};
    else if (path === '/friends' || path === '/journal/tags') data=[];
    else if (path === '/admin/status') data={isAdmin:false};
    else if (path === '/news/preferences') data={keywords:[],profile:''};
    else if (path === '/news/feedback') data=[];
    else if (path === '/social/notifications/unread') data={count:0};
    else if (['/missions','/milestones','/routines','/ideas','/goals','/calendar','/calendar/events','/quotes','/backtest','/library','/checkins'].includes(path)) data=[];
    else { state.unknown.add(path); status=503;data={error:'Unavailable in isolated audit fixture'}; }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data ?? null)});
  }
  return {state,handle};
}
