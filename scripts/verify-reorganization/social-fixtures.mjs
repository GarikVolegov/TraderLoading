import assert from 'node:assert/strict';
import { randomUUID, webcrypto } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { connect, database, root } from '../verify-real-runtime/full/env.mjs';

const markerPath = root + '.local-logs/reorganization-social-fixtures.json';
const apiMarker = JSON.parse(readFileSync(root + '.local-logs/runtime-api-process.json', 'utf8'));
assert.equal(apiMarker.database, database);
assert.match(database, /^tl_audit_\d+$/);
const db = await connect();
try {
  if (process.argv[2] === 'cleanup') {
    const fixture = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.equal(fixture.database, database);
    assert.match(fixture.prefix, /^reorg_social_[a-f0-9]+$/);
    await db.query('BEGIN');
    for (const peer of fixture.peers) {
      assert.ok(peer.id.startsWith(fixture.prefix + '_'));
      await db.query('DELETE FROM chat_messages WHERE sender_id=$1 OR receiver_id=$1', [peer.id]);
      await db.query('DELETE FROM friendships WHERE user_id=$1 OR friend_id=$1', [peer.id]);
      await db.query('DELETE FROM user_public_keys WHERE user_id=$1', [peer.id]);
      await db.query('DELETE FROM profile WHERE user_id=$1', [peer.id]);
    }
    const community = await db.query('SELECT name FROM communities WHERE id=$1 AND creator_id=$2', [fixture.communityId, fixture.ownerId]);
    assert.equal(community.rows[0]?.name, fixture.prefix);
    await db.query('DELETE FROM community_messages WHERE channel_id=ANY($1::int[])', [fixture.channels]);
    await db.query('DELETE FROM community_channels WHERE community_id=$1', [fixture.communityId]);
    await db.query('DELETE FROM community_members WHERE community_id=$1', [fixture.communityId]);
    await db.query('DELETE FROM community_roles WHERE community_id=$1', [fixture.communityId]);
    await db.query('DELETE FROM communities WHERE id=$1', [fixture.communityId]);
    await db.query('COMMIT');
    unlinkSync(markerPath);
    console.log('Removed only this runner’s disposable Social fixtures.');
  } else {
    assert.equal(process.argv[2], 'prepare');
    assert.equal(existsSync(markerPath), false, 'Clean up existing fixtures first');
    const ownerId = process.argv[3];
    assert.ok(ownerId?.startsWith('user_'), 'Supply the synthetic Clerk account ID');
    const owner = await db.query('SELECT p.name,k.public_key_jwk FROM profile p JOIN user_public_keys k ON k.user_id=p.user_id WHERE p.user_id=$1', [ownerId]);
    assert.equal(owner.rows.length, 1, 'Requires a test account with initialized chat keys');
    const ownerKey = await webcrypto.subtle.importKey('jwk', JSON.parse(owner.rows[0].public_key_jwk), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const prefix = 'reorg_social_' + randomUUID().replaceAll('-', '');
    const fixture = { database, prefix, ownerId, peers: [], communityId: null, channels: [] };
    await db.query('BEGIN');
    for (const suffix of ['A', 'B']) {
      const id = prefix + '_' + suffix, name = 'Verifica conversazione ' + suffix;
      const pair = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
      await db.query('INSERT INTO profile(user_id,name) VALUES($1,$2)', [id, name]);
      await db.query("INSERT INTO friendships(user_id,friend_id,status) VALUES($1,$2,'accepted')", [ownerId, id]);
      await db.query('INSERT INTO user_public_keys(user_id,public_key_jwk) VALUES($1,$2)', [id, JSON.stringify(publicKey)]);
      const bits = await webcrypto.subtle.deriveBits({ name: 'ECDH', public: ownerKey }, pair.privateKey, 256);
      const hkdf = await webcrypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
      const key = await webcrypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('traderloading-e2ee-chat') }, hkdf, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'text', content: 'Messaggio di verifica ' + suffix }));
      const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
      await db.query('INSERT INTO chat_messages(sender_id,receiver_id,ciphertext,iv) VALUES($1,$2,$3,$4)', [id, ownerId, Buffer.from(ciphertext).toString('base64'), Buffer.from(iv).toString('base64')]);
      fixture.peers.push({ id, name });
    }
    fixture.communityId = (await db.query('INSERT INTO communities(name,creator_id,is_public) VALUES($1,$2,false) RETURNING id', [prefix, ownerId])).rows[0].id;
    await db.query("INSERT INTO community_members(community_id,user_id,role) VALUES($1,$2,'owner')", [fixture.communityId, ownerId]);
    for (const suffix of ['A', 'B']) {
      const channel = (await db.query("INSERT INTO community_channels(community_id,name,type,access_model) VALUES($1,$2,'text','free') RETURNING id", [fixture.communityId, 'verifica-' + suffix.toLowerCase()])).rows[0].id;
      fixture.channels.push(channel);
    }
    writeFileSync(markerPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
    await db.query('COMMIT');
    console.log(JSON.stringify(fixture, null, 2));
  }
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally { await db.end(); }
