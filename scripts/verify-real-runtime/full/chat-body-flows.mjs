import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { api, connect, run, auditExecutionId as executionId, setAuditScenario } from './env.mjs';

const db = await connect();
const label = process.argv[2] || 'baseline';
const actor = { id: `audit_chat_body_${Date.now()}`, sid: randomBytes(32).toString('hex') };
const report = { runId: run.runId, executionId, label, checks: [], observations: [], limits: ['Real isolated production API with a fresh synthetic session; only invalid requests, no message delivery or provider calls'] };
const scenario = 'Missing message bodies are rejected before persistence';
setAuditScenario(scenario);
try {
  await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)', [actor.id, actor.id]);
  await db.query('INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)', [actor.sid, { user: { id: actor.id } }, new Date(Date.now() + 3600000)]);
  const counts = async () => (await db.query('SELECT (SELECT count(*)::int FROM global_chat_messages WHERE user_id=$1) global_count, (SELECT count(*)::int FROM chat_messages WHERE sender_id=$1) private_count', [actor.id])).rows[0];
  const before = await counts();
  for (const path of ['/chat/global', '/chat/messages']) {
    for (const [bodyName, body] of [['absent', undefined], ['empty-object', {}], ['array', []]]) {
      const response = await api(actor.sid, path, 'POST', body);
      report.observations.push({ path, body: bodyName, status: response.status, expected: 400 });
    }
  }
  try {
    assert.ok(report.observations.every(observation => observation.status === 400), JSON.stringify(report.observations));
    assert.deepEqual(await counts(), before, 'Invalid requests must not write messages');
    report.checks.push({ name: scenario, status: 'passed' });
  } catch (error) {
    report.checks.push({ name: scenario, status: 'failed', error: error.message });
    process.exitCode = 1;
  }
} finally {
  await db.query('DELETE FROM sessions WHERE sid=$1', [actor.sid]);
  await db.query('DELETE FROM profile WHERE user_id=$1', [actor.id]);
  await db.end();
  writeFileSync(`${run.output}/chat-body-${label}.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ executionId, checks: report.checks, observations: report.observations }, null, 2));
