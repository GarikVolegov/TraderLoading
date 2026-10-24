import {readFileSync,writeFileSync} from 'node:fs';
import {api,connect,root,run} from './env.mjs';
const _u=JSON.parse(readFileSync(root+'.local-logs/full-audit-users.json')),db=await connect(),results=[];
try{
 const collection=(await db.query("INSERT INTO library_collections(title,published,required_level) VALUES('Audit hidden draft',false,20) RETURNING id")).rows[0];
 const content=(await db.query("INSERT INTO library_contents(title,published,required_level,body_markdown,file_url) VALUES('Audit locked content',true,999,'PRIVATE-LOCKED-LIBRARY','https://example.invalid/audit.pdf') RETURNING id")).rows[0];
 results.push({name:'unpublished collection anonymous detail',...await api(null,'/library/collections/'+collection.id)});
 results.push({name:'locked content anonymous detail',...await api(null,'/library/contents/'+content.id)});
 results.push({name:'locked content metadata list',leaksPrivateContent:JSON.stringify((await api(null,'/library/contents')).data).includes('PRIVATE-LOCKED-LIBRARY')});
}finally{await db.end();}
writeFileSync(run.output+'/library-baseline.json',JSON.stringify(results,null,2));console.log(results.map(r=>({name:r.name,status:r.status,leaksPrivateContent:r.leaksPrivateContent})));
