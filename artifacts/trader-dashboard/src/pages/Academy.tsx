import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  GraduationCap,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProcessField, ProcessFrame } from "@/components/process/ProcessUI";
import { useLanguage } from "@/contexts/LanguageContext";
import { academyText, type AcademyCopyKey } from "@/lib/academyCopy";
import * as api from "@/lib/academyApi";
import { validAcademyReferral } from "@/lib/academyReferral";
import {
  fetchDashboardLink,
  fetchPayoutAccount,
  payoutAccountKey,
  startPayoutOnboarding,
} from "@/lib/payoutApi";
import {
  ACADEMY_MODULES,
  ACADEMY_SYLLABUS,
  type AcademySyllabusItem,
} from "../../../../contracts/academy";
import "./academy.css";

function useCopy() {
  const { language } = useLanguage();
  return (key: AcademyCopyKey) => academyText(language, key);
}
function useAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => client.invalidateQueries({ queryKey: api.academyKeys.all }),
    meta: { suppressGlobalError: true },
  });
}
function ErrorNotice({ retry }: { retry?: () => void }) {
  const c = useCopy();
  return (
    <div className="academy-notice" role="alert">
      <p>{c("error")}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          {c("retry")}
        </Button>
      )}
    </div>
  );
}
function Money({ cents }: { cents: number }) {
  const { language } = useLanguage();
  return (
    <>
      {new Intl.NumberFormat(language, { style: "currency", currency: "EUR" }).format(cents / 100)}
    </>
  );
}
function AcademyDate({ value }: { value: string }) {
  const { language } = useLanguage();
  return <time dateTime={value}>{new Date(value).toLocaleDateString(language)}</time>;
}

export function AcademyWelcome() {
  const c = useCopy();
  const search = useSearch();
  const ref = validAcademyReferral(new URLSearchParams(search).get("ref"));
  const authQuery = `academy=1${ref ? `&academy_ref=${ref}` : ""}`;
  return (
    <main className="academy-public">
      <div className="academy-workspace">
        <header className="academy-public-nav">
          <Link href="/">TraderLoadings</Link>
          <Link className="academy-text-link" href={`/sign-in?${authQuery}`}>
            {c("login")}
            <ArrowRight size={16} />
          </Link>
        </header>
        <section className="academy-hero">
          <div className="academy-hero-copy">
            <p className="academy-eyebrow">ACADEMY / SCALP & SWING</p>
            <h1>{c("subtitle")}</h1>
            <p>{c("intro")}</p>
            <p className="academy-caption">{c("includes")}</p>
          </div>
          <div className="academy-price">
            <GraduationCap size={28} aria-hidden />
            <p className="academy-amount">
              <Money cents={15000} />
              <span> / {c("monthly")}</span>
            </p>
            <p className="academy-caption">{c("subscriptionNote")}</p>
            <Link className="academy-public-cta" href={`/sign-up?${authQuery}`}>
              {c("register")}
              <ArrowRight size={16} />
            </Link>
            <p className="academy-caption">{c("welcomeNote")}</p>
          </div>
        </section>
        <section className="academy-curriculum">
          <h2>{c("syllabus")}</h2>
          <p className="academy-caption">{c("outlinesNote")}</p>
          {ACADEMY_MODULES.map((module, i) => (
            <div key={module.id} className="academy-public-module" lang="it">
              <span className="academy-module-number">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{module.title}</h3>
                <p className="academy-caption">{module.description}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="academy-panel">
          <h2>{c("affiliate")}</h2>
          <p>{c("affiliateIntro")}</p>
          <strong>{c("freeAffiliate")}</strong>
          <p className="academy-caption">{c("commissionRules")}</p>
        </section>
        <p className="academy-footnote">{c("risk")}</p>
        <Link className="academy-text-link" href="/terms">
          {c("terms")}
        </Link>
      </div>
    </main>
  );
}
function Status({ value }: { value: string }) {
  const c = useCopy();
  const labels: Record<string, AcademyCopyKey> = {
    pending: "pending",
    available: "available",
    paid: "paid",
    reversed: "reversed",
    held: "pending",
    processing: "pending",
    transferred: "paid",
    recovery_pending: "recovery",
  };
  const key = labels[value];
  return <span className="academy-badge">{key ? c(key) : value}</span>;
}

export default function Academy() {
  const c = useCopy();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const ref = validAcademyReferral(params.get("ref"));
  const tab = params.get("tab") ?? "course";
  const lessonId = params.get("lesson");
  const catalog = useQuery({ queryKey: api.academyKeys.catalog, queryFn: api.fetchAcademyCatalog });
  const billing = useQuery({
    queryKey: api.academyKeys.billing,
    queryFn: api.fetchAcademyBilling,
    staleTime: 0,
  });
  const tabs = [
    "course",
    "affiliate",
    ...(catalog.data?.access.isTeacher ? ["teacher"] : []),
  ] as const;
  return (
    <ProcessFrame title="Academy" subtitle={c("subtitle")}>
      <div className="academy-workspace">
        <nav className="academy-tabs" aria-label="Academy">
          {tabs.map((item) => (
            <Link
              key={item}
              href={`/academy?tab=${item}${ref ? `&ref=${ref}` : ""}`}
              aria-current={tab === item && !lessonId ? "page" : undefined}
            >
              {c(item as "course" | "affiliate" | "teacher")}
            </Link>
          ))}
        </nav>
        {(params.has("session_id") || params.get("checkout") === "success") &&
          !billing.data?.active && (
            <div className="academy-notice" role="status">
              <p>{c("paymentReturn")}</p>
              <Button
                variant="outline"
                onClick={() => {
                  void billing.refetch();
                  void catalog.refetch();
                }}
                disabled={billing.isFetching}
              >
                <RefreshCw size={15} />
                {c("refresh")}
              </Button>
            </div>
          )}
        {catalog.isPending ? (
          <p role="status">{c("loading")}</p>
        ) : catalog.isError ? (
          <ErrorNotice retry={() => void catalog.refetch()} />
        ) : lessonId ? (
          <LessonView key={lessonId} id={lessonId} />
        ) : tab === "teacher" && catalog.data.access.isTeacher ? (
          <TeacherStudio />
        ) : tab === "affiliate" ? (
          <AffiliatePanel
            billing={billing.data}
            billingError={billing.isError}
            retry={() => void billing.refetch()}
          />
        ) : (
          <Course
            catalog={catalog.data}
            billing={billing.data}
            billingError={billing.isError}
            retry={() => void billing.refetch()}
          />
        )}
        <p className="academy-footnote">{c("risk")}</p>
      </div>
    </ProcessFrame>
  );
}

function Course({
  catalog,
  billing,
  billingError,
  retry,
}: {
  catalog: api.AcademyCatalog;
  billing?: api.AcademyBilling;
  billingError: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const action = useAction();
  const search = useSearch();
  const referralCode = validAcademyReferral(new URLSearchParams(search).get("ref")) ?? undefined;
  return (
    <>
      <section className="academy-hero">
        <div className="academy-hero-copy">
          <p className="academy-eyebrow">SCALP / SWING</p>
          <h2>{c("subtitle")}</h2>
          <p>{c("intro")}</p>
          <p className="academy-caption">{c("includes")}</p>
          <div className="academy-method" aria-hidden="true">
            <span>
              01
              <br />
              CONTESTO
            </span>
            <ArrowRight size={16} />
            <span>
              02
              <br />
              SCENARIO
            </span>
            <ArrowRight size={16} />
            <span>
              03
              <br />
              CONFERMA
            </span>
            <ArrowRight size={16} />
            <span>
              04
              <br />
              REVISIONE
            </span>
          </div>
        </div>
        <div className="academy-price">
          <GraduationCap size={28} aria-hidden />
          <p className="academy-eyebrow">TRADERLOADINGS ACADEMY</p>
          <p className="academy-amount">
            <Money cents={billing?.price.amountCents ?? 15000} />
            <span> / {c("monthly")}</span>
          </p>
          {billingError ? (
            <ErrorNotice retry={retry} />
          ) : !billing ? (
            <p role="status">{c("loading")}</p>
          ) : billing.active ? (
            <>
              <p className="academy-active">
                <Check size={16} />
                {c("active")}
              </p>
              {billing.currentPeriodEnd && (
                <p className="academy-caption">
                  {c(billing.cancelAtPeriodEnd ? "until" : "nextRenewal")}{" "}
                  <AcademyDate value={billing.currentPeriodEnd} />
                </p>
              )}
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(() => api.changeAcademyRenewal(billing.cancelAtPeriodEnd))
                }
              >
                {c(billing.cancelAtPeriodEnd ? "resume" : "cancel")}
              </Button>
            </>
          ) : billing.checkoutAvailable ? (
            <Button
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  const result = await api.academyCheckout(referralCode);
                  window.location.assign(api.stripeRedirectUrl(result.url));
                })
              }
            >
              {c("subscribe")}
              <ArrowRight size={16} />
            </Button>
          ) : (
            <p className="academy-caption">{c("unavailable")}</p>
          )}
          {action.isError && <ErrorNotice />}
          <p className="academy-caption">{c("subscriptionNote")}</p>
          <Link href="/terms" className="academy-text-link">
            {c("terms")}
          </Link>
        </div>
      </section>
      <section className="academy-curriculum" lang="it">
        <div className="academy-section-heading">
          <div>
            <p className="academy-eyebrow">08 MODULI / SCALP & SWING</p>
            <h2>{c("syllabus")}</h2>
          </div>
          <span className="academy-badge">
            {catalog.lessons.length} {c("published")}
          </span>
        </div>
        <p className="academy-caption">{c("outlinesNote")}</p>
        {catalog.modules.map((module, index) => {
          const lessons = catalog.lessons.filter((item) => item.moduleId === module.id);
          const planned = catalog.syllabus.filter(
            (item) =>
              item.moduleId === module.id &&
              !lessons.some((lesson) => lesson.syllabusId === item.id),
          );
          return (
            <details
              key={module.id}
              className="academy-module"
              open={index === 0 ? true : undefined}
            >
              <summary>
                <span className="academy-module-number">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>
                <span className="academy-badge">
                  {lessons.length}/{lessons.length + planned.length}
                </span>
              </summary>
              <ul className="academy-lessons">
                {lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <span className="academy-lesson-icon">
                      {catalog.progress.some((p) => p.lessonId === lesson.id && p.completedAt) ? (
                        <Check size={17} />
                      ) : (
                        <Play size={17} />
                      )}
                    </span>
                    <span className="academy-lesson-title">
                      <strong>{lesson.title}</strong>
                      <small>{lesson.description}</small>
                    </span>
                    {catalog.access.hasAccess ? (
                      <Link
                        className="academy-text-link"
                        href={`/academy?lesson=${encodeURIComponent(lesson.id)}`}
                      >
                        {c("open")}
                        <ArrowRight size={15} />
                      </Link>
                    ) : (
                      <span className="academy-caption">
                        <LockKeyhole size={14} aria-hidden />
                        {c("locked")}
                      </span>
                    )}
                  </li>
                ))}
                {planned.map((item) => (
                  <li key={item.id} className="academy-planned">
                    <span className="academy-lesson-icon">·</span>
                    <span className="academy-lesson-title">{item.title}</span>
                    <span className="academy-badge">{c("preparation")}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>
    </>
  );
}

function LessonView({ id }: { id: string }) {
  const c = useCopy();
  const lesson = useQuery({
    queryKey: api.academyKeys.lesson(id),
    queryFn: () => api.fetchAcademyLesson(id),
    retry: false,
  });
  return (
    <>
      <Link className="academy-text-link" href="/academy">
        <ArrowLeft size={16} />
        {c("back")}
      </Link>
      {lesson.isPending ? (
        <p role="status">{c("loading")}</p>
      ) : lesson.isError ? (
        <ErrorNotice retry={() => void lesson.refetch()} />
      ) : (
        <LessonContent key={lesson.data.lesson.id} detail={lesson.data} />
      )}
    </>
  );
}
function LessonContent({ detail }: { detail: api.AcademyLessonDetail }) {
  const c = useCopy();
  const { lesson, progress } = detail;
  const [response, setResponse] = useState(progress?.exerciseResponse ?? "");
  const action = useAction();
  return (
    <article className="academy-lesson-page">
      <header>
        <p className="academy-eyebrow">
          {ACADEMY_MODULES.find((m) => m.id === lesson.moduleId)?.title}
        </p>
        <h2>{lesson.title}</h2>
        <p className="academy-caption">{lesson.description}</p>
      </header>
      {lesson.videoEmbedUrl && (
        <iframe
          className="academy-player"
          src={lesson.videoEmbedUrl}
          title={lesson.title}
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {lesson.bodyMarkdown && (
        <div className="academy-prose" lang="it">
          {lesson.bodyMarkdown}
        </div>
      )}
      <section className="academy-panel">
        <h3>{c("exercise")}</h3>
        <p className="academy-prose" lang="it">
          {lesson.exercisePrompt}
        </p>
        <ProcessField label={c("response")}>
          <Textarea
            rows={7}
            maxLength={20000}
            value={response}
            onChange={(event) => {
              setResponse(event.target.value);
              action.reset();
            }}
          />
        </ProcessField>
        <div className="academy-actions">
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(() =>
                api.saveAcademyProgress(lesson.id, { exerciseResponse: response }),
              )
            }
          >
            {c("saveDraft")}
          </Button>
          <Button
            disabled={action.isPending || !response.trim()}
            onClick={() =>
              action.mutate(() =>
                api.saveAcademyProgress(lesson.id, { exerciseResponse: response, submit: true }),
              )
            }
          >
            {c("submit")}
          </Button>
        </div>
        {progress?.submittedAt && !progress.reviewedAt && (
          <p className="academy-caption">{c("pendingReview")}</p>
        )}
        {progress?.feedback && (
          <aside className="academy-feedback">
            <h4>{c("feedback")}</h4>
            <p className="academy-prose">{progress.feedback}</p>
          </aside>
        )}
        <Button
          variant="ghost"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(() =>
              api.saveAcademyProgress(lesson.id, { completed: !progress?.completedAt }),
            )
          }
        >
          <Check size={16} />
          {c(progress?.completedAt ? "reopen" : "finish")}
        </Button>
        {action.isError && <ErrorNotice />}
        {action.isSuccess && (
          <p role="status" className="academy-caption">
            {c("saved")}
          </p>
        )}
      </section>
    </article>
  );
}

function AffiliatePanel({
  billing,
  billingError,
  retry,
}: {
  billing?: api.AcademyBilling;
  billingError: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState(false);
  const action = useAction();
  const ledger = useQuery({
    queryKey: api.academyKeys.commissions,
    queryFn: api.fetchAcademyCommissions,
    enabled: !!billing?.affiliate.enrolled,
  });
  const payout = useQuery({
    queryKey: payoutAccountKey(),
    queryFn: fetchPayoutAccount,
    enabled: !!billing?.affiliate.enrolled,
  });
  if (billingError) return <ErrorNotice retry={retry} />;
  if (!billing) return <p role="status">{c("loading")}</p>;
  const link = billing.affiliate.link
    ? new URL(billing.affiliate.link, window.location.origin).href
    : "";
  return (
    <div className="academy-affiliate">
      <section className="academy-panel">
        <p className="academy-eyebrow">20% / {c("monthly")}</p>
        <h2>{c("affiliate")}</h2>
        <p>{c("affiliateIntro")}</p>
        <strong>{c("freeAffiliate")}</strong>
        <p className="academy-caption">{c("commissionRules")}</p>
        {!billing.affiliate.enrolled ? (
          <>
            <label className="academy-checkbox">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                {c("affiliateTerms")} <small>v. {billing.affiliate.termsVersion}</small>
              </span>
            </label>
            <Button
              disabled={!accepted || action.isPending}
              onClick={() =>
                action.mutate(() => api.enrollAcademyAffiliate(billing.affiliate.termsVersion))
              }
            >
              {c("join")}
            </Button>
          </>
        ) : (
          <>
            <ProcessField label={c("inviteLink")}>
              <Input readOnly value={link} onFocus={(event) => event.target.select()} />
            </ProcessField>
            <Button
              variant="outline"
              disabled={!link || action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                })
              }
            >
              <Copy size={16} />
              {c(copied ? "copied" : "copy")}
            </Button>
          </>
        )}
        {action.isError && <ErrorNotice />}
      </section>
      {billing.affiliate.enrolled && (
        <>
          <div className="academy-totals">
            {(
              [
                ["pending", billing.commissions.pendingCents],
                ["available", billing.commissions.availableCents],
                ["paid", billing.commissions.paidCents],
              ] as const
            ).map(([key, amount]) => (
              <div key={key}>
                <p className="academy-caption">{c(key)}</p>
                <strong>
                  <Money cents={amount} />
                </strong>
              </div>
            ))}
          </div>
          <section className="academy-panel">
            <h3>{c("connect")}</h3>
            <p className="academy-caption">{c("payoutHint")}</p>
            {payout.isError ? (
              <ErrorNotice retry={() => void payout.refetch()} />
            ) : payout.data?.available ? (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(async () => {
                    const result = await (payout.data?.payoutsEnabled
                      ? fetchDashboardLink()
                      : startPayoutOnboarding());
                    window.location.assign(api.stripeRedirectUrl(result.url));
                  })
                }
              >
                {c(payout.data.payoutsEnabled ? "managePayout" : "connect")}
                <ArrowRight size={15} />
              </Button>
            ) : null}
          </section>
          <section className="academy-panel">
            <h3>{c("affiliate")}</h3>
            {ledger.isPending ? (
              <p role="status">{c("loading")}</p>
            ) : ledger.isError ? (
              <ErrorNotice retry={() => void ledger.refetch()} />
            ) : !ledger.data.items.length ? (
              <p className="academy-caption">{c("emptyCommissions")}</p>
            ) : (
              <ul className="academy-ledger">
                {ledger.data.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      <AcademyDate value={item.createdAt} />
                      <small>
                        {c("available")}: <AcademyDate value={item.availableAt} />
                      </small>
                    </span>
                    <Status value={item.status} />
                    <strong>
                      <Money cents={Math.max(0, item.amountCents - item.reversedCents)} />
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TeacherStudio() {
  const c = useCopy();
  const lessons = useQuery({
    queryKey: api.academyKeys.teacher,
    queryFn: api.fetchAcademyTeacherLessons,
  });
  const submissions = useQuery({
    queryKey: api.academyKeys.submissions,
    queryFn: api.fetchAcademySubmissions,
  });
  const [editing, setEditing] = useState<api.AcademyLesson | AcademySyllabusItem | "new" | null>(
    null,
  );
  return (
    <div className="academy-studio">
      <section className="academy-panel">
        <div className="academy-section-heading">
          <h2>{c("teacher")}</h2>
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} />
            {c("newLesson")}
          </Button>
        </div>
        <p className="academy-caption">{c("teacherNote")}</p>
        {editing ? (
          <LessonEditor
            key={typeof editing === "string" ? editing : editing.id}
            lesson={editing}
            close={() => setEditing(null)}
          />
        ) : lessons.isPending ? (
          <p role="status">{c("loading")}</p>
        ) : lessons.isError ? (
          <ErrorNotice retry={() => void lessons.refetch()} />
        ) : (
          <>
            <ul className="academy-lessons">
              {lessons.data.map((lesson) => (
                <li key={lesson.id}>
                  <span className="academy-lesson-title">
                    <strong>{lesson.title}</strong>
                    <small>{ACADEMY_MODULES.find((m) => m.id === lesson.moduleId)?.title}</small>
                  </span>
                  <span className="academy-badge">
                    {c(lesson.published ? "published" : "draft")}
                  </span>
                  <Button variant="outline" onClick={() => setEditing(lesson)}>
                    {c("edit")}
                  </Button>
                </li>
              ))}
            </ul>
            <details className="academy-outline-list">
              <summary>{c("syllabus")} · 24</summary>
              {ACADEMY_MODULES.map((module) => (
                <div key={module.id}>
                  <h3>{module.title}</h3>
                  {ACADEMY_SYLLABUS.filter((item) => item.moduleId === module.id).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setEditing(item)}
                      className="academy-outline-button"
                    >
                      <span>{item.title}</span>
                      <Plus size={16} aria-hidden />
                    </button>
                  ))}
                </div>
              ))}
            </details>
          </>
        )}
      </section>
      <section className="academy-panel">
        <h2>{c("submissions")}</h2>
        {submissions.isPending ? (
          <p role="status">{c("loading")}</p>
        ) : submissions.isError ? (
          <ErrorNotice retry={() => void submissions.refetch()} />
        ) : !submissions.data.length ? (
          <p className="academy-caption">{c("noSubmissions")}</p>
        ) : (
          submissions.data.map((item) => (
            <Submission key={item.id + item.submittedAt} item={item} />
          ))
        )}
      </section>
      <PayoutReview />
    </div>
  );
}
function LessonEditor({
  lesson,
  close,
}: {
  lesson: api.AcademyLesson | AcademySyllabusItem | "new";
  close: () => void;
}) {
  const c = useCopy();
  const existing = typeof lesson === "object" && "published" in lesson ? lesson : null;
  const outline = typeof lesson === "object" && "outline" in lesson ? lesson : null;
  const [form, setForm] = useState<api.AcademyLessonInput>({
    moduleId: existing?.moduleId ?? outline?.moduleId ?? "preparazione",
    syllabusId: existing?.syllabusId ?? outline?.id ?? null,
    title: existing?.title ?? outline?.title ?? "",
    description: existing?.description ?? "",
    videoUrl: existing?.videoUrl ?? "",
    bodyMarkdown: existing?.bodyMarkdown ?? "",
    exercisePrompt: existing?.exercisePrompt ?? outline?.exercisePrompt ?? "",
    orderIndex: existing?.orderIndex ?? 0,
    published: existing?.published ?? false,
  });
  const action = useAction();
  const field = (
    key: "title" | "description" | "videoUrl" | "bodyMarkdown" | "exercisePrompt",
    label: AcademyCopyKey,
    multiline = false,
  ) => (
    <ProcessField label={c(label)}>
      {multiline ? (
        <Textarea
          maxLength={key === "bodyMarkdown" ? 50000 : key === "description" ? 2000 : 10000}
          rows={key === "bodyMarkdown" ? 8 : 3}
          value={form[key] ?? ""}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        />
      ) : (
        <Input
          required={key === "title" || (key === "videoUrl" && form.published)}
          maxLength={key === "title" ? 180 : 2048}
          type={key === "videoUrl" ? "url" : "text"}
          value={form[key] ?? ""}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        />
      )}
    </ProcessField>
  );
  return (
    <form
      className="academy-editor"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate(async () => {
          await api.saveAcademyLesson(existing?.id ?? null, {
            ...form,
            videoUrl: form.videoUrl || null,
          });
          close();
        });
      }}
    >
      {outline && (
        <div className="academy-notice">
          <p>{outline.outline}</p>
        </div>
      )}
      <ProcessField label={c("module")}>
        <select
          className="academy-select"
          value={form.moduleId}
          onChange={(event) =>
            setForm({
              ...form,
              moduleId: event.target.value as api.AcademyLessonInput["moduleId"],
              syllabusId: null,
            })
          }
        >
          {ACADEMY_MODULES.map((module) => (
            <option key={module.id} value={module.id}>
              {module.title}
            </option>
          ))}
        </select>
      </ProcessField>
      {field("title", "lessonTitle")}
      {field("description", "description", true)}
      {field("videoUrl", "video")}
      {field("bodyMarkdown", "notes", true)}
      {field("exercisePrompt", "prompt", true)}
      <ProcessField label={c("order")}>
        <Input
          type="number"
          min={0}
          max={10000}
          value={form.orderIndex}
          onChange={(event) => setForm({ ...form, orderIndex: Number(event.target.value) })}
        />
      </ProcessField>
      <label className="academy-checkbox">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(event) => setForm({ ...form, published: event.target.checked })}
        />
        <span>{c("publish")}</span>
      </label>
      {action.isError && <ErrorNotice />}
      <div className="academy-actions">
        <Button type="submit" disabled={action.isPending}>
          {c("save")}
        </Button>
        <Button type="button" variant="outline" disabled={action.isPending} onClick={close}>
          {c("cancelEdit")}
        </Button>
      </div>
    </form>
  );
}
function Submission({ item }: { item: api.AcademyTeacherSubmission }) {
  const c = useCopy();
  const [feedback, setFeedback] = useState(item.feedback);
  const action = useAction();
  return (
    <article className="academy-submission">
      <h3>{item.lessonTitle}</h3>
      <p className="academy-caption">
        {item.userId} · {item.submittedAt && <AcademyDate value={item.submittedAt} />}
      </p>
      <p className="academy-prose">{item.exerciseResponse}</p>
      <ProcessField label={c("feedback")}>
        <Textarea
          maxLength={10000}
          value={feedback}
          onChange={(event) => {
            setFeedback(event.target.value);
            action.reset();
          }}
        />
      </ProcessField>
      <Button
        variant="outline"
        disabled={action.isPending || !feedback.trim()}
        onClick={() =>
          action.mutate(() => api.reviewAcademySubmission(item.id, feedback, item.submittedAt!))
        }
      >
        {c("sendFeedback")}
      </Button>
      {action.isError && <ErrorNotice />}
      {action.isSuccess && <p role="status">{c("saved")}</p>}
    </article>
  );
}
function PayoutReview() {
  const c = useCopy();
  const rows = useQuery({
    queryKey: api.academyKeys.payouts,
    queryFn: api.fetchAcademyPayouts,
    retry: false,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<api.AcademyPayoutResult[]>([]);
  const action = useAction();
  const total =
    rows.data?.items
      .filter((row) => selected.includes(row.id))
      .reduce((sum, row) => sum + Math.max(0, row.amountCents - row.reversedCents), 0) ?? 0;
  return (
    <section className="academy-panel">
      <h2>{c("payoutReview")}</h2>
      {results.length > 0 && (
        <ul className="academy-ledger" role="status">
          {results.map((result) => (
            <li key={result.commissionId}>
              <span>{result.commissionId}</span>
              <span>{c(result.status === "processed" ? "processed" : "error")}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.isPending ? (
        <p role="status">{c("loading")}</p>
      ) : rows.isError ? (
        <ErrorNotice retry={() => void rows.refetch()} />
      ) : !rows.data.items.length ? (
        <p className="academy-caption">{c("emptyCommissions")}</p>
      ) : (
        <>
          <ul className="academy-ledger">
            {rows.data.items.map((row) => (
              <li key={row.id}>
                <label className="academy-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(event) => {
                      setConfirmed(false);
                      setSelected(
                        event.target.checked
                          ? [...selected, row.id]
                          : selected.filter((id) => id !== row.id),
                      );
                    }}
                  />
                  <span>
                    {row.affiliateUserId}
                    <small>{row.id}</small>
                  </span>
                </label>
                <Status value={row.status} />
                <strong>
                  <Money cents={Math.max(0, row.amountCents - row.reversedCents)} />
                </strong>
              </li>
            ))}
          </ul>
          <p>
            <Money cents={total} />
          </p>
          <label className="academy-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>{c("payoutConfirm")}</span>
          </label>
          <Button
            disabled={!confirmed || !selected.length || selected.length > 50 || action.isPending}
            onClick={() =>
              action.mutate(async () => {
                const result = await api.payAcademyCommissions(selected);
                setResults(result.items);
                setSelected([]);
                setConfirmed(false);
              })
            }
          >
            {c("payoutAction")}
          </Button>
        </>
      )}
      {action.isError && <ErrorNotice />}
      {action.isSuccess && <p role="status">{c("saved")}</p>}
    </section>
  );
}
