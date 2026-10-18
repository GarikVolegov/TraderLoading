import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {root} from './env.mjs';

/** No contents or environment values are emitted; generated/build outputs are excluded. */
export function fingerprintSources(){
 const files=new Set(['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json','eslint.config.mjs'].filter(p=>existsSync(root+p)));
 function visit(dir){for(const e of readdirSync(root+dir,{withFileTypes:true})){
  const path=dir+'/'+e.name;
  if(e.isDirectory()){if(!['node_modules','dist','generated','public','.cache','.local','uploads'].includes(e.name))visit(path);}
  else if(e.isFile()&&/\.(?:[cm]?[jt]sx?|css|json|ya?ml)$/.test(e.name)&&!e.name.endsWith('.tsbuildinfo'))files.add(path);
 }}
 for(const dir of ['artifacts','lib','scripts'])visit(dir);
 const hashes=Object.fromEntries([...files].sort().map(path=>[path,createHash('sha256').update(readFileSync(root+path)).digest('hex')]));
 return{sha256:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),fileCount:files.size,files:hashes};
}
