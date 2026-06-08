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
  { text: "La prima regola è non perdere denaro. La seconda è non dimenticare la prima.", author: "Warren Buffett" },
  { text: "Sii avido quando gli altri sono timorosi e timoroso quando gli altri sono avidi.", author: "Warren Buffett" },
  { text: "Il mercato è uno strumento per trasferire denaro dagli impazienti ai pazienti.", author: "Warren Buffett" },
  { text: "Il prezzo è ciò che paghi, il valore è ciò che ottieni.", author: "Warren Buffett" },
  { text: "Il denaro si fa stando seduti, non facendo trading.", author: "Jesse Livermore" },
  { text: "Pianifica il trade e fai trading sul piano.", author: "Anonimo" },
  { text: "Non sommare mai a una posizione in perdita.", author: "Paul Tudor Jones" },
  { text: "Sopravvivere è la cosa più importante.", author: "Paul Tudor Jones" },
  { text: "Non confondere il cervello con un mercato rialzista.", author: "Humphrey B. Neill" },
  { text: "Il trading è semplice, ma non è facile.", author: "Anonimo" },
  { text: "Non puoi controllare il mercato, solo le tue reazioni.", author: "Mark Douglas" },
  { text: "L'obiettivo non è avere ragione, è fare soldi.", author: "Anonimo" },
  { text: "Compra al suono dei cannoni, vendi al suono dei violini.", author: "Nathan Rothschild" },
  { text: "Compra la voce, vendi la notizia.", author: "Detto di Wall Street" },
  { text: "Il mercato ha sempre ragione.", author: "Detto di Wall Street" },
  { text: "Il rischio è ciò che resta quando pensi di aver pensato a tutto.", author: "Carl Richards" },
  { text: "La diversificazione è una protezione contro l'ignoranza.", author: "Warren Buffett" },
  { text: "Ogni battaglia è vinta prima di essere combattuta.", author: "Sun Tzu" },
  { text: "Investi in te stesso: è il miglior investimento che farai.", author: "Warren Buffett" },
  { text: "Il tempo nel mercato batte il momento perfetto di ingresso.", author: "Anonimo" },
  { text: "Le perdite fanno parte del gioco; le perdite grandi ti tolgono dal gioco.", author: "Anonimo" },
  { text: "Pazienza, disciplina e gestione del rischio: il resto è rumore.", author: "Anonimo" },
  { text: "L'obiettivo di un trader di successo è fare i migliori trade. Il denaro è secondario.", author: "Alexander Elder" },
  { text: "Tieni un diario: ciò che non misuri non lo migliori.", author: "Anonimo" },
  { text: "Un piano mediocre eseguito con disciplina batte un piano perfetto eseguito male.", author: "Anonimo" },
  { text: "La calma è il superpotere del trader.", author: "Anonimo" },
  { text: "Sii contrarian quando hai una ragione, non per moda.", author: "Anonimo" },
  { text: "Le grandi opportunità arrivano raramente: quando piove oro, esci col secchio, non col ditale.", author: "Warren Buffett" },
  { text: "Non rischiare mai una somma che non puoi permetterti di perdere.", author: "Jesse Livermore" },
  { text: "Aspetta il pitch giusto: non sei obbligato a fare swing a ogni lancio.", author: "Warren Buffett" },
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

  if (userQuotes.length > 0) {
    const pick = userQuotes[Math.floor(Math.random() * userQuotes.length)];
    res.json({ id: pick.id, text: pick.text, author: pick.author ?? null, createdAt: pick.createdAt.toISOString() });
  } else {
    const idx = Math.floor(Math.random() * DEFAULT_QUOTES.length);
    const pick = DEFAULT_QUOTES[idx];
    // Negative, distinct ids so the client can key/animate each default quote.
    res.json({ id: -(idx + 1), text: pick.text, author: pick.author, createdAt: new Date().toISOString() });
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
