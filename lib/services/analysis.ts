import type { PrismaClient, ReleaseVersion, StatementKind } from "@prisma/client";
import { prisma } from "../db";
import { ApiError, json } from "../api";
import { validateCitations, type RawStatement } from "../citations";
import type { ItemHashes } from "../hash";
import type { Logger } from "../logger";
import { getProvider, loadPrompts } from "../llm";
import { callValidated, LlmOutputError } from "../llm/parse";
import { AnalysisOutput, SummariesOutput } from "../llm/schemas";
import type { LlmProvider, LlmUsage } from "../llm/types";

// Vercel Hobby functions stop at 60s; leave headroom to record a FAILED run.
const TIMEOUT_MS = 55_000;

type Draft = RawStatement & {
  kind: StatementKind;
  impact?: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  severity?: "HIGH" | "MEDIUM" | "LOW";
};

/** Map validated model output to statement drafts. Only whitelisted fields are copied. */
export function toDrafts(a: AnalysisOutput, s: SummariesOutput): Draft[] {
  return [
    ...a.classifications.map((c) => ({ kind: "CLASSIFICATION" as const, impact: c.impact, text: c.reason, citations: [c.itemId] })),
    ...a.gaps.map((g) => ({ kind: "GAP" as const, text: g.text, citations: g.citations })),
    ...a.unsupportedClaims.map((u) => ({ kind: "UNSUPPORTED_CLAIM" as const, text: u.text, citations: u.citations })),
    ...a.risks.map((r) => ({ kind: "RISK" as const, severity: r.severity, text: r.text, citations: r.citations })),
    ...s.technical.map((t) => ({ kind: "TECH_SUMMARY" as const, text: t.text, citations: t.citations })),
    ...s.stakeholder.map((t) => ({ kind: "STAKEHOLDER_SUMMARY" as const, text: t.text, citations: t.citations })),
  ];
}

type Db = Pick<PrismaClient, "analysisRun" | "statement" | "$transaction">;

/**
 * Run both AI calls for a version and store the results as PENDING statements.
 * This function never writes to ReleaseVersion, so it cannot change readiness.
 * Re-running replaces this version's untouched (PENDING, unedited) statements and
 * keeps anything a human has approved, rejected, or edited.
 */
export async function runAnalysis(opts: {
  version: ReleaseVersion;
  log: Logger;
  db?: Db;
  provider?: LlmProvider;
  timeoutMs?: number;
}) {
  const { version, log, db = prisma, provider = getProvider(), timeoutMs = TIMEOUT_MS } = opts;
  const prompts = loadPrompts();
  const started = Date.now();

  const run = await db.analysisRun.create({
    data: { versionId: version.id, status: "RUNNING", model: provider.model, promptVer: prompts.version, promptHash: prompts.hash },
  });
  const ctx = { runId: run.id, versionId: version.id, provider: provider.name, model: provider.model, promptVer: prompts.version };
  log.info(ctx, "ai.run.started");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const input = JSON.stringify(version.package);
  const common = { provider, input, signal: controller.signal, log: log.child({ runId: run.id }) };

  // The two calls are independent, so run them in parallel. allSettled keeps the raw
  // output of one call even when the other fails.
  const [a, s] = await Promise.allSettled([
    callValidated({ ...common, task: "analysis", system: prompts.analysis, schema: AnalysisOutput }),
    callValidated({ ...common, task: "summaries", system: prompts.summaries, schema: SummariesOutput }),
  ]);
  clearTimeout(timer);

  const attemptsOf = (r: typeof a | typeof s) =>
    r.status === "fulfilled" ? r.value.attempts : r.reason instanceof LlmOutputError ? r.reason.attempts : [];
  const rawOutput = { analysis: attemptsOf(a), summaries: attemptsOf(s) };
  const durationMs = Date.now() - started;

  if (a.status === "rejected" || s.status === "rejected") {
    const err = (a.status === "rejected" ? a.reason : (s as PromiseRejectedResult).reason) as Error;
    const message = controller.signal.aborted ? `AI run timed out after ${timeoutMs / 1000}s` : err.message;
    await db.analysisRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, durationMs, rawOutput: json(rawOutput) } });
    log.error({ ...ctx, durationMs, error: message }, "ai.run.failed");
    throw new ApiError(502, "AI_RUN_FAILED", message, { runId: run.id });
  }

  const usage: LlmUsage = {
    inputTokens: a.value.usage.inputTokens + s.value.usage.inputTokens,
    outputTokens: a.value.usage.outputTokens + s.value.usage.outputTokens,
  };

  const { kept, dropped } = validateCitations(toDrafts(a.value.data, s.value.data), version.itemHashes as ItemHashes);
  for (const d of dropped) log.warn({ ...ctx, kind: d.kind, unknownIds: d.unknownIds, text: d.text }, "ai.citation_invalid");

  await db.$transaction([
    db.statement.deleteMany({ where: { versionId: version.id, status: "PENDING", editedText: null } }),
    db.statement.createMany({
      data: kept.map((k) => ({
        versionId: version.id,
        runId: run.id,
        kind: k.kind,
        impact: k.impact ?? null,
        severity: k.severity ?? null,
        text: k.text,
        citations: json(k.citations),
        uncited: k.uncited,
      })),
    }),
    db.analysisRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", durationMs, rawOutput: json(rawOutput) } }),
  ]);

  log.info(
    { ...ctx, durationMs, usage, statements: kept.length, droppedInvalid: dropped.length, uncited: kept.filter((k) => k.uncited).length },
    "ai.run.succeeded",
  );
  return { runId: run.id, statements: kept.length, droppedInvalid: dropped.length, durationMs };
}
