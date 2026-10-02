import { describe, it, expect, vi } from "vitest";
import pino from "pino";
import type { ReleaseVersion } from "@prisma/client";
import { parseOutput, callValidated, LlmOutputError } from "../llm/parse";
import { AnalysisOutput } from "../llm/schemas";
import { mockProvider } from "../llm/mock";
import { runAnalysis } from "../services/analysis";
import { hashPackage } from "../hash";
import { SAMPLE_PACKAGE } from "../sample";
import type { LlmProvider } from "../llm/types";

const log = pino({ level: "silent" });
const signal = new AbortController().signal;

const validAnalysis = {
  classifications: [{ itemId: "F-1", impact: "MEDIUM", reason: "visible" }],
  gaps: [],
  unsupportedClaims: [],
  risks: [{ text: "cap", severity: "LOW", citations: ["L-1"] }],
};

/** Provider that returns the given responses in order. */
const scripted = (...texts: string[]): LlmProvider & { complete: ReturnType<typeof vi.fn> } => {
  const complete = vi.fn();
  texts.forEach((t) => complete.mockResolvedValueOnce({ text: t, usage: { inputTokens: 1, outputTokens: 1 } }));
  return { name: "test", model: "test-model", complete };
};

describe("parseOutput", () => {
  it("parses valid output, including fenced JSON", () => {
    expect(parseOutput(JSON.stringify(validAnalysis), AnalysisOutput).ok).toBe(true);
    expect(parseOutput("```json\n" + JSON.stringify(validAnalysis) + "\n```", AnalysisOutput).ok).toBe(true);
  });

  it("reports non-JSON and schema errors", () => {
    expect(parseOutput("Sure! Here you go", AnalysisOutput)).toMatchObject({ ok: false });
    const r = parseOutput(JSON.stringify({ ...validAnalysis, classifications: [{ itemId: "F-1", impact: "HUGE", reason: "x" }] }), AnalysisOutput);
    expect(r.ok === false && r.error).toContain("classifications.0.impact");
  });

  it("strips injected approval fields", () => {
    const injected = {
      ...validAnalysis,
      status: "APPROVED",
      readiness: "READY_FOR_RELEASE",
      risks: [{ text: "cap", severity: "LOW", citations: ["L-1"], status: "APPROVED", approved: true }],
    };
    const r = parseOutput(JSON.stringify(injected), AnalysisOutput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).not.toHaveProperty("status");
    expect(r.data).not.toHaveProperty("readiness");
    expect(r.data.risks[0]).toEqual({ text: "cap", severity: "LOW", citations: ["L-1"] });
  });
});

describe("callValidated", () => {
  const call = (p: LlmProvider) =>
    callValidated({ provider: p, task: "analysis", system: "sys", input: "{}", schema: AnalysisOutput, signal, log });

  it("retries once with the validation error, then succeeds", async () => {
    const p = scripted("not json", JSON.stringify(validAnalysis));
    const r = await call(p);
    expect(r.attempts).toHaveLength(2);
    expect(p.complete.mock.calls[1][0].user).toContain("Your previous response was invalid");
  });

  it("throws with both raw attempts after a second failure", async () => {
    const p = scripted("bad 1", "bad 2");
    const err = await call(p).catch((e) => e);
    expect(err).toBeInstanceOf(LlmOutputError);
    expect(err.attempts).toEqual(["bad 1", "bad 2"]);
    expect(p.complete).toHaveBeenCalledTimes(2);
  });
});

describe("runAnalysis", () => {
  const version = {
    id: "v1",
    package: SAMPLE_PACKAGE,
    itemHashes: hashPackage(SAMPLE_PACKAGE),
  } as unknown as ReleaseVersion;

  const fakeDb = () => {
    const db = {
      analysisRun: { create: vi.fn().mockResolvedValue({ id: "run1" }), update: vi.fn() },
      statement: { deleteMany: vi.fn(), createMany: vi.fn() },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    };
    return db;
  };

  it("marks the run FAILED and stores raw output when validation fails twice", async () => {
    const db = fakeDb();
    const p: LlmProvider = {
      name: "test",
      model: "m",
      complete: async ({ task }) => ({
        text: task === "analysis" ? "garbage" : JSON.stringify({ technical: [], stakeholder: [] }),
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
    };
    const err = await runAnalysis({ version, log, db: db as never, provider: p }).catch((e) => e);
    expect(err.code).toBe("AI_RUN_FAILED");
    const { data } = db.analysisRun.update.mock.calls[0][0];
    expect(data.status).toBe("FAILED");
    expect(data.rawOutput.analysis).toEqual(["garbage", "garbage"]);
    expect(db.statement.createMany).not.toHaveBeenCalled();
  });

  it("marks the run FAILED on timeout", async () => {
    const db = fakeDb();
    const p: LlmProvider = {
      name: "slow",
      model: "m",
      complete: ({ signal }) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    };
    const err = await runAnalysis({ version, log, db: db as never, provider: p, timeoutMs: 20 }).catch((e) => e);
    expect(err.message).toContain("timed out");
    expect(db.analysisRun.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("drops invalid citations and never sets a status on new statements", async () => {
    const db = fakeDb();
    const evil = JSON.stringify({
      ...validAnalysis,
      status: "APPROVED",
      gaps: [{ text: "invented", citations: ["F-99"], status: "APPROVED" }],
    });
    const p: LlmProvider = {
      name: "test",
      model: "m",
      complete: async ({ task }) => ({
        text: task === "analysis" ? evil : JSON.stringify({ technical: [{ text: "t", citations: [], status: "APPROVED" }], stakeholder: [] }),
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
    };
    await runAnalysis({ version, log, db: db as never, provider: p });
    const rows = db.statement.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { text: string }) => r.text)).not.toContain("invented");
    for (const r of rows) expect(r).not.toHaveProperty("status");
    expect(rows.find((r: { kind: string }) => r.kind === "TECH_SUMMARY").uncited).toBe(true);
  });

  it("mock provider finds the planted problems in the sample", async () => {
    const db = fakeDb();
    await runAnalysis({ version, log, db: db as never, provider: mockProvider });
    const rows: { kind: string; impact?: string; citations: { itemId: string }[] }[] = db.statement.createMany.mock.calls[0][0].data;
    const cites = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.citations.map((c) => c.itemId));
    expect(rows.find((r) => r.citations[0]?.itemId === "C-1" && r.kind === "CLASSIFICATION")?.impact).toBe("HIGH");
    expect(cites("UNSUPPORTED_CLAIM")).toEqual(expect.arrayContaining([["F-1", "QA-1"], ["B-1", "QA-2"]]));
    expect(cites("GAP")).toContainEqual(["C-1"]);
  });
});
