import { Router, type IRouter } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

const DEFAULT_QUOTES = [
  { text: "Il mercato può restare irrazionale più a lungo di quanto tu possa restare solvente.", author: "John Maynard Keynes" },
  { text: "Il trend è tuo amico fino alla fine.", author: "Ed Seykota" },
  { text: "Non è se hai ragione o torto che conta, ma quanti soldi guadagni quando hai ragione e quanto perdi quando hai torto.", author: "George Soros" },
  { text: "La chiave del trading è la disciplina e la pazienza.", author: "Jesse Livermore" },
  { text: "Il rischio nasce dal non sapere cosa stai facendo.", author: "Warren Buffett" },
  { text: "Taglia le perdite e lascia correre i profitti.", author: "David Ricardo" },
  { text: "La paura e l'avidità sono i peggiori nemici del trader.", author: "Larry Williams" },
  { text: "Il mercato premia la pazienza e punisce l'impazienza.", author: "Anonimo" },
  { text: "Proteggi il capitale. Le opportunità torneranno sempre.", author: "Paul Tudor Jones" },
  { text: "Un buon trader è uno studente perpetuo del mercato.", author: "Mark Douglas" },
];

router.get("/quotes", async (req, res) => {
  const userId = getUserId(req);
  const userFilter = userId ? eq(quotesTable.userId, userId) : isNull(quotesTable.userId);
  const quotes = await db.select().from(quotesTable).where(userFilter);
  res.json(
    quotes.map((q) => ({
      id: q.id,
      text: q.text,
      author: q.author ?? null,
      createdAt: q.createdAt.toISOString(),
    }))
  );
});

router.get("/quotes/random", async (req, res) => {
  const userId = getUserId(req);
  const userFilter = userId ? eq(quotesTable.userId, userId) : isNull(quotesTable.userId);
  const userQuotes = await db.select().from(quotesTable).where(userFilter);

  const today = new Date();
  const dayIndex = Math.floor(today.getTime() / 86400000);

  if (userQuotes.length > 0) {
    const pick = userQuotes[dayIndex % userQuotes.length];
    res.json({ id: pick.id, text: pick.text, author: pick.author ?? null, createdAt: pick.createdAt.toISOString() });
  } else {
    const pick = DEFAULT_QUOTES[dayIndex % DEFAULT_QUOTES.length];
    res.json({ id: 0, text: pick.text, author: pick.author, createdAt: new Date().toISOString() });
  }
});

router.post("/quotes", async (req, res) => {
  const userId = getUserId(req);
  const { text, author } = req.body;

  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const [created] = await db
    .insert(quotesTable)
    .values({ text, author: author || null, userId })
    .returning();

  res.status(201).json({
    id: created.id,
    text: created.text,
    author: created.author ?? null,
    createdAt: created.createdAt.toISOString(),
  });
});

router.put("/quotes/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const { text, author } = req.body;
  const userFilter = userId ? eq(quotesTable.userId, userId) : isNull(quotesTable.userId);

  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, id), userFilter));

  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  const [updated] = await db
    .update(quotesTable)
    .set({
      text: text ?? existing.text,
      author: author !== undefined ? (author || null) : existing.author,
    })
    .where(eq(quotesTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    text: updated.text,
    author: updated.author ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/quotes/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const userFilter = userId ? eq(quotesTable.userId, userId) : isNull(quotesTable.userId);

  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, id), userFilter));

  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  await db.delete(quotesTable).where(eq(quotesTable.id, id));
  res.json({ success: true });
});

export default router;
