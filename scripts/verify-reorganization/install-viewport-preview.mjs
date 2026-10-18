import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const marker = JSON.parse(readFileSync(root + '.local-logs/runtime-api-process.json', 'utf8'));
assert.match(marker.database, /^tl_audit_\d+$/);
const health = await fetch('http://127.0.0.1:3002/api/healthz');
assert.equal(health.status, 200, 'Requires the isolated audit API on port 3002');
const links = [
 ['Mercati', '/?vista=mercati'], ['Notizie', '/?vista=notizie'], ['Strumenti', '/?vista=strumenti'],
 ['Panoramica', '/journal?t=panoramica'], ['Trade', '/journal?t=trades'], ['Piano', '/journal?t=piano'], ['Revisione', '/journal?t=revisione'],
 ['Backtest', '/backtest'], ['Archivio', '/wiki'], ['Conversazioni', '/chat'], ['Attività', '/chat?t=social'], ['Competizioni', '/chat?t=competizioni'],
 ['Profilo', '/settings?section=profilo'], ['Trading', '/settings?section=pairs'], ['Esperienza', '/settings?section=aspetto'], ['Abbonamento', '/settings?section=abbonamento'], ['Aiuto', '/settings?section=aiuto'],
];
const socialFixturePath = root + '.local-logs/reorganization-social-fixtures.json';
if (existsSync(socialFixturePath)) {
 const fixture = JSON.parse(readFileSync(socialFixturePath, 'utf8'));
 assert.equal(fixture.database, marker.database);
 for (const [index, peer] of fixture.peers.entries()) links.push([`DM ${index + 1}`, `/chat?t=conversazioni&peer=${encodeURIComponent(peer.id)}`]);
 links.push(['Community test', `/chat?t=conversazioni&community=${fixture.communityId}`]);
 for (const [index, channel] of fixture.channels.entries()) links.push([`Canale ${index + 1}`, `/chat?t=conversazioni&community=${fixture.communityId}&channel=${channel}`]);
}
const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for (const [kind, width, height] of [['mobile',375,500], ['desktop',1100,760]]) {
 const html = `<!doctype html><html lang="it"><meta charset="utf-8"><title>Verifica TraderLoading ${width} px</title><style>body{margin:0;background:#080d13;color:#eef3f5;font:14px system-ui}header{padding:12px;position:sticky;top:0;background:#101720;z-index:1}h1{font-size:16px;margin:0 0 8px}nav{display:flex;gap:8px;flex-wrap:wrap}a{color:#8dd5bc;padding:8px}main{padding:16px;display:flex;justify-content:center}iframe{width:${width}px;height:${height}px;flex-shrink:0;border:1px solid #34404a;border-radius:8px;background:#080d13}</style><header><h1>Verifica locale — viewport ${width} × ${height} CSS px</h1><nav>${links.map(([label,url])=>`<a href="${escape(url)}" target="workspace">${escape(label)}</a>`).join('')}<a href="/reorganization-preview-${kind === 'mobile' ? 'desktop' : 'mobile'}.html">${kind === 'mobile' ? 'Desktop 1100 px' : 'Mobile 375 px'}</a></nav></header><main><iframe name="workspace" title="App autenticata a ${width} px" src="/chat"></iframe></main></html>`;
 writeFileSync(root + `artifacts/trader-dashboard/dist/public/reorganization-preview-${kind}.html`, html);
}
console.log('Installed two temporary same-origin preview pages in ignored build output. Rebuild removes them.');
