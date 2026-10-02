import pino from "pino";
import { randomUUID } from "crypto";

// JSON logs to stdout. Secrets are redacted defensively in case a config object is ever logged.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "release-readiness" },
  redact: {
    paths: ["*.apiKey", "*.ANTHROPIC_API_KEY", "*.OPENAI_API_KEY", "headers.authorization", "headers['x-api-key']"],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = pino.Logger;

/** Reuse an incoming x-request-id if present, otherwise generate one. */
export function getRequestId(headers?: Headers): string {
  return headers?.get("x-request-id") ?? randomUUID();
}

/** Child logger bound to a requestId; use one per API request. */
export function requestLogger(headers?: Headers): { log: Logger; requestId: string } {
  const requestId = getRequestId(headers);
  return { log: logger.child({ requestId }), requestId };
}
