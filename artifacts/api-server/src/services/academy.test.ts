import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const {
  normalizeAcademyVideoUrl, buildAcademyLessonWrite, academyLessonMetadata,
  buildAcademyProgressWrite, academyProgressInput, academyFeedbackInput,
} = await import("./academy.js");

assert.deepEqual(normalizeAcademyVideoUrl(" https://youtu.be/abcdefghijk?si=tracking "), {
  url: "https://www.youtube.com/watch?v=abcdefghijk", embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
});
for (const url of ["https://www.youtube.com/watch?v=abcdefghijk&list=ignore", "https://youtube.com/shorts/abcdefghijk", "https://www.youtube-nocookie.com/embed/abcdefghijk"]) {
  assert.equal(normalizeAcademyVideoUrl(url)?.url, "https://www.youtube.com/watch?v=abcdefghijk");
}
assert.deepEqual(normalizeAcademyVideoUrl("https://vimeo.com/123456789/abcdef1234?share=copy"), {
  url: "https://vimeo.com/123456789/abcdef1234", embedUrl: "https://player.vimeo.com/video/123456789?h=abcdef1234",
});
assert.equal(normalizeAcademyVideoUrl("https://player.vimeo.com/video/123456789?h=abcdef1234")?.url, "https://vimeo.com/123456789/abcdef1234");
assert.equal(normalizeAcademyVideoUrl("https://vimeo.com/123456789")?.embedUrl, "https://player.vimeo.com/video/123456789");
assert.equal(normalizeAcademyVideoUrl(null), null);
assert.equal(normalizeAcademyVideoUrl("  "), null);
for (const url of [
  "http://youtube.com/watch?v=abcdefghijk", "javascript:alert(1)", "data:text/html,test", "https://localhost/video",
  "https://youtube.com.evil.test/watch?v=abcdefghijk", "https://youtube.com@evil.test/watch?v=abcdefghijk",
  "https://evil.test@youtube.com/watch?v=abcdefghijk", "https://youtube.com:8443/watch?v=abcdefghijk",
  "https://youtube.com/watch?v=bad", "https://youtube.com/redirect?q=https://evil.test", "https://youtu.be/abcdefghijk/extra",
  "https://player.vimeo.com/video/123456789?h=%3Cscript%3E", "https://vimeo.com/showcase/123456789",
  "https://vimeo.com.evil.test/123456789", "https://vimeo.com/123456789/abcdef1234/extra",
]) assert.throws(() => normalizeAcademyVideoUrl(url), Error, url);

const now = new Date("2026-10-18T12:00:00Z");
const earlier = new Date("2026-10-17T12:00:00Z");
const input = { moduleId: "scalp", syllabusId: "scalp-1", title: "  Contesto H1  " };
const draft = buildAcademyLessonWrite(input, undefined, now);
assert.equal(draft.title, "Contesto H1");
assert.equal(draft.videoUrl, null);
assert.equal(draft.published, false);
assert.equal(draft.publishedAt, null);
assert.throws(() => buildAcademyLessonWrite({ ...input, published: true }), /video del docente/);
assert.throws(() => buildAcademyLessonWrite({ ...input, moduleId: "swing" }), /scaletta/);
assert.throws(() => buildAcademyLessonWrite({ ...input, moduleId: "invalid" }));
assert.throws(() => buildAcademyLessonWrite({ ...input, syllabusId: "scalp-nonexistent" }), /scaletta/);
assert.throws(() => buildAcademyLessonWrite({ ...input, createdBy: "someone-else" }));
assert.throws(() => buildAcademyLessonWrite({ ...input, orderIndex: -1 }));
assert.throws(() => buildAcademyLessonWrite({ ...input, title: " " }));

const published = {
  ...buildAcademyLessonWrite({ ...input, videoUrl: "https://youtu.be/abcdefghijk", published: true }, undefined, earlier),
  id: "fda37a99-34ba-48d5-a7f1-b5b674438229", createdBy: "teacher", createdAt: earlier,
};
assert.equal(published.publishedAt, earlier);
assert.equal(published.videoUrl, "https://www.youtube.com/watch?v=abcdefghijk");
assert.equal(buildAcademyLessonWrite({ title: "Updated" }, published, now).publishedAt, earlier);
assert.throws(() => buildAcademyLessonWrite({ videoUrl: null }, published, now), /video del docente/);
assert.throws(() => buildAcademyLessonWrite({ moduleId: "swing" }, published, now), /scaletta/);
assert.equal(buildAcademyLessonWrite({ published: false, videoUrl: null }, published, now).publishedAt, null);
assert.equal(buildAcademyLessonWrite({ moduleId: "swing", syllabusId: "swing-1" }, published, now).moduleId, "swing");
assert.deepEqual(Object.keys(academyLessonMetadata(published)).sort(), ["description", "id", "moduleId", "orderIndex", "publishedAt", "syllabusId", "title"]);

const progress = {
  id: "progress", userId: "student", lessonId: published.id, completedAt: earlier,
  exerciseResponse: "Existing answer", submittedAt: earlier,
  feedback: "Teacher feedback", reviewedBy: "teacher", reviewedAt: earlier, updatedAt: earlier,
};
const completion = buildAcademyProgressWrite(progress, { completed: false }, now);
assert.equal(completion.completedAt, null);
assert.equal(completion.feedback, "Teacher feedback");
assert.equal(completion.submittedAt, earlier);
assert.equal(buildAcademyProgressWrite(progress, { completed: true }, now).completedAt, earlier);
const edited = buildAcademyProgressWrite(progress, { exerciseResponse: " New answer " }, now);
assert.equal(edited.exerciseResponse, "New answer");
assert.equal(edited.submittedAt, null);
assert.equal(edited.feedback, "");
assert.equal(edited.reviewedAt, null);
assert.equal(edited.reviewedBy, null);
const resubmitted = buildAcademyProgressWrite(progress, { exerciseResponse: " New answer ", submit: true }, now);
assert.equal(resubmitted.submittedAt, now);
assert.equal(resubmitted.feedback, "");
const retry = buildAcademyProgressWrite(progress, { exerciseResponse: "Existing answer", submit: true }, now);
assert.equal(retry.submittedAt, earlier);
assert.equal(retry.feedback, "Teacher feedback");
assert.throws(() => buildAcademyProgressWrite(progress, { exerciseResponse: " ", submit: true }), /Scrivi l'esercizio/);
for (const invalid of [{}, { submit: false }, { userId: "another", completed: true }, { feedback: "forged", completed: true }, { completed: "true" }, { exerciseResponse: "a".repeat(20_001) }]) {
  assert.equal(academyProgressInput.safeParse(invalid).success, false);
}
assert.equal(academyFeedbackInput.safeParse({ feedback: " ", submittedAt: now.toISOString() }).success, false);
assert.equal(academyFeedbackInput.safeParse({ feedback: "Good", submittedAt: now.toISOString(), userId: "another" }).success, false);
assert.equal(academyFeedbackInput.safeParse({ feedback: "Good" }).success, false);
assert.equal(academyFeedbackInput.safeParse({ feedback: "Good", submittedAt: "invalid" }).success, false);
assert.equal(academyFeedbackInput.safeParse({ feedback: "Good", submittedAt: now.toISOString() }).success, true);

console.log("academy video, publication, metadata and progress checks passed");
