import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { requestContext } from "../lib/logger";
import logger from "../lib/logger";

export function sanitizeRequestLogPath(req: Pick<Request, "path" | "originalUrl">): string {
  return req.path || req.originalUrl.split("?")[0] || "/";
}

/**
 * Adds a request id, stores request context, and logs request lifecycle without
 * query strings so bearer tokens or connector tokens cannot leak into logs.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  const logPath = sanitizeRequestLogPath(req);

  const ctx = {
    requestId,
    method: req.method,
    path: logPath,
  };

  res.setHeader("X-Request-Id", requestId);

  requestContext.run(ctx, () => {
    const startAt = Date.now();

    logger.info({ event: "request.start" }, `-> ${req.method} ${logPath}`);

    res.on("finish", () => {
      const durationMs = Date.now() - startAt;
      const logLevel =
        res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

      logger[logLevel](
        { event: "request.end", statusCode: res.statusCode, durationMs },
        `<- ${req.method} ${logPath} ${res.statusCode} (${durationMs}ms)`,
      );
    });

    next();
  });
}
