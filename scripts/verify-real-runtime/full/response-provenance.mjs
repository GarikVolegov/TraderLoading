// Browser assertions can exercise a genuine API or a local fixture. Tag only
// locally fulfilled responses, so API coverage never confuses those two.
const header='x-traderloading-audit-provenance';
export function responseProvenance(response){return response.headers()[header]||'api';}
export function installResponseProvenance(page){
 const register=page.route.bind(page);
 page.route=(url,handler,options)=>register(url,async(route,request)=>{
  const fulfill=route.fulfill.bind(route);
  route.fulfill=args=>{
   const forwarded=Boolean(args.response)&&!['body','json','path','status'].some(k=>k in args);
   const headers={...(args.response?.headers()||{}),...args.headers,[header]:forwarded?'forwarded-api':'simulated'};
   return fulfill({...args,headers});
  };
  return handler(route,request);
 },options);
}
