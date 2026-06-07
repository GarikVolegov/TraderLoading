import { Router, type IRouter } from "express";
import { db, loginAccessTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

/** Parse a User-Agent string into a human-readable device/browser label */
function parseAgent(ua?: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: "Sconosciuto", browser: "Sconosciuto", os: "Sconosciuto" };

  const mobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);
  const device = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";

  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\//i.test(ua) ? "Opera" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" :
    "Altro";

  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" :
    "Sconosciuto";

  return { device, browser, os };
}

router.get("/login-access", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const rows = await db
    .select()
    .from(loginAccessTable)
    .where(eq(loginAccessTable.userId, userId))
    .orderBy(desc(loginAccessTable.createdAt))
    .limit(20);

  const accesses = rows.map((r) => ({
    id: r.id,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
    ...parseAgent(r.userAgent),
  }));

  res.json({ accesses });
});

export default router;
