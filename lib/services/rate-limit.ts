import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../api";

// The app is public with no login, so this protects the LLM quota. Limits are read
// from the AnalysisRun table, not memory, because serverless instances don't share state.
export const COOLDOWN_SECONDS = Number(process.env.ANALYZE_COOLDOWN_SECONDS ?? 30);
export const MAX_PER_HOUR = Number(process.env.ANALYZE_MAX_PER_HOUR ?? 30);
// A RUNNING row older than this was killed mid-run (function timeout) and no longer blocks.
const RUNNING_STALE_SECONDS = 90;

type Db = Pick<PrismaClient, "analysisRun">;

export async function assertAnalyzeAllowed(versionId: string, db: Db = prisma, now = new Date()) {
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  const running = await db.analysisRun.findFirst({
    where: { versionId, status: "RUNNING", createdAt: { gt: ago(RUNNING_STALE_SECONDS) } },
  });
  if (running) throw new ApiError(409, "ANALYSIS_IN_PROGRESS", "An analysis is already running for this version.");

  const last = await db.analysisRun.findFirst({ where: { versionId }, orderBy: { createdAt: "desc" } });
  if (last) {
    const wait = Math.ceil(COOLDOWN_SECONDS - (now.getTime() - last.createdAt.getTime()) / 1000);
    if (wait > 0) {
      throw new ApiError(429, "RATE_LIMITED", `Please wait ${wait}s before running analysis again.`, { retryAfterSeconds: wait });
    }
  }

  const lastHour = await db.analysisRun.count({ where: { createdAt: { gt: ago(3600) } } });
  if (lastHour >= MAX_PER_HOUR) {
    throw new ApiError(429, "RATE_LIMITED", "The hourly analysis limit for this demo has been reached. Please try again later.", {
      retryAfterSeconds: 3600,
    });
  }
}
