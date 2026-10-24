import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";

assert.equal(
  new URL(process.env.DATABASE_URL!).port,
  "55449",
  "Run only against the isolated launch test cluster",
);
delete process.env.CLERK_SECRET_KEY;
process.env.LIMEN_OWNER_USER_ID = "owner";
process.env.ADMIN_BOOTSTRAP_USER_IDS = "owner,staff";
process.env.CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
process.env.CLOUDFLARE_STREAM_API_TOKEN = "test-only";
process.env.CLOUDFLARE_STREAM_CUSTOMER_HOST = "customer-test.cloudflarestream.com";
process.env.RESEND_API_KEY = "re_test_only";
const {
  db,
  pool,
  usersTable,
  academyVideosTable,
  academySubscriptionsTable,
  candidateApplicationsTable,
  launchEmailsTable,
  schoolRequestsTable,
  adminUserSubscriptionsTable,
} = await import("../../../lib/db/src/index.js");
const { eq } = await import("drizzle-orm");
const { createCandidate, admitCandidate } = await import("../src/services/launchApplications.js");
const { queueLaunchWelcome, dispatchLaunchEmails } =
  await import("../src/services/email/launchEmails.js");
const { createAcademyLesson, updateAcademyLesson, saveAcademyProgress } =
  await import("../src/services/academy.js");
const { hasAcademyAccess } = await import("../src/services/academyBilling.js");
const { isLimenOwner } = await import("../src/lib/adminAuth.js");
const { createAcademyRouter } = await import("../src/routes/academy.js");
const { default: launchRouter } = await import("../src/routes/launch.js");
const { classifyApiError } = await import("../src/lib/apiError.js");
const { streamVideoState } = await import("../src/services/academyStream.js");
const realFetch = globalThis.fetch;
let providerState = "ready";
let emailFailure = false;
const emailKeys: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  if (url.hostname === "api.cloudflare.com") {
    if (url.pathname.endsWith("/token"))
      return Response.json({ result: { token: "signed-test-token" } });
    if (url.searchParams.has("direct_user"))
      return new Response(null, {
        status: 201,
        headers: {
          Location: `https://upload.videodelivery.net/${"a".repeat(32)}`,
          "stream-media-id": "a".repeat(32),
        },
      });
    return Response.json({
      result: {
        readyToStream: providerState === "ready",
        requireSignedURLs: true,
        status: { state: providerState },
      },
    });
  }
  if (url.hostname === "api.resend.com") {
    emailKeys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    return emailFailure
      ? Response.json({ message: "temporary test outage" }, { status: 500 })
      : Response.json({ id: randomUUID() });
  }
  assert.equal(url.hostname, "127.0.0.1", "Unexpected external network request");
  return realFetch(input, init);
}) as typeof fetch;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const id = req.header("x-user");
  if (id) req.user = { id, email: null, firstName: null, lastName: null, profileImageUrl: null };
  next();
});
app.use("/api", launchRouter, createAcademyRouter());
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const c = classifyApiError(err);
    res.status(c.status).json(c.body);
  },
);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const request = (path: string, user?: string, method = "GET", body?: unknown) =>
  fetch(`http://127.0.0.1:${address.port}/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-user": user } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
try {
  await db.insert(usersTable).values([
    { id: "owner", email: "owner@example.test" },
    { id: "free", email: "free@example.test" },
    { id: "paid", email: "paid@example.test" },
    { id: "staff", email: "staff@example.test" },
  ]);
  assert.equal(await isLimenOwner("staff"), false);
  assert.equal(await isLimenOwner("owner"), true);
  await Promise.all([
    queueLaunchWelcome("free"),
    queueLaunchWelcome("free"),
    queueLaunchWelcome("free"),
  ]);
  assert.equal(
    (await db.select().from(launchEmailsTable).where(eq(launchEmailsTable.kind, "welcome"))).length,
    1,
  );
  const key = randomUUID();
  const input = {
    requestKey: key,
    name: "Test Trader",
    email: "free@example.test",
    contactType: "telegram",
    contactHandle: "@test",
  };
  const [one, two] = await Promise.all([
    createCandidate(input, "free"),
    createCandidate(input, "free"),
  ]);
  assert.equal(one.candidateCode, two.candidateCode);
  const [application] = await db
    .select()
    .from(candidateApplicationsTable)
    .where(eq(candidateApplicationsTable.requestKey, key));
  await admitCandidate(application.id, "owner", "test");
  assert.equal(await hasAcademyAccess("free"), false, "admission grants no paid access");
  assert.equal(
    (await db.select().from(adminUserSubscriptionsTable)).length,
    0,
    "no manual access override",
  );
  await db
    .insert(academyVideosTable)
    .values({ id: "a".repeat(32), ownerId: "owner", state: "ready" });
  const free = await createAcademyLesson("owner", {
    title: "Free lesson",
    moduleId: "preparazione",
    streamVideoId: "a".repeat(32),
    accessLevel: "free",
    published: true,
  });
  const paid = await createAcademyLesson("owner", {
    title: "Paid lesson",
    moduleId: "scalp",
    streamVideoId: "a".repeat(32),
    published: true,
  });
  assert.equal((await request(`academy/lessons/${free.id}`)).status, 401);
  assert.equal((await request(`academy/lessons/${free.id}`, "free")).status, 200);
  assert.equal((await request(`academy/lessons/${paid.id}`, "free")).status, 403);
  for (const user of [undefined, "free", "staff"])
    assert.equal((await request("academy/teacher/lessons", user)).status, user ? 403 : 401);
  assert.equal((await request("academy/teacher/lessons", "owner")).status, 200);
  assert.equal(
    (await request("academy/videos/upload", "staff", "POST", { size: 100 })).status,
    403,
  );
  assert.equal((await request(`academy/lessons/${free.id}/playback`, "free")).status, 200);
  assert.equal((await request(`academy/lessons/${paid.id}/playback`, "free")).status, 403);
  const catalog = (await (await request("academy/catalog", "free")).json()) as {
    lessons: Record<string, unknown>[];
  };
  assert.ok(catalog.lessons.every((l) => !("streamVideoId" in l) && !("bodyMarkdown" in l)));
  await db
    .insert(academySubscriptionsTable)
    .values({ userId: "paid", status: "active", paidThrough: new Date(Date.now() + 86400000) });
  assert.equal((await request(`academy/lessons/${paid.id}/playback`, "paid")).status, 200);
  await saveAcademyProgress("paid", paid.id, { exerciseResponse: "First answer", submit: true });
  await saveAcademyProgress("paid", paid.id, { exerciseResponse: "Edited answer" });
  await assert.rejects(
    () => saveAcademyProgress("paid", free.id, { exerciseResponse: "Second answer", submit: true }),
    /questa settimana/,
  );
  await db
    .update(academySubscriptionsTable)
    .set({ paymentRevoked: true })
    .where(eq(academySubscriptionsTable.userId, "paid"));
  assert.equal((await request(`academy/lessons/${paid.id}/playback`, "paid")).status, 403);
  providerState = "processing";
  await assert.rejects(
    () => updateAcademyLesson(paid.id, { streamVideoId: "a".repeat(32) }),
    /Attendi/,
  );
  providerState = "error";
  assert.equal((await streamVideoState("a".repeat(32))).state, "error");
  providerState = "ready";
  const school = {
    requestKey: randomUUID(),
    school: "Test School",
    name: "Teacher",
    email: "school@example.test",
    currentStudents: 100,
    monthlyEntrants: 10,
    needs: "Private training workspace",
  };
  assert.equal((await request("school-requests", undefined, "POST", school)).status, 201);
  assert.equal((await request("school-requests", undefined, "POST", school)).status, 201);
  assert.equal((await db.select().from(schoolRequestsTable)).length, 1);
  const candidates = Array.from({ length: 26 }, (_, i) => ({
    name: `Candidate ${i}`,
    email: `candidate${i}@example.test`,
    contactHandle: "@test",
    candidateCode: `TL-CAPACITY-${i}`,
    requestKey: randomUUID(),
  }));
  const rows = await db.insert(candidateApplicationsTable).values(candidates).returning();
  const results = await Promise.allSettled(
    rows.map((row) => admitCandidate(row.id, "owner", "capacity test")),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 24);
  assert.equal(
    (
      await db
        .select()
        .from(candidateApplicationsTable)
        .where(eq(candidateApplicationsTable.status, "ammesso"))
    ).length,
    25,
  );
  emailFailure = true;
  await dispatchLaunchEmails();
  assert.ok(
    (await db.select().from(launchEmailsTable)).some(
      (row) => row.attempts > 0 && row.status === "pending",
    ),
  );
  const keysBefore = emailKeys.slice();
  emailFailure = false;
  await db
    .update(launchEmailsTable)
    .set({ availableAt: new Date(0) })
    .where(eq(launchEmailsTable.status, "pending"));
  await Promise.all([dispatchLaunchEmails(), dispatchLaunchEmails()]);
  assert.ok(emailKeys.every(Boolean), "all sends carry provider idempotency keys");
  assert.ok(
    keysBefore.some((key) => emailKeys.filter((k) => k === key).length >= 2),
    "retries reuse the same key",
  );
  assert.equal(
    (await db.select().from(launchEmailsTable).where(eq(launchEmailsTable.key, "welcome:free")))[0]
      .status,
    "sent",
  );
  await queueLaunchWelcome("free");
  assert.equal(
    (await db.select().from(launchEmailsTable).where(eq(launchEmailsTable.key, "welcome:free")))
      .length,
    1,
  );
  console.log(
    "PASS: migration, catalog, owner isolation, free/paid playback, refunds, weekly quota, concurrent admissions, school idempotency and durable email retry.",
  );
} finally {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
