import type { Request, Response } from "express";

export function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

export function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

export function requireAdmin(req: Request, res: Response): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!isPlatformAdmin(userId)) {
    res.status(403).json({ error: "Solo l'amministratore della piattaforma può eseguire questa azione" });
    return null;
  }
  return userId;
}
