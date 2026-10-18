import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AcademyCatalog, AcademyLesson, AcademyLessonDetail, AcademyProgress, AcademyTeacherSubmission } from "../../../../contracts/academy.js";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { createAcademyRouter } = await import("./academy.js");
const { classifyApiError } = await import("../lib/apiError.js");
const { AcademyConflictError, AcademyValidationError } = await import("../services/academy.js");

const lessonId = "fda37a99-34ba-48d5-a7f1-b5b674438229";
const draftId = "678f842c-f140-4e31-9584-c73e9f6eacbe";
const submissionId = "5ad54cef-59a6-4c3e-bd3e-1d21ed489cb1";
const now = "2026-10-18T12:00:00.000Z";
const lesson: AcademyLesson = {
  id: lessonId, moduleId: "scalp", syllabusId: "scalp-1", title: "Contesto H1", description: "Introduzione",
  orderIndex: 0, publishedAt: now, videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  videoEmbedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk", bodyMarkdown: "Paid lesson body",
  exercisePrompt: "Paid exercise prompt", published: true, createdAt: now, updatedAt: now,
};
const progress: AcademyProgress = {
  id: submissionId, lessonId, completedAt: null, exerciseResponse: "Private student response",
  submittedAt: now, feedback: "Private feedback", reviewedAt: now, updatedAt: now,
};
let contentReads = 0;
let teacherCalls = 0;
const owners: string[] = [];
const writes: unknown[] = [];
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const userId = req.header("x-test-user");
  if (userId) req.user = { id: userId, email: null, firstName: null, lastName: null, profileImageUrl: null };
  next();
});
app.use("/api", createAcademyRouter({
  hasAccess: async userId => userId.startsWith("student"),
  isTeacher: async userId => userId === "teacher",
  // Deliberately return extra paid fields; the catalog must still redact them.
  listPublishedLessons: async () => [lesson],
  listTeacherLessons: async () => { teacherCalls++; return [lesson, { ...lesson, id: draftId, published: false }]; },
  getLesson: async (id, includeDrafts) => {
    contentReads++;
    if (id === draftId) return includeDrafts ? { ...lesson, id, published: false } : null;
    return id === lessonId ? lesson : null;
  },
  listProgress: async userId => { owners.push(userId); return [{ ...progress, exerciseResponse: `answer:${userId}` }]; },
  getProgress: async userId => { owners.push(userId); return { ...progress, exerciseResponse: `answer:${userId}` }; },
  saveProgress: async (userId, id, input, includeDrafts) => {
    owners.push(userId); writes.push({ userId, id, input, includeDrafts });
    if (id === draftId && !includeDrafts) return null;
    if (input.submit && !input.exerciseResponse?.trim()) throw new AcademyValidationError("Scrivi l'esercizio prima di inviarlo al docente.");
    return { ...progress, exerciseResponse: input.exerciseResponse ?? progress.exerciseResponse, completedAt: input.completed ? now : null };
  },
  createLesson: async (userId, input) => { teacherCalls++; writes.push({ userId, input }); return lesson; },
  updateLesson: async (id, input) => { teacherCalls++; writes.push({ id, input }); return id === lessonId ? lesson : null; },
  deleteLesson: async id => { teacherCalls++; return id === lessonId; },
  listSubmissions: async () => { teacherCalls++; return [{ ...progress, userId: "student-a", lessonTitle: lesson.title }]; },
  reviewSubmission: async (userId, id, feedback, submittedAt) => {
    teacherCalls++;
    if (submittedAt !== now) throw new AcademyConflictError("L'allievo ha modificato l'esercizio.");
    writes.push({ userId, id, feedback, submittedAt });
    return id === submissionId ? { ...progress, feedback } : null;
  },
}));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const classified = classifyApiError(error);
  res.status(classified.status).json(classified.body);
});
const server = createServer(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/api/academy`;
async function request(path: string, user?: string, method = "GET", body?: unknown) {
  return fetch(`${base}${path}`, { method, headers: { ...(user ? { "x-test-user": user } : {}), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

try {
  for (const [path, method] of [
    ["/catalog", "GET"], [`/lessons/${lessonId}`, "GET"], [`/lessons/${lessonId}/progress`, "PUT"],
    ["/teacher/lessons", "GET"], ["/teacher/lessons", "POST"], [`/teacher/lessons/${lessonId}`, "PATCH"],
    [`/teacher/lessons/${lessonId}`, "DELETE"], ["/teacher/submissions", "GET"], [`/teacher/submissions/${submissionId}`, "PATCH"],
  ]) assert.equal((await request(path, undefined, method, method === "GET" ? undefined : {})).status, 401, `${method} ${path}`);
  assert.equal(contentReads, 0);
  assert.equal(teacherCalls, 0);

  const catalogResponse = await request("/catalog", "free-user");
  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogResponse.headers.get("cache-control"), "private, no-store");
  const catalog = await catalogResponse.json() as AcademyCatalog;
  assert.deepEqual(catalog.access, { hasAccess: false, isTeacher: false });
  assert.equal(catalog.syllabus.length, 24);
  assert.ok(catalog.syllabus.every((item: { status: string }) => item.status === "outline"));
  assert.deepEqual(catalog.progress, []);
  for (const forbidden of ["videoUrl", "videoEmbedUrl", "bodyMarkdown", "exercisePrompt", "createdBy"]) {
    assert.equal(forbidden in catalog.lessons[0], false, `catalog leaked ${forbidden}`);
  }
  assert.equal(owners.length, 0, "unsubscribed catalog must not query private progress");
  assert.equal((await request(`/lessons/${lessonId}`, "free-user")).status, 403);
  assert.equal((await request(`/lessons/${lessonId}/progress`, "free-user", "PUT", { completed: true })).status, 403);
  assert.equal(contentReads, 0, "deny paid content before reading it");
  assert.equal(writes.length, 0);

  const studentCatalog = await (await request("/catalog", "student-a")).json() as AcademyCatalog;
  assert.deepEqual(studentCatalog.access, { hasAccess: true, isTeacher: false });
  assert.equal(studentCatalog.progress[0].exerciseResponse, "answer:student-a");
  const detail = await (await request(`/lessons/${lessonId}?userId=student-b`, "student-a")).json() as AcademyLessonDetail;
  assert.equal(detail.lesson.bodyMarkdown, "Paid lesson body");
  assert.equal(detail.progress?.exerciseResponse, "answer:student-a");
  assert.equal((await request(`/lessons/${draftId}`, "student-a")).status, 404);
  assert.equal((await request(`/lessons/${draftId}/progress`, "student-a", "PUT", { completed: true })).status, 404);
  assert.equal((await request(`/lessons/not-a-uuid`, "student-a")).status, 400);
  assert.equal((await request(`/lessons/${lessonId}/progress`, "student-a", "PUT", { userId: "student-b", completed: true })).status, 400);
  assert.equal((await request(`/lessons/${lessonId}/progress`, "student-a", "PUT", { feedback: "forged" })).status, 400);
  assert.equal((await request(`/lessons/${lessonId}/progress`, "student-a", "PUT", {})).status, 400);
  const saved = await request(`/lessons/${lessonId}/progress?userId=student-b`, "student-a", "PUT", { completed: true, exerciseResponse: "My answer", submit: true });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json() as AcademyProgress).exerciseResponse, "My answer");
  assert.deepEqual(writes.at(-1), { userId: "student-a", id: lessonId, input: { completed: true, exerciseResponse: "My answer", submit: true }, includeDrafts: false });
  assert.equal(owners.includes("student-b"), false, "query and body must never override the authenticated progress owner");
  assert.equal((await request(`/lessons/${lessonId}/progress`, "student-a", "PUT", { exerciseResponse: " ", submit: true })).status, 400);

  for (const user of ["student-a", "free-user"]) {
    for (const [path, method, body] of [
      ["/teacher/lessons", "GET"], ["/teacher/lessons", "POST", { moduleId: "scalp", title: "Fake" }],
      [`/teacher/lessons/${lessonId}`, "PATCH", { title: "Fake" }], [`/teacher/lessons/${lessonId}`, "DELETE"],
      ["/teacher/submissions", "GET"], [`/teacher/submissions/${submissionId}`, "PATCH", { feedback: "Fake" }],
    ] as const) assert.equal((await request(path, user, method, body)).status, 403, `${user}: ${method} ${path}`);
  }
  assert.equal(teacherCalls, 0);
  const teacherCatalog = await (await request("/catalog", "teacher")).json() as AcademyCatalog;
  assert.deepEqual(teacherCatalog.access, { hasAccess: true, isTeacher: true }, "teachers need no paid student subscription");
  assert.equal((await request(`/lessons/${draftId}`, "teacher")).status, 200);
  assert.equal((await (await request("/teacher/lessons", "teacher")).json() as AcademyLesson[]).length, 2);
  assert.equal((await request("/teacher/lessons", "teacher", "POST", { moduleId: "scalp", title: "Valid" })).status, 201);
  assert.deepEqual(writes.at(-1), { userId: "teacher", input: { moduleId: "scalp", title: "Valid" } });
  assert.equal((await request("/teacher/lessons", "teacher", "POST", { moduleId: "scalp", title: "Valid", createdBy: "spoof" })).status, 400);
  assert.equal((await request(`/teacher/lessons/${lessonId}`, "teacher", "PATCH", { title: "New" })).status, 200);
  assert.equal((await request(`/teacher/lessons/${draftId}`, "teacher", "PATCH", { title: "New" })).status, 404);
  assert.equal((await request(`/teacher/lessons/${lessonId}`, "teacher", "PATCH", {})).status, 400);
  assert.equal((await request(`/teacher/lessons/${lessonId}`, "teacher", "DELETE")).status, 200);
  assert.equal((await request(`/teacher/lessons/${draftId}`, "teacher", "DELETE")).status, 404);
  const submissions = await (await request("/teacher/submissions", "teacher")).json() as AcademyTeacherSubmission[];
  assert.equal(submissions[0].userId, "student-a");
  assert.equal((await request(`/teacher/submissions/${submissionId}`, "teacher", "PATCH", { feedback: "Reviewed", submittedAt: now })).status, 200);
  assert.deepEqual(writes.at(-1), { userId: "teacher", id: submissionId, feedback: "Reviewed", submittedAt: now });
  assert.equal((await request(`/teacher/submissions/${lessonId}`, "teacher", "PATCH", { feedback: "Reviewed", submittedAt: now })).status, 404);
  assert.equal((await request(`/teacher/submissions/${submissionId}`, "teacher", "PATCH", { feedback: " ", submittedAt: now })).status, 400);
  assert.equal((await request(`/teacher/submissions/${submissionId}`, "teacher", "PATCH", { feedback: "Reviewed" })).status, 400);
  const beforeStaleFeedback = writes.length;
  assert.equal((await request(`/teacher/submissions/${submissionId}`, "teacher", "PATCH", { feedback: "Stale", submittedAt: "2026-10-17T12:00:00.000Z" })).status, 409);
  assert.equal(writes.length, beforeStaleFeedback, "stale feedback must not be written onto a newer answer");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

console.log("academy HTTP authentication, subscription, teacher and owner isolation checks passed");
