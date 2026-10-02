import { describe, it, expect, vi } from "vitest";
import { assertAnalyzeAllowed, COOLDOWN_SECONDS, MAX_PER_HOUR } from "../services/rate-limit";

const now = new Date("2026-10-02T12:00:00Z");
const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);

const fakeDb = (opts: { running?: boolean; lastAt?: Date; hourCount?: number }) => ({
  analysisRun: {
    findFirst: vi.fn(async ({ where }: { where: { status?: string } }) =>
      where.status === "RUNNING" ? (opts.running ? { id: "r" } : null) : opts.lastAt ? { createdAt: opts.lastAt } : null,
    ),
    count: vi.fn(async () => opts.hourCount ?? 0),
  },
});

const check = (opts: Parameters<typeof fakeDb>[0]) => assertAnalyzeAllowed("v1", fakeDb(opts) as never, now);

describe("assertAnalyzeAllowed", () => {
  it("allows the first run", async () => {
    await expect(check({})).resolves.toBeUndefined();
  });

  it("rejects while a run is in progress", async () => {
    await expect(check({ running: true })).rejects.toMatchObject({ status: 409, code: "ANALYSIS_IN_PROGRESS" });
  });

  it("enforces the per-version cooldown and says how long to wait", async () => {
    await expect(check({ lastAt: secondsAgo(10) })).rejects.toMatchObject({
      status: 429,
      details: { retryAfterSeconds: COOLDOWN_SECONDS - 10 },
    });
    await expect(check({ lastAt: secondsAgo(COOLDOWN_SECONDS + 1) })).resolves.toBeUndefined();
  });

  it("enforces the global hourly cap", async () => {
    await expect(check({ hourCount: MAX_PER_HOUR })).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    await expect(check({ hourCount: MAX_PER_HOUR - 1 })).resolves.toBeUndefined();
  });
});
