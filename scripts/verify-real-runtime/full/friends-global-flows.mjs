import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { api, connect, run, auditExecutionId as executionId, setAuditScenario } from './env.mjs';

const label = process.argv[2] || 'baseline';
const db = await connect();
const prefix = `audit_friends_${Date.now()}`;
const actors = [];
const checks = [];
const details = {};
const report = { runId: run.runId, executionId, label, mode: 'Real isolated production API and database; synthetic session identities only', checks, details, limits: ['API proof only; no browser interaction, delivery to real people or microphone/network calls', 'Global chat is shared among authenticated synthetic actors by design', 'Europe/Rome activity boundary is covered separately by deterministic helper regression'] };
const flush = () => writeFileSync(`${run.output}/friends-global-${label}.json`, JSON.stringify(report, null, 2));
const request = async (actor, path, method = 'GET', body, status = 200) => {
  const response = await api(actor?.sid, path, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${response.status}, expected ${status}`);
  return response.data;
};
const pairCount = async (a, b) => Number((await db.query('SELECT count(*)::int count FROM friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)', [a.id, b.id])).rows[0].count);
const clearRelations = () => db.query('DELETE FROM friendships WHERE user_id=ANY($1::text[]) OR friend_id=ANY($1::text[])', [actors.map(actor => actor.id)]);
const check = async (name, fn) => {
  setAuditScenario(name);
  try { await fn(); checks.push({ name, status: 'passed' }); console.log('PASS', name); }
  catch (error) { checks.push({ name, status: 'failed', error: error.message }); console.log('FAIL', name, error.message.slice(0, 400)); }
  finally { await clearRelations(); flush(); }
};
try {
  for (const name of ['a', 'b', 'outsider']) {
    const actor = { id: `${prefix}_${name}`, sid: randomBytes(32).toString('hex'), name: `${prefix} ${name}` };
    actors.push(actor);
    await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)', [actor.id, actor.name]);
    await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)', [actor.sid, { user: { id: actor.id } }, new Date(Date.now() + 86400000)]);
  }
  const [a, b, c] = actors;
  await check('FRI01 Friends and global chat require authentication', async () => {
    for (const path of ['/friends', '/friends/search?q=audit', '/friends/requests', '/chat/global']) await request(null, path, 'GET', undefined, 401);
    await request(null, '/friends/request', 'POST', { friendUserId: b.id }, 401);
    await request(null, '/friends/requests/1', 'PATCH', { action: 'accept' }, 401);
    await request(null, '/friends/1', 'DELETE', undefined, 401);
    await request(null, '/chat/global', 'POST', { message: 'Synthetic unauthorized message' }, 401);
  });
  await check('FRI02 Search relations request acceptance and owner removal persist', async () => {
    assert.deepEqual(await request(a, '/friends/search?q=x'), []);
    const before = await request(a, `/friends/search?q=${encodeURIComponent(prefix)}`);
    assert.equal(before.some(user => user.userId === a.id), false);
    assert.equal(before.find(user => user.userId === b.id)?.relationshipStatus, 'none');
    const made = await request(a, '/friends/request', 'POST', { friendUserId: b.id }, 201);
    assert.equal(made.status, 'pending');
    assert.equal(await pairCount(a, b), 1);
    assert.equal((await request(a, `/friends/search?q=${encodeURIComponent(prefix)}`)).find(user => user.userId === b.id).relationshipStatus, 'pending_sent');
    assert.equal((await request(b, `/friends/search?q=${encodeURIComponent(prefix)}`)).find(user => user.userId === a.id).relationshipStatus, 'pending_received');
    const incoming = await request(b, '/friends/requests');
    assert.equal(incoming.find(item => item.id === made.id)?.senderName, a.name);
    assert.equal((await request(c, '/friends/requests')).length, 0);
    await request(a, `/friends/requests/${made.id}`, 'PATCH', { action: 'accept' }, 404);
    await request(c, `/friends/requests/${made.id}`, 'PATCH', { action: 'accept' }, 404);
    const accepted = await request(b, `/friends/requests/${made.id}`, 'PATCH', { action: 'accept' });
    assert.equal(accepted.status, 'accepted');
    assert.equal((await request(b, `/friends/requests/${made.id}`, 'PATCH', { action: 'accept' })).status, 'accepted');
    assert.equal((await db.query('SELECT status FROM friendships WHERE id=$1', [made.id])).rows[0].status, 'accepted');
    for (const [actor, peer] of [[a, b], [b, a]]) assert.equal((await request(actor, '/friends')).filter(item => item.friendUserId === peer.id).length, 1);
    await request(c, `/friends/${made.id}`, 'DELETE');
    assert.equal(await pairCount(a, b), 1, 'A foreign idempotent DELETE must not remove the relationship');
    await request(a, `/friends/${made.id}`, 'DELETE');
    assert.equal(await pairCount(a, b), 0);
    assert.deepEqual(await request(b, '/friends'), []);
  });
  await check('FRI03 Reject removes only the recipient pending request', async () => {
    const made = await request(a, '/friends/request', 'POST', { friendUserId: b.id }, 201);
    await request(b, `/friends/requests/${made.id}`, 'PATCH', { action: 'invalid' }, 400);
    await request(b, `/friends/requests/${made.id}`, 'PATCH', undefined, 400);
    await request(c, `/friends/requests/${made.id}`, 'PATCH', { action: 'reject' }, 404);
    assert.equal(await pairCount(a, b), 1);
    await request(b, `/friends/requests/${made.id}`, 'PATCH', { action: 'reject' });
    assert.equal(await pairCount(a, b), 0);
    assert.deepEqual(await request(b, '/friends/requests'), []);
  });
  await check('FRI04 Missing invalid and self targets cannot create ghost friendships', async () => {
    const before = (await db.query('SELECT count(*)::int count FROM friendships WHERE user_id=$1', [a.id])).rows[0].count;
    await request(a, '/friends/request', 'POST', undefined, 400);
    for (const friendUserId of [a.id, '', {}, []]) await request(a, '/friends/request', 'POST', { friendUserId }, 400);
    const missing = await api(a.sid, '/friends/request', 'POST', { friendUserId: `${prefix}_missing` });
    details.missingTarget = { status: missing.status, createdRelationship: Boolean(missing.data?.id) };
    assert.equal(missing.status, 404);
    assert.equal((await db.query('SELECT count(*)::int count FROM friendships WHERE user_id=$1', [a.id])).rows[0].count, before);
  });
  await check('FRI05 IDs must be strict positive integers on friendship writes', async () => {
    const made = await request(a, '/friends/request', 'POST', { friendUserId: b.id }, 201);
    for (const invalid of ['abc', '0', '-1', '1.5', `${made.id}suffix`, '2147483648']) {
      const patch = await api(b.sid, `/friends/requests/${invalid}`, 'PATCH', { action: 'accept' });
      const deletion = await api(a.sid, `/friends/${invalid}`, 'DELETE');
      (details.invalidIds ??= []).push({ invalid, patch: patch.status, deletion: deletion.status });
    }
    assert.ok(details.invalidIds.every(item => item.patch === 400 && item.deletion === 400), JSON.stringify(details.invalidIds));
    assert.equal((await db.query('SELECT status FROM friendships WHERE id=$1', [made.id])).rows[0]?.status, 'pending');
  });
  await check('FRI06 Concurrent identical requests return one relation and conflicts', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => api(a.sid, '/friends/request', 'POST', { friendUserId: b.id })));
    details.concurrentIdentical = { statuses: responses.map(response => response.status), rows: await pairCount(a, b) };
    assert.equal(responses.filter(response => response.status === 201).length, 1);
    assert.ok(responses.every(response => [201, 409].includes(response.status)), JSON.stringify(details.concurrentIdentical));
    assert.equal(details.concurrentIdentical.rows, 1);
  });
  await check('FRI07 Reciprocal simultaneous requests create one undirected friendship', async () => {
    const responses = await Promise.all([api(a.sid, '/friends/request', 'POST', { friendUserId: b.id }), api(b.sid, '/friends/request', 'POST', { friendUserId: a.id })]);
    details.concurrentReciprocal = { statuses: responses.map(response => response.status), rows: await pairCount(a, b) };
    assert.equal(responses.filter(response => response.status === 201).length, 1);
    assert.ok(responses.every(response => [201, 409].includes(response.status)), JSON.stringify(details.concurrentReciprocal));
    assert.equal(details.concurrentReciprocal.rows, 1);
  });
  await check('FRI08 Concurrent accept reject and removal keep responses and persistence coherent', async () => {
    for (let repetition = 0; repetition < 8; repetition++) {
      const made = await request(a, '/friends/request', 'POST', { friendUserId: b.id }, 201);
      const [accepted, rejected] = await Promise.all([
        api(b.sid, `/friends/requests/${made.id}`, 'PATCH', { action: 'accept' }),
        api(b.sid, `/friends/requests/${made.id}`, 'PATCH', { action: 'reject' }),
      ]);
      assert.ok([200, 404].includes(accepted.status));
      assert.ok([200, 404].includes(rejected.status));
      if (accepted.status === 200) assert.equal(accepted.data?.status, 'accepted', 'A successful acceptance must return the persisted row');
      if (rejected.status === 200) assert.equal(rejected.data?.success, true);
      assert.equal(await pairCount(a, b), 0);
    }
  });
  await check('GLB01 Global chat trims validates and persists only the authenticated author', async () => {
    for (const message of ['', ' ', [], {}, 'x'.repeat(1001)]) await request(a, '/chat/global', 'POST', { message }, 400);
    const text = `Synthetic global ${prefix}`;
    const made = await request(a, '/chat/global', 'POST', { message: `  ${text}  `, userId: c.id, userName: 'Spoofed name' }, 201);
    assert.equal(made.userId, a.id); assert.equal(made.userName, a.name); assert.equal(made.message, text);
    const stored = (await db.query('SELECT user_id,user_name,message FROM global_chat_messages WHERE id=$1', [made.id])).rows[0];
    assert.deepEqual(stored, { user_id: a.id, user_name: a.name, message: text });
    assert.equal((await request(b, '/chat/global')).messages.find(message => message.id === made.id)?.message, text);
  });
  await check('GLB02 Global chat cursor pages are ordered without overlaps', async () => {
    const ids = [];
    for (let index = 0; index < 65; index++) ids.push((await request(index % 2 ? a : b, '/chat/global', 'POST', { message: `${prefix} pagination ${index}` }, 201)).id);
    const first = await request(c, '/chat/global');
    assert.equal(first.messages.length, 60);
    assert.deepEqual(first.messages.map(message => message.id), ids.slice(-60));
    assert.equal(first.nextCursor, first.messages[0].id);
    const second = await request(c, `/chat/global?cursor=${first.nextCursor}`);
    assert.equal(second.messages.some(message => first.messages.some(newer => newer.id === message.id)), false);
    assert.deepEqual(second.messages.filter(message => ids.includes(message.id)).map(message => message.id), ids.slice(0, 5));
    details.globalCursor = [];
    for (const cursor of ['abc', `${first.nextCursor}suffix`, '0', '-1', '1.5', '2147483648']) {
      const invalid = await api(c.sid, `/chat/global?cursor=${cursor}`);
      details.globalCursor.push({ cursor, status: invalid.status });
    }
    assert.ok(details.globalCursor.every(item => item.status === 400), JSON.stringify(details.globalCursor));
  });
} finally {
  report.finishedAt = new Date().toISOString();
  flush();
  await db.end();
}
if (checks.some(check => check.status === 'failed')) process.exitCode = 1;
