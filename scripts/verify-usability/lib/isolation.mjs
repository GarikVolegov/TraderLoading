import assert from 'node:assert/strict';
/** Destructive/manual drivers must never silently target the personal app. */
export function isolatedDatabaseUrl() {
  const raw=process.env.VERIFY_DATABASE_URL;
  assert.ok(raw,'VERIFY_DATABASE_URL must explicitly identify a disposable audit database');
  const url=new URL(raw);
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  assert.match(url.pathname,/^\/tl_audit_\d+$/);
  return raw;
}
export function assertIsolatedBrowser(base,email) {
  isolatedDatabaseUrl();
  const url=new URL(base);
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  assert.ok(['3002','5182'].includes(url.port),'Only isolated audit ports 3002 and 5182 are allowed');
  if(email)assert.match(email,/\+clerk_test@example\.com$/,'Only synthetic Clerk addresses are allowed');
  assert.match(process.env.CLERK_SECRET_KEY??'',/^sk_test_/,'Clerk Development is required');
}
