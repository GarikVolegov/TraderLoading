import { ensureAcademyIdentity } from "./academyIdentity.js";
import { LaunchError } from "../lib/launchError.js";
import { randomUUID } from "node:crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  db,
  candidateApplicationsTable as applications,
  schoolRequestsTable,
  usersTable,
} from "@workspace/db";
import { queueLaunchEmail } from "./email/launchEmails.js";
import {
  calculateLimenServicesPricing,
  resolveLimenEntitlements,
  type LimenBillingCycle,
  type LimenEntitlementsMap,
} from "../../../../contracts/limenServices.js";
import { getAdminPrincipalForUser } from "../lib/adminAuth.js";

export async function createCandidate(
  input: {
    requestKey: string;
    name: string;
    email: string;
    contactType: string;
    contactHandle: string;
    situation?: string;
    horizon?: string;
    obstacle?: string;
    commitment?: string;
    planChosen?: string;
    billingCycle?: LimenBillingCycle;
    referredBy?: string | null;
    selectedServices?: string[];
  },
  actorId: string | null,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(applications)
      .where(eq(applications.requestKey, input.requestKey));
    if (existing) {
      if (existing.email !== input.email) throw new LaunchError("Richiesta non valida.", 409);
      return { candidateCode: existing.candidateCode, status: existing.status };
    }
    const [actor] = actorId
      ? await tx.select().from(usersTable).where(eq(usersTable.id, actorId))
      : [];
    const candidateCode = `TL-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

    const selectedServices =
      input.selectedServices && input.selectedServices.length > 0
        ? Array.from(new Set(["base_protocol", ...input.selectedServices]))
        : ["base_protocol"];

    const billingCycle: LimenBillingCycle =
      input.billingCycle === "yearly" ? "yearly" : "monthly";
    const pricing = calculateLimenServicesPricing(selectedServices, billingCycle);

    const [record] = await tx
      .insert(applications)
      .values({
        requestKey: input.requestKey,
        name: input.name,
        email: input.email,
        contactType: input.contactType,
        contactHandle: input.contactHandle,
        situation: input.situation,
        horizon: input.horizon,
        obstacle: input.obstacle,
        commitment: input.commitment,
        planChosen: input.planChosen ?? pricing.tierId,
        billingCycle,
        referredBy: input.referredBy,
        selectedServices,
        approvedServices: selectedServices,
        monthlyFeeCents: pricing.promoActive
          ? (pricing.promoMonthlyFeeCents ?? 260)
          : pricing.monthlyFeeCents,
        yearlyFeeCents: pricing.yearlyFeeCents,
        oneTimeFeeCents: pricing.oneTimeFeeCents,
        currency: "EUR",
        candidateCode,
        userId: actor?.email?.toLowerCase() === input.email ? actorId : null,
        status: "in_valutazione",
      })
      .onConflictDoNothing({ target: applications.requestKey })
      .returning();
    if (!record) {
      const [retry] = await tx
        .select()
        .from(applications)
        .where(eq(applications.requestKey, input.requestKey));
      if (!retry || retry.email !== input.email)
        throw new LaunchError("Richiesta non valida.", 409);
      return { candidateCode: retry.candidateCode, status: retry.status };
    }
    await queueLaunchEmail(
      {
        key: `candidate:${record.id}`,
        kind: "candidate",
        recipient: record.email,
        userId: record.userId,
        subject: "AUREUS · Candidatura ricevuta",
        body: `Abbiamo ricevuto la tua candidatura ${candidateCode}. È in valutazione: non è stato attivato alcun addebito. Dotazione configurata: ${pricing.formattedSummary}. Puoi accedere subito al Varco e al Libro della Verità mentre attendi la revisione del Concilio.`,
        path: "/",
      },
      tx,
    );
    return {
      candidateCode,
      status: record.status,
      billingCycle: record.billingCycle,
      selectedServices: record.selectedServices,
      monthlyFeeCents: record.monthlyFeeCents,
      yearlyFeeCents: record.yearlyFeeCents,
      oneTimeFeeCents: record.oneTimeFeeCents,
    };
  });
}

export async function admitCandidate(
  id: number,
  reviewer: string,
  notes: string,
  approvedServices?: string[],
  billingCycle?: LimenBillingCycle,
) {
  return db.transaction(async (tx) => {
    // One shared lock serializes admissions across instances and prevents overbooking.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('limen:launch:admissions'))`);
    const [existing] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .for("update");
    if (!existing) throw new LaunchError("Candidatura non trovata.", 404);

    const cycle: LimenBillingCycle =
      billingCycle ?? (existing.billingCycle === "yearly" ? "yearly" : "monthly");
    const rawApproved =
      approvedServices && approvedServices.length > 0
        ? Array.from(new Set(["base_protocol", ...approvedServices]))
        : (existing.approvedServices as string[] | null) ??
          (existing.selectedServices as string[] | null) ?? ["base_protocol"];
    const pricing = calculateLimenServicesPricing(rawApproved, cycle);
    const finalApprovedServices = [...pricing.selectedIds];

    if (existing.status === "ammesso") {
      // If already admitted, update approved services if changed
      const [updated] = await tx
        .update(applications)
        .set({
          approvedServices: finalApprovedServices,
          billingCycle: cycle,
          monthlyFeeCents: pricing.promoActive
          ? (pricing.promoMonthlyFeeCents ?? 260)
          : pricing.monthlyFeeCents,
          yearlyFeeCents: pricing.yearlyFeeCents,
          oneTimeFeeCents: pricing.oneTimeFeeCents,
          notes: notes || existing.notes,
          reviewedBy: reviewer,
          updatedAt: new Date(),
        })
        .where(eq(applications.id, id))
        .returning();
      return { before: existing, application: updated };
    }

    const admitted =
      await tx.execute(sql`SELECT DISTINCT lower(email) AS identity FROM candidate_applications WHERE status = 'ammesso'
      UNION SELECT DISTINCT lower(COALESCE(u.email, s.user_id)) AS identity FROM academy_subscriptions s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active' AND NOT s.payment_revoked AND s.paid_through > now()`);
    const existingSeat = admitted.rows.some((row) => row.identity === existing.email.toLowerCase());
    if (
      !existingSeat &&
      admitted.rows.length >= 25 &&
      existing.planChosen === "direct_150" &&
      process.env.ENFORCE_LAUNCH_25_SEATS === "true"
    ) {
      throw new LaunchError("I 25 posti iniziali sono già riservati.", 409);
    }
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${existing.email.toLowerCase()}`)
      .limit(1);
    const [application] = await tx
      .update(applications)
      .set({
        status: "ammesso",
        approvedServices: finalApprovedServices,
        billingCycle: cycle,
        monthlyFeeCents: pricing.promoActive
          ? (pricing.promoMonthlyFeeCents ?? 260)
          : pricing.monthlyFeeCents,
        yearlyFeeCents: pricing.yearlyFeeCents,
        oneTimeFeeCents: pricing.oneTimeFeeCents,
        userId: user?.id ?? existing.userId ?? null,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        updatedAt: new Date(),
        notes: notes || existing.notes,
      })
      .where(eq(applications.id, id))
      .returning();
    const admissionBody =
      existing.monthlyFeeCents === 260
        ? "La tua candidatura al Protocollo AUREUS è stata ammessa dal Concilio. La tua Dotazione Operativa (Forgia del Passato + Architettura Patrimoniale) è attiva con la tariffa promozionale di 2,60 € per i primi 14 giorni (poi 10 €/mese). I servizi sono ora sbloccati nella tua dotazione operativa."
        : "La tua candidatura al Protocollo AUREUS è stata ammessa dal Concilio. I servizi approvati sono ora sbloccati nella tua dotazione operativa.";
    await queueLaunchEmail(
      {
        key: `admission:${id}`,
        kind: "admission",
        recipient: existing.email,
        userId: user?.id,
        subject: "AUREUS · La tua candidatura è stata ammessa",
        body: admissionBody,
        path: "/",
      },
      tx,
    );
    return { before: existing, application };
  });
}

export async function updateCandidateApprovedServices(
  id: number,
  reviewer: string,
  approvedServices: string[],
  notes?: string,
  billingCycle?: LimenBillingCycle,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .for("update");
    if (!existing) throw new LaunchError("Candidatura non trovata.", 404);

    const cycle: LimenBillingCycle =
      billingCycle ?? (existing.billingCycle === "yearly" ? "yearly" : "monthly");
    const pricing = calculateLimenServicesPricing(approvedServices, cycle);

    const [updated] = await tx
      .update(applications)
      .set({
        approvedServices: [...pricing.selectedIds],
        billingCycle: cycle,
        monthlyFeeCents: pricing.promoActive
          ? (pricing.promoMonthlyFeeCents ?? 260)
          : pricing.monthlyFeeCents,
        yearlyFeeCents: pricing.yearlyFeeCents,
        oneTimeFeeCents: pricing.oneTimeFeeCents,
        reviewedBy: reviewer,
        notes: notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();

    return { before: existing, application: updated };
  });
}

export async function getCandidateEntitlementsForUser(
  userId: string | null,
  userEmail?: string | null,
  candidateCode?: string | null,
): Promise<{
  hasApplication: boolean;
  candidateCode: string | null;
  status: string;
  billingCycle: LimenBillingCycle;
  selectedServices: string[];
  approvedServices: string[];
  monthlyFeeCents: number;
  yearlyFeeCents: number;
  oneTimeFeeCents: number;
  entitlements: LimenEntitlementsMap;
}> {
  let isAdmin = false;
  if (userId) {
    const principal = await getAdminPrincipalForUser(userId);
    isAdmin = Boolean(principal);
  }

  // Also check if admin by email
  if (!isAdmin && userEmail) {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${userEmail.toLowerCase()}`)
      .limit(1);
    if (user?.id) {
      const principal = await getAdminPrincipalForUser(user.id);
      isAdmin = Boolean(principal);
    }
  }

  if (isAdmin) {
    return {
      hasApplication: true,
      candidateCode: "ADMIN",
      status: "ammesso",
      billingCycle: "monthly",
      selectedServices: ["base_protocol", "forge_of_the_past", "financial_architecture", "doctrine_of_time"],
      approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture", "doctrine_of_time"],
      monthlyFeeCents: 0,
      yearlyFeeCents: 0,
      oneTimeFeeCents: 0,
      entitlements: resolveLimenEntitlements({ isAdmin: true }),
    };
  }

  // If userId is present but userEmail is not provided, look it up in usersTable
  if (userId && !userEmail) {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (user?.email) {
      userEmail = user.email;
    }
  }

  let application: typeof applications.$inferSelect | undefined;

  if (userId) {
    const [byUserId] = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt))
      .limit(1);
    application = byUserId;
  }

  if (!application && userEmail) {
    const [byEmail] = await db
      .select()
      .from(applications)
      .where(sql`lower(${applications.email}) = ${userEmail.toLowerCase()}`)
      .orderBy(desc(applications.createdAt))
      .limit(1);
    application = byEmail;

    // Link application to userId ONLY if the user record with userId actually owns this email
    if (application && userId && !application.userId) {
      const [verifiedUser] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (verifiedUser?.email?.toLowerCase() === application.email.toLowerCase()) {
        await db
          .update(applications)
          .set({ userId })
          .where(eq(applications.id, application.id));
      }
    }
  }

  if (!application && candidateCode) {
    const [byCode] = await db
      .select()
      .from(applications)
      .where(eq(applications.candidateCode, candidateCode))
      .limit(1);
    application = byCode;
  }

  if (!application) {
    return {
      hasApplication: false,
      candidateCode: null,
      status: "nessuna",
      billingCycle: "monthly",
      selectedServices: ["base_protocol"],
      approvedServices: ["base_protocol"],
      monthlyFeeCents: 0,
      yearlyFeeCents: 0,
      oneTimeFeeCents: 0,
      entitlements: resolveLimenEntitlements({ status: "nessuna", approvedServices: [] }),
    };
  }

  const selectedServices = (application.selectedServices as string[] | null) ?? ["base_protocol"];
  const approvedServices = (application.approvedServices as string[] | null) ?? ["base_protocol"];
  const billingCycle: LimenBillingCycle = application.billingCycle === "yearly" ? "yearly" : "monthly";

  return {
    hasApplication: true,
    candidateCode: application.candidateCode,
    status: application.status,
    billingCycle,
    selectedServices,
    approvedServices,
    monthlyFeeCents: application.monthlyFeeCents ?? 0,
    yearlyFeeCents: application.yearlyFeeCents ?? 0,
    oneTimeFeeCents: application.oneTimeFeeCents ?? 0,
    entitlements: resolveLimenEntitlements({
      status: application.status,
      approvedServices,
    }),
  };
}
export async function isCandidateAdmitted(userId: string) {
  // Unconditional bypass for Admin users
  const principal = await getAdminPrincipalForUser(userId);
  if (principal) return true;

  const user = await ensureAcademyIdentity(userId);
  if (!user?.email) return false;
  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.status, "ammesso"),
        or(
          eq(applications.userId, userId),
          sql`lower(${applications.email}) = ${user.email.toLowerCase()}`,
        ),
      ),
    )
    .limit(1);
  return Boolean(application);
}

export async function createSchoolRequest(input: typeof schoolRequestsTable.$inferInsert) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schoolRequestsTable)
      .values(input)
      .onConflictDoNothing({ target: schoolRequestsTable.requestKey })
      .returning();
    if (row)
      await queueLaunchEmail(
        {
          key: `school:${row.id}`,
          kind: "school",
          recipient: row.email,
          subject: "AUREUS · Richiesta partnership ricevuta",
          body: "Abbiamo ricevuto la richiesta per la tua scuola. Prepariamo una proposta con setup iniziale, posti concordati per sei mesi e quota per i nuovi ingressi. Il pacchetto riguarda il software e la vostra formazione: il Protocollo e il feedback personale del docente restano separati. Nessun acquisto è stato attivato.",
          path: "/#schools",
        },
        tx,
      );
    return { ok: true };
  });
}
