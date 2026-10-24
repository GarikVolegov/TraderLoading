import { sql } from "drizzle-orm";
import { assertReadyStreamVideo } from "./academyStream.js";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { academyLessonsTable, academyProgressTable, db } from "@workspace/db";
import { z } from "zod";
import {
  ACADEMY_MODULES,
  ACADEMY_SYLLABUS,
  type AcademyLesson,
  type AcademyLessonMetadata,
  type AcademyModuleId,
  type AcademyProgress,
  type AcademyTeacherSubmission,
} from "../../../../contracts/academy.js";

export class AcademyValidationError extends Error {}
export class AcademyConflictError extends Error {}

/** Parse provider URLs locally; never fetch arbitrary instructor-supplied URLs. */
export function normalizeAcademyVideoUrl(
  input: string | null | undefined,
): { url: string; embedUrl: string } | null {
  if (input == null || !input.trim()) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AcademyValidationError("Inserisci un link video YouTube o Vimeo valido.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new AcademyValidationError("Il video deve usare un link HTTPS YouTube o Vimeo.");
  }
  const host = url.hostname.toLowerCase();
  let youtubeId: string | null = null;
  if (host === "youtu.be")
    youtubeId = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    youtubeId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null);
  }
  if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
    youtubeId = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  }
  if (youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    return {
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const match =
      host === "player.vimeo.com"
        ? url.pathname.match(/^\/video\/(\d{1,12})\/?$/)
        : url.pathname.match(/^\/(\d{1,12})(?:\/([a-zA-Z0-9]{6,64}))?\/?$/);
    if (match) {
      const hash = match[2] ?? url.searchParams.get("h");
      if (hash !== null && hash !== undefined && !/^[a-zA-Z0-9]{6,64}$/.test(hash)) {
        throw new AcademyValidationError("Il codice privato del video Vimeo non è valido.");
      }
      return {
        url: `https://vimeo.com/${match[1]}${hash ? `/${hash}` : ""}`,
        embedUrl: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${hash}` : ""}`,
      };
    }
  }
  throw new AcademyValidationError("Sono supportati solo link a singoli video YouTube e Vimeo.");
}

const lessonFields = {
  moduleId: z.enum(
    ACADEMY_MODULES.map((module) => module.id) as [AcademyModuleId, ...AcademyModuleId[]],
  ),
  syllabusId: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional(),
  videoUrl: z.string().trim().max(2048).nullable().optional(),
  streamVideoId: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .nullable()
    .optional(),
  accessLevel: z.enum(["free", "protocol"]).optional(),
  contentKind: z.enum(["book", "lesson"]).optional(),
  introductionSlot: z.enum(["book", "chapter0", "lesson1", "lesson2"]).nullable().optional(),
  bodyMarkdown: z.string().trim().max(100_000).optional(),
  exercisePrompt: z.string().trim().max(10_000).optional(),
  orderIndex: z.number().int().min(0).max(100_000).optional(),
  published: z.boolean().optional(),
};
export const academyLessonInput = z.object(lessonFields).strict();
export const academyLessonPatchInput = academyLessonInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nessun campo da aggiornare.");
export const academyProgressInput = z
  .object({
    completed: z.boolean().optional(),
    exerciseResponse: z.string().trim().max(20_000).optional(),
    submit: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.completed !== undefined ||
      value.exerciseResponse !== undefined ||
      value.submit === true,
    "Nessun progresso da aggiornare.",
  );
export const academyFeedbackInput = z
  .object({
    feedback: z.string().trim().min(1).max(10_000),
    submittedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type AcademyProgressInput = z.infer<typeof academyProgressInput>;
type LessonRow = typeof academyLessonsTable.$inferSelect;
type ProgressRow = typeof academyProgressTable.$inferSelect;
type LessonWrite = Pick<
  LessonRow,
  | "moduleId"
  | "syllabusId"
  | "title"
  | "description"
  | "videoUrl"
  | "streamVideoId"
  | "accessLevel"
  | "contentKind"
  | "introductionSlot"
  | "bodyMarkdown"
  | "exercisePrompt"
  | "orderIndex"
  | "published"
  | "publishedAt"
  | "updatedAt"
>;

/** Validate the merged record, so partial updates cannot invalidate a published lesson. */
export function buildAcademyLessonWrite(
  input: unknown,
  existing?: LessonRow,
  now = new Date(),
): LessonWrite {
  const parsed = existing ? academyLessonPatchInput.parse(input) : academyLessonInput.parse(input);
  const value = { ...existing, ...parsed };
  const moduleId = value.moduleId!;
  const syllabusId = value.syllabusId || null;
  if (
    syllabusId &&
    !ACADEMY_SYLLABUS.some((item) => item.id === syllabusId && item.moduleId === moduleId)
  ) {
    throw new AcademyValidationError("La scaletta deve appartenere al modulo selezionato.");
  }
  const video = normalizeAcademyVideoUrl(value.videoUrl);
  const published = value.published ?? false;
  if (published && value.contentKind === "book" && !value.bodyMarkdown?.trim())
    throw new AcademyValidationError("Completa il libro prima di pubblicarlo.");
  if (published && value.contentKind !== "book" && !video && !value.streamVideoId)
    throw new AcademyValidationError(
      "Aggiungi il video del docente prima di pubblicare la lezione.",
    );
  return {
    moduleId,
    syllabusId,
    title: value.title!,
    description: value.description ?? "",
    streamVideoId: value.streamVideoId ?? null,
    accessLevel: value.accessLevel ?? "protocol",
    contentKind: value.contentKind ?? "lesson",
    introductionSlot: value.introductionSlot ?? null,
    videoUrl: video?.url ?? null,
    bodyMarkdown: value.bodyMarkdown ?? "",
    exercisePrompt: value.exercisePrompt ?? "",
    orderIndex: value.orderIndex ?? 0,
    published,
    publishedAt: published ? (existing?.publishedAt ?? now) : null,
    updatedAt: now,
  };
}

const metadataColumns = {
  accessLevel: academyLessonsTable.accessLevel,
  contentKind: academyLessonsTable.contentKind,
  introductionSlot: academyLessonsTable.introductionSlot,
  id: academyLessonsTable.id,
  moduleId: academyLessonsTable.moduleId,
  syllabusId: academyLessonsTable.syllabusId,
  title: academyLessonsTable.title,
  description: academyLessonsTable.description,
  orderIndex: academyLessonsTable.orderIndex,
  publishedAt: academyLessonsTable.publishedAt,
};
export function academyLessonMetadata(
  row: Pick<LessonRow, keyof typeof metadataColumns>,
): AcademyLessonMetadata {
  return {
    accessLevel: row.accessLevel as "free" | "protocol",
    contentKind: row.contentKind as "book" | "lesson",
    introductionSlot: row.introductionSlot,
    id: row.id,
    moduleId: row.moduleId as AcademyModuleId,
    syllabusId: row.syllabusId,
    title: row.title,
    description: row.description,
    orderIndex: row.orderIndex,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}
export function academyLessonView(row: LessonRow): AcademyLesson {
  return {
    ...academyLessonMetadata(row),
    streamVideoId: row.streamVideoId,
    videoUrl: row.videoUrl,
    videoEmbedUrl: normalizeAcademyVideoUrl(row.videoUrl)?.embedUrl ?? null,
    bodyMarkdown: row.bodyMarkdown,
    exercisePrompt: row.exercisePrompt,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function academyProgressView(row: ProgressRow): AcademyProgress {
  return {
    id: row.id,
    lessonId: row.lessonId,
    completedAt: row.completedAt?.toISOString() ?? null,
    exerciseResponse: row.exerciseResponse,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    feedback: row.feedback,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPublishedAcademyLessons(): Promise<AcademyLessonMetadata[]> {
  const rows = await db
    .select(metadataColumns)
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.published, true))
    .orderBy(asc(academyLessonsTable.orderIndex), asc(academyLessonsTable.createdAt));
  return rows.map(academyLessonMetadata);
}
export async function listAcademyTeacherLessons(): Promise<AcademyLesson[]> {
  const rows = await db
    .select()
    .from(academyLessonsTable)
    .orderBy(asc(academyLessonsTable.orderIndex), asc(academyLessonsTable.createdAt));
  return rows.map(academyLessonView);
}
export async function getAcademyLesson(
  id: string,
  includeDrafts = false,
): Promise<AcademyLesson | null> {
  const [row] = await db
    .select()
    .from(academyLessonsTable)
    .where(
      and(
        eq(academyLessonsTable.id, id),
        includeDrafts ? undefined : eq(academyLessonsTable.published, true),
      ),
    )
    .limit(1);
  return row ? academyLessonView(row) : null;
}
export async function createAcademyLesson(userId: string, input: unknown): Promise<AcademyLesson> {
  const write = buildAcademyLessonWrite(input);
  if (write.streamVideoId) await assertReadyStreamVideo(write.streamVideoId);
  const [row] = await db
    .insert(academyLessonsTable)
    .values({
      ...write,
      id: randomUUID(),
      createdBy: userId,
    })
    .returning();
  return academyLessonView(row);
}
export async function updateAcademyLesson(
  id: string,
  input: unknown,
): Promise<AcademyLesson | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(academyLessonsTable)
      .where(eq(academyLessonsTable.id, id))
      .for("update");
    if (!existing) return null;
    const write = buildAcademyLessonWrite(input, existing);
    if (write.streamVideoId && (write.published || write.streamVideoId !== existing.streamVideoId))
      await assertReadyStreamVideo(write.streamVideoId);
    const [row] = await tx
      .update(academyLessonsTable)
      .set(write)
      .where(eq(academyLessonsTable.id, id))
      .returning();
    return academyLessonView(row);
  });
}
export async function deleteAcademyLesson(id: string): Promise<boolean> {
  const rows = await db
    .delete(academyLessonsTable)
    .where(eq(academyLessonsTable.id, id))
    .returning({ id: academyLessonsTable.id });
  return rows.length > 0;
}
export async function listAcademyProgress(userId: string): Promise<AcademyProgress[]> {
  const rows = await db
    .select({ progress: academyProgressTable })
    .from(academyProgressTable)
    .innerJoin(academyLessonsTable, eq(academyProgressTable.lessonId, academyLessonsTable.id))
    .where(and(eq(academyProgressTable.userId, userId), eq(academyLessonsTable.published, true)));
  return rows.map((row) => academyProgressView(row.progress));
}
export async function getAcademyProgress(
  userId: string,
  lessonId: string,
): Promise<AcademyProgress | null> {
  const [row] = await db
    .select()
    .from(academyProgressTable)
    .where(
      and(eq(academyProgressTable.userId, userId), eq(academyProgressTable.lessonId, lessonId)),
    )
    .limit(1);
  return row ? academyProgressView(row) : null;
}

export function buildAcademyProgressWrite(
  existing: ProgressRow,
  input: AcademyProgressInput,
  now = new Date(),
) {
  const value = academyProgressInput.parse(input);
  const exerciseResponse = value.exerciseResponse ?? existing.exerciseResponse;
  const responseChanged = exerciseResponse !== existing.exerciseResponse;
  if (value.submit && !exerciseResponse.trim())
    throw new AcademyValidationError("Scrivi l'esercizio prima di inviarlo al docente.");
  // Editing an exercise withdraws its earlier submission and feedback. A plain
  // completion toggle preserves both. Repeated submission of the same answer is idempotent.
  return {
    completedAt:
      value.completed === undefined
        ? existing.completedAt
        : value.completed
          ? (existing.completedAt ?? now)
          : null,
    exerciseResponse,
    submittedAt: value.submit
      ? (!responseChanged && existing.submittedAt) || now
      : responseChanged
        ? null
        : existing.submittedAt,
    feedback: responseChanged ? "" : existing.feedback,
    reviewedBy: responseChanged ? null : existing.reviewedBy,
    reviewedAt: responseChanged ? null : existing.reviewedAt,
    updatedAt: now,
  };
}

export async function saveAcademyProgress(
  userId: string,
  lessonId: string,
  input: AcademyProgressInput,
  includeDrafts = false,
): Promise<AcademyProgress | null> {
  return db.transaction(async (tx) => {
    const [lesson] = await tx
      .select({ id: academyLessonsTable.id })
      .from(academyLessonsTable)
      .where(
        and(
          eq(academyLessonsTable.id, lessonId),
          includeDrafts ? undefined : eq(academyLessonsTable.published, true),
        ),
      )
      .for("share");
    if (!lesson) return null;
    await tx
      .insert(academyProgressTable)
      .values({ id: randomUUID(), userId, lessonId })
      .onConflictDoNothing({
        target: [academyProgressTable.userId, academyProgressTable.lessonId],
      });
    const [existing] = await tx
      .select()
      .from(academyProgressTable)
      .where(
        and(eq(academyProgressTable.userId, userId), eq(academyProgressTable.lessonId, lessonId)),
      )
      .for("update");
    if (
      input.submit &&
      (!existing.submittedAt ||
        (input.exerciseResponse !== undefined &&
          input.exerciseResponse !== existing.exerciseResponse))
    ) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`academy:weekly:${userId}`}))`);
      const submitted =
        await tx.execute(sql`INSERT INTO academy_weekly_submissions (user_id, week_start, lesson_id)
        VALUES (${userId}, date_trunc('week', now() AT TIME ZONE 'Europe/Rome')::date, ${lessonId})
        ON CONFLICT (user_id, week_start) DO UPDATE SET lesson_id = academy_weekly_submissions.lesson_id
        RETURNING lesson_id`);
      if (submitted.rows[0]?.lesson_id !== lessonId)
        throw new AcademyConflictError(
          "Hai già inviato la consegna di questa settimana. Puoi salvare gli altri esercizi come bozze.",
        );
    }
    const [row] = await tx
      .update(academyProgressTable)
      .set(buildAcademyProgressWrite(existing, input))
      .where(
        and(eq(academyProgressTable.userId, userId), eq(academyProgressTable.lessonId, lessonId)),
      )
      .returning();
    return academyProgressView(row);
  });
}
export async function listAcademySubmissions(): Promise<AcademyTeacherSubmission[]> {
  const rows = await db
    .select({ progress: academyProgressTable, lessonTitle: academyLessonsTable.title })
    .from(academyProgressTable)
    .innerJoin(academyLessonsTable, eq(academyProgressTable.lessonId, academyLessonsTable.id))
    .where(isNotNull(academyProgressTable.submittedAt))
    .orderBy(desc(academyProgressTable.submittedAt));
  return rows.map(({ progress, lessonTitle }) => ({
    ...academyProgressView(progress),
    userId: progress.userId,
    lessonTitle,
  }));
}
export async function reviewAcademySubmission(
  teacherId: string,
  id: string,
  feedback: string,
  submittedAt: string,
): Promise<AcademyProgress | null> {
  const value = academyFeedbackInput.parse({ feedback, submittedAt });
  const [row] = await db
    .update(academyProgressTable)
    .set({
      feedback: value.feedback,
      reviewedBy: teacherId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(academyProgressTable.id, id),
        eq(academyProgressTable.submittedAt, new Date(value.submittedAt)),
      ),
    )
    .returning();
  if (row) return academyProgressView(row);
  const [existing] = await db
    .select({ id: academyProgressTable.id })
    .from(academyProgressTable)
    .where(eq(academyProgressTable.id, id))
    .limit(1);
  if (existing)
    throw new AcademyConflictError(
      "L'allievo ha modificato l'esercizio. Ricarica le consegne prima di inviare il feedback.",
    );
  return null;
}
