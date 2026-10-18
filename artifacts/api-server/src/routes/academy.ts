import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { ACADEMY_MODULES, ACADEMY_SYLLABUS, type AcademyCatalog } from "../../../../contracts/academy.js";
import { canPublishPlatformContent } from "../lib/adminAuth.js";
import { hasAcademyAccess } from "../services/academyBilling.js";
import {
  AcademyConflictError, AcademyValidationError, academyFeedbackInput, academyLessonInput, academyLessonPatchInput, academyProgressInput,
  createAcademyLesson, deleteAcademyLesson, getAcademyLesson, getAcademyProgress, listAcademyProgress,
  listAcademySubmissions, listAcademyTeacherLessons, listPublishedAcademyLessons, reviewAcademySubmission,
  saveAcademyProgress, updateAcademyLesson,
} from "../services/academy.js";

const defaultDependencies = {
  hasAccess: hasAcademyAccess,
  isTeacher: canPublishPlatformContent,
  listPublishedLessons: listPublishedAcademyLessons,
  listTeacherLessons: listAcademyTeacherLessons,
  getLesson: getAcademyLesson,
  createLesson: createAcademyLesson,
  updateLesson: updateAcademyLesson,
  deleteLesson: deleteAcademyLesson,
  listProgress: listAcademyProgress,
  getProgress: getAcademyProgress,
  saveProgress: saveAcademyProgress,
  listSubmissions: listAcademySubmissions,
  reviewSubmission: reviewAcademySubmission,
};
export type AcademyRouteDependencies = typeof defaultDependencies;
const idInput = z.string().uuid();

export function createAcademyRouter(overrides: Partial<AcademyRouteDependencies> = {}): IRouter {
  const deps = { ...defaultDependencies, ...overrides };
  const router = Router();

  // All Academy content and progress is private, including authenticated catalog previews.
  router.use("/academy", (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!req.user?.id) { res.status(401).json({ error: "Accedi per aprire l'Academy." }); return; }
    next();
  });
  async function access(req: Request, res: Response, teacherOnly = false) {
    const userId = req.user!.id;
    const isTeacher = await deps.isTeacher(userId);
    if (teacherOnly && !isTeacher) { res.status(403).json({ error: "Questa area è riservata al docente." }); return null; }
    const hasAccess = isTeacher || await deps.hasAccess(userId);
    if (!hasAccess) { res.status(403).json({ error: "È necessario un abbonamento Academy attivo.", code: "ACADEMY_SUBSCRIPTION_REQUIRED" }); return null; }
    return { userId, isTeacher };
  }

  router.get("/academy/catalog", async (req, res) => {
    const userId = req.user!.id;
    const isTeacher = await deps.isTeacher(userId);
    const hasAccess = isTeacher || await deps.hasAccess(userId);
    const [lessons, progress] = await Promise.all([
      deps.listPublishedLessons(), hasAccess ? deps.listProgress(userId) : Promise.resolve([]),
    ]);
    // Explicit projection prevents accidental inclusion of paid fields if a service changes.
    const catalog: AcademyCatalog = {
      modules: ACADEMY_MODULES, syllabus: ACADEMY_SYLLABUS,
      lessons: lessons.map(({ id, moduleId, syllabusId, title, description, orderIndex, publishedAt }) => ({
        id, moduleId, syllabusId, title, description, orderIndex, publishedAt,
      })), access: { hasAccess, isTeacher }, progress,
    };
    res.json(catalog);
  });
  router.get("/academy/lessons/:id", async (req, res) => {
    const actor = await access(req, res);
    if (!actor) return;
    const id = idInput.parse(req.params.id);
    const lesson = await deps.getLesson(id, actor.isTeacher);
    if (!lesson || (!actor.isTeacher && !lesson.published)) { res.status(404).json({ error: "Lezione non trovata." }); return; }
    res.json({ lesson, progress: await deps.getProgress(actor.userId, id) });
  });
  router.put("/academy/lessons/:id/progress", async (req, res) => {
    const actor = await access(req, res);
    if (!actor) return;
    const id = idInput.parse(req.params.id);
    const input = academyProgressInput.parse(req.body);
    const progress = await deps.saveProgress(actor.userId, id, input, actor.isTeacher);
    if (!progress) { res.status(404).json({ error: "Lezione non trovata." }); return; }
    res.json(progress);
  });

  router.get("/academy/teacher/lessons", async (req, res) => {
    if (!await access(req, res, true)) return;
    res.json(await deps.listTeacherLessons());
  });
  router.post("/academy/teacher/lessons", async (req, res) => {
    const actor = await access(req, res, true);
    if (!actor) return;
    res.status(201).json(await deps.createLesson(actor.userId, academyLessonInput.parse(req.body)));
  });
  router.patch("/academy/teacher/lessons/:id", async (req, res) => {
    if (!await access(req, res, true)) return;
    const lesson = await deps.updateLesson(idInput.parse(req.params.id), academyLessonPatchInput.parse(req.body));
    if (!lesson) { res.status(404).json({ error: "Lezione non trovata." }); return; }
    res.json(lesson);
  });
  router.delete("/academy/teacher/lessons/:id", async (req, res) => {
    if (!await access(req, res, true)) return;
    if (!await deps.deleteLesson(idInput.parse(req.params.id))) { res.status(404).json({ error: "Lezione non trovata." }); return; }
    res.json({ ok: true });
  });
  router.get("/academy/teacher/submissions", async (req, res) => {
    if (!await access(req, res, true)) return;
    res.json(await deps.listSubmissions());
  });
  router.patch("/academy/teacher/submissions/:id", async (req, res) => {
    const actor = await access(req, res, true);
    if (!actor) return;
    const { feedback, submittedAt } = academyFeedbackInput.parse(req.body);
    const progress = await deps.reviewSubmission(actor.userId, idInput.parse(req.params.id), feedback, submittedAt);
    if (!progress) { res.status(404).json({ error: "Esercizio inviato non trovato." }); return; }
    res.json(progress);
  });
  router.use((error: unknown, _req: Request, res: Response, next: (error?: unknown) => void) => {
    if (error instanceof AcademyValidationError) { res.status(400).json({ error: error.message }); return; }
    if (error instanceof AcademyConflictError) { res.status(409).json({ error: error.message }); return; }
    next(error);
  });
  return router;
}

export default createAcademyRouter();
