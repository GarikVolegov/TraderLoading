import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { api, connect, database, root, setAuditScenario } from '../verify-real-runtime/full/env.mjs';

// Never create fixtures in the personal database or an API pointing at another DB.
const marker = JSON.parse(readFileSync(root + '.local-logs/runtime-api-process.json', 'utf8'));
assert.equal(marker.database, database);
assert.match(database, /^tl_audit_\d+$/);
const db = await connect();
const prefix = 'reorg_' + randomUUID().replaceAll('-', '');
const actors = {};
const checks = [];
let collectionId, contentId, communityId, channelId, sourceId;
async function check(name, fn) {
  setAuditScenario(name);
  try { await fn(); checks.push({ name, status: 'passed' }); }
  catch (error) { checks.push({ name, status: 'failed', error: error.message }); }
}
try {
  for (const role of ['owner', 'proOther', 'free', 'unlocked', 'banned']) {
    const id = `${prefix}_${role}`, sid = randomBytes(32).toString('hex');
    actors[role] = { id, sid };
    await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)', [sid, { user: { id }, access_token: 'isolated' }, new Date(Date.now() + 3600000)]);
    await db.query('INSERT INTO profile(user_id,name,xp) VALUES($1,$2,$3)', [id, id, role === 'unlocked' ? 1000000 : 0]);
    if (['owner', 'proOther'].includes(role)) await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES($1,'pro','active')", [id]);
  }
  collectionId = (await db.query('INSERT INTO library_collections(title,published,required_level) VALUES($1,true,5) RETURNING id', [prefix])).rows[0].id;
  contentId = (await db.query('INSERT INTO library_contents(title,collection_id,published,required_level,body_markdown) VALUES($1,$2,true,1,$3) RETURNING id', [prefix, collectionId, `${prefix} original body`])).rows[0].id;
  communityId = (await db.query('INSERT INTO communities(name,creator_id,is_public) VALUES($1,$2,false) RETURNING id', [prefix, actors.owner.id])).rows[0].id;
  channelId = (await db.query("INSERT INTO community_channels(community_id,name,type,access_model,price_cents) VALUES($1,$2,'text','one_time',100) RETURNING id", [communityId, prefix])).rows[0].id;
  for (const role of ['free', 'banned']) await db.query('INSERT INTO community_members(community_id,user_id) VALUES($1,$2)', [communityId, actors[role].id]);
  await db.query('INSERT INTO community_bans(community_id,user_id,banned_by) VALUES($1,$2,$3)', [communityId, actors.banned.id, actors.owner.id]);

  await check('Free archive management still requires Pro', async () => {
    assert.equal((await api(actors.free.sid, '/wiki/sources')).status, 402);
    assert.equal((await api(actors.free.sid, '/wiki/sources/text', 'POST', { title: prefix, content: 'Synthetic note' })).status, 402);
  });
  await check('Collection level controls the catalog preview', async () => {
    const response = await api(actors.free.sid, '/library/contents');
    assert.equal(response.status, 200);
    const item = response.data.find(item => item.id === contentId);
    assert.equal(item.requiredLevel, 5);
    assert.equal(item.bodyMarkdown, '');
    assert.equal(item.fileUrl, null);
  });
  await check('Free cannot fetch a resource above their level', async () => {
    assert.equal((await api(actors.free.sid, `/library/contents/${contentId}`)).status, 403);
  });
  await check('Free with sufficient XP can read original editorial content', async () => {
    const response = await api(actors.unlocked.sid, `/library/contents/${contentId}`);
    assert.equal(response.status, 200);
    assert.equal(response.data.bodyMarkdown, `${prefix} original body`);
  });
  await check('Unlocked resources do not become personal copies', async () => {
    const copies = (await db.query('SELECT count(*)::int n FROM wiki_sources WHERE user_id=$1', [actors.unlocked.id])).rows[0].n;
    assert.equal(copies, 0);
  });
  await check('Editorial resources remain non-editable for unlocked readers', async () => {
    assert.equal((await api(actors.unlocked.sid, `/library/contents/${contentId}`, 'PUT', { title: 'Unauthorized' })).status, 403);
  });
  await check('Pro can create and tag a personal note', async () => {
    const response = await api(actors.owner.sid, '/wiki/sources/text', 'POST', { title: prefix, content: 'Synthetic personal note' });
    assert.equal(response.status, 202);
    sourceId = response.data.id;
    assert.ok(sourceId);
    assert.equal((await api(actors.owner.sid, `/wiki/sources/${sourceId}`, 'PATCH', { tags: ['reorganization'] })).status, 200);
  });
  await check('Another Pro account cannot edit a personal note', async () => {
    assert.equal((await api(actors.proOther.sid, `/wiki/sources/${sourceId}`, 'PATCH', { tags: ['unauthorized'] })).status, 404);
  });
  await check('Legacy checkout context requires authentication', async () => {
    assert.equal((await api(null, `/community/channels/${channelId}/context`)).status, 401);
  });
  await check('Legacy context resolves owner and current member', async () => {
    for (const role of ['owner', 'free']) {
      const response = await api(actors[role].sid, `/community/channels/${channelId}/context`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.data, { communityId, channelId });
    }
  });
  await check('Outsiders and banned members cannot resolve private context', async () => {
    for (const role of ['proOther', 'banned']) assert.equal((await api(actors[role].sid, `/community/channels/${channelId}/context`)).status, 404);
  });
  await check('Legacy context rejects malformed channel identifiers', async () => {
    for (const id of ['-1', '1.5', '1e2', '9007199254740992']) assert.equal((await api(actors.free.sid, `/community/channels/${id}/context`)).status, 400);
  });
  await check('Success query does not unlock paid channel messages', async () => {
    assert.equal((await api(actors.free.sid, `/community/channels/${channelId}/messages?unlock=success`)).status, 402);
  });
  await check('Server entitlement grants paid access after confirmation', async () => {
    await db.query("INSERT INTO community_channel_entitlements(community_id,channel_id,user_id,source) VALUES($1,$2,$3,'purchase')", [communityId, channelId, actors.free.id]);
    assert.equal((await api(actors.free.sid, `/community/channels/${channelId}/messages`)).status, 200);
  });
} finally {
  // Delete only this runner's disposable synthetic fixtures, never existing audit rows.
  if (sourceId) await api(actors.owner.sid, `/wiki/sources/${sourceId}`, 'DELETE');
  if (communityId) {
    for (const table of ['community_channel_entitlements', 'community_messages']) await db.query(`DELETE FROM ${table} WHERE channel_id=$1`, [channelId]);
    for (const table of ['community_bans', 'community_members', 'community_channels']) await db.query(`DELETE FROM ${table} WHERE community_id=$1`, [communityId]);
    await db.query('DELETE FROM communities WHERE id=$1', [communityId]);
  }
  if (contentId) await db.query('DELETE FROM library_contents WHERE id=$1', [contentId]);
  if (collectionId) await db.query('DELETE FROM library_collections WHERE id=$1', [collectionId]);
  for (const actor of Object.values(actors)) {
    await db.query('DELETE FROM sessions WHERE sid=$1', [actor.sid]);
    await db.query('DELETE FROM admin_user_subscriptions WHERE user_id=$1', [actor.id]);
    await db.query('DELETE FROM profile WHERE user_id=$1', [actor.id]);
  }
  await db.end();
}
const directory = root + 'artifacts.local/reorganization';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + '/api-permissions.json', JSON.stringify({ at: new Date().toISOString(), database, checks }, null, 2));
for (const result of checks) console.log(`${result.status}: ${result.name}${result.error ? ' — ' + result.error : ''}`);
if (checks.some(result => result.status !== 'passed')) process.exitCode = 1;
