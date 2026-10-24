import { db, pool, academyLessonsTable, launchEmailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAcademyConfig, academyCheckoutAvailable } from "../src/services/academyBilling.js";
import { streamConfig, streamVideoState } from "../src/services/academyStream.js";
import { isLimenOwner } from "../src/lib/adminAuth.js";
import { backgroundTasksEnabled } from "../src/lib/localBackgroundTasks.js";

/** Read-only release gate. No emails, checkout sessions, purchases or migrations are created. */
const checks: { check: string; ready: boolean }[] = [];
try {
  checks.push({
    check: "Account proprietario con ruolo admin",
    ready: Boolean(
      process.env.LIMEN_OWNER_USER_ID && (await isLimenOwner(process.env.LIMEN_OWNER_USER_ID)),
    ),
  });
  checks.push({
    check: "Resend, mittente e URL applicazione configurati",
    ready: Boolean(
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      /^https:\/\//.test(process.env.APP_BASE_URL ?? ""),
    ),
  });
  checks.push({ check: "Worker email abilitato", ready: backgroundTasksEnabled(process.env) });
  let configured = false;
  try {
    streamConfig();
    configured = true;
  } catch {
    /* Report configuration absence without exposing values. */
  }
  checks.push({ check: "Cloudflare Stream configurato", ready: configured });
  const lessons = await db
    .select()
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.published, true));
  for (const slot of ["book", "chapter0", "lesson1", "lesson2"]) {
    const lesson = lessons.find((l) => l.introductionSlot === slot && l.accessLevel === "free");
    checks.push({
      check: `Introduzione gratuita pubblicata: ${slot}`,
      ready: Boolean(
        lesson &&
        (slot === "book"
          ? lesson.contentKind === "book" && lesson.bodyMarkdown.trim()
          : lesson.contentKind === "lesson" &&
            lesson.streamVideoId &&
            configured &&
            (await streamVideoState(lesson.streamVideoId, false)).state === "ready"),
      ),
    });
  }
  checks.push({
    check: "Lezioni Protocollo pubblicate",
    ready: lessons.some((l) => l.accessLevel === "protocol" && l.contentKind === "lesson"),
  });
  checks.push({
    check: "Vendite abilitate e prezzo Stripe valido (150 EUR/mese, IVA inclusa)",
    ready: getAcademyConfig().salesEnabled && (await academyCheckoutAvailable()),
  });
  const review = await db
    .select({ key: launchEmailsTable.key })
    .from(launchEmailsTable)
    .where(eq(launchEmailsTable.status, "needs_review"));
  checks.push({ check: "Nessuna email in attesa di verifica manuale", ready: review.length === 0 });
  console.table(
    checks.map((c) => ({ Controllo: c.check, Stato: c.ready ? "PRONTO" : "DA COMPLETARE" })),
  );
  console.log(
    "Il controllo non certifica recapito email, qualità dei contenuti o un pagamento reale: completare le prove operative documentate.",
  );
  if (checks.some((c) => !c.ready)) process.exitCode = 1;
} catch (err) {
  console.error(
    "Controllo lancio non completato:",
    err instanceof Error
      ? err.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database]")
      : "errore",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
