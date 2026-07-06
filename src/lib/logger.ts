import "server-only";
import pino from "pino";

// pino-pretty is a dev-only dependency; in production we emit plain JSON
// lines, which is what log aggregators (Datadog, CloudWatch, etc.) expect.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
      : undefined,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});
