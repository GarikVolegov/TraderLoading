import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

// Prefissi delle rotte che usano il fallback anonimo condiviso (userId IS NULL):
// senza gate, in produzione tutti i visitatori non autenticati leggerebbero e
// scriverebbero lo stesso bucket di dati.
export const ANONYMOUS_FALLBACK_PREFIXES = [
  "/backtest",
  "/checkins",
  "/checklist",
  "/ideas",
  "/journal",
  "/mission-templates",
  "/missions",
  "/profile",
  "/push",
  "/quotes",
  "/settings",
];

export function createProductionAuthGate(
  env: { NODE_ENV?: string | undefined } = process.env,
): RequestHandler {
  const enforce = env.NODE_ENV === "production";

  return function productionAuthGate(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!enforce || req.user) {
      next();
      return;
    }
    res.status(401).json({ error: "Autenticazione richiesta" });
  };
}
