import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { requestContext } from "../lib/logger";
import logger from "../lib/logger";

/**
 * loggingMiddleware
 * -----------------
 * 1. Legge X-Request-Id dall'header in entrata (utile se il load-balancer
 *    o il frontend lo propagano già), altrimenti genera un nuovo UUID v4.
 * 2. Salva il contesto in AsyncLocalStorage così `logger` lo include
 *    automaticamente in ogni log emesso durante quella richiesta.
 * 3. Aggiunge X-Request-Id alla risposta per il debug lato client.
 * 4. Loga inizio e fine di ogni richiesta con metodo, path, status e durata.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID();

  const ctx = {
    requestId,
    method: req.method,
    path: req.path,
  };

  res.setHeader("X-Request-Id", requestId);

  requestContext.run(ctx, () => {
    const startAt = Date.now();

    logger.info({ event: "request.start" }, `→ ${req.method} ${req.originalUrl}`);

    res.on("finish", () => {
      const durationMs = Date.now() - startAt;
      const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

      logger[logLevel](
        { event: "request.end", statusCode: res.statusCode, durationMs },
        `← ${req.method} ${req.originalUrl} ${res.statusCode} (${durationMs}ms)`,
      );
    });

    next();
  });
}
