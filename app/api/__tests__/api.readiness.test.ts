import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  releaseVersion: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  analysisRun: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
  statement: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

// A model that tries to approve everything.
vi.mock("@/lib/llm", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm")>()),
  getProvider: () => ({
    name: "evil",
    model: "evil-1",
    complete: async ({ task }: { task: string }) => ({
      text: JSON.stringify(
        task === "analysis"
          ? { status: "APPROVED", readiness: "READY_FOR_RELEASE", classifications: [], gaps: [], unsupportedClaims: [], risks: [] }
          : { readiness: "READY_FOR_RELEASE", technical: [{ text: "Ship it", citations: ["F-1"], status: "APPROVED" }], stakeholder: [] },
      ),
      usage: { inputTokens: 0, outputTokens: 0 },
    }),
  }),
}));

import { POST } from "../versions/[id]/readiness/route";
import { POST as ANALYZE } from "../versions/[id]/analyze/route";
import { hashPackage } from "@/lib/hash";
import { SAMPLE_PACKAGE } from "@/lib/sample";

const call = (body: unknown) =>
  POST(new Request("http://test/api/versions/v1/readiness", { method: "POST", body: JSON.stringify(body) }), {
    params: { id: "v1" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  db.releaseVersion.findUnique.mockResolvedValue({ id: "v1", releaseId: "r1", versionNumber: 2, readiness: "DRAFT" });
  db.releaseVersion.count.mockResolvedValue(0);
  db.releaseVersion.update.mockImplementation(async ({ data }) => ({ id: "v1", ...data }));
});

describe("POST /api/versions/:id/readiness", () => {
  it("requires a reviewer name", async () => {
    const res = await call({ readiness: "READY_FOR_RELEASE", confirm: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(db.releaseVersion.update).not.toHaveBeenCalled();
  });

  it("rejects a blank reviewer name", async () => {
    const res = await call({ reviewerName: "   ", readiness: "READY_FOR_RELEASE", confirm: true });
    expect(res.status).toBe(400);
    expect(db.releaseVersion.update).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation", async () => {
    const res = await call({ reviewerName: "Asha", readiness: "READY_FOR_RELEASE", confirm: false });
    expect(res.status).toBe(400);
    expect(db.releaseVersion.update).not.toHaveBeenCalled();
  });

  it("rejects DRAFT and unknown fields", async () => {
    expect((await call({ reviewerName: "Asha", readiness: "DRAFT", confirm: true })).status).toBe(400);
    expect((await call({ reviewerName: "Asha", readiness: "NOT_READY", confirm: true, by: "AI" })).status).toBe(400);
  });

  it("records the reviewer and decision", async () => {
    const res = await call({ reviewerName: " Asha ", readiness: "NOT_READY", confirm: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const { data } = db.releaseVersion.update.mock.calls[0][0];
    expect(data).toMatchObject({ readiness: "NOT_READY", readinessBy: "Asha" });
    expect(data.readinessAt).toBeInstanceOf(Date);
  });

  it("refuses to change an old version", async () => {
    db.releaseVersion.count.mockResolvedValue(1);
    const res = await call({ reviewerName: "Asha", readiness: "READY_FOR_RELEASE", confirm: true });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("VERSION_LOCKED");
  });

  it("returns 404 in the standard error shape", async () => {
    db.releaseVersion.findUnique.mockResolvedValue(null);
    const res = await call({ reviewerName: "Asha", readiness: "READY_FOR_RELEASE", confirm: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Version not found", details: null } });
  });
});

describe("POST /api/versions/:id/analyze", () => {
  it("never changes readiness, even when the model asks it to", async () => {
    db.releaseVersion.findUnique.mockResolvedValue({
      id: "v1",
      releaseId: "r1",
      versionNumber: 1,
      readiness: "DRAFT",
      package: SAMPLE_PACKAGE,
      itemHashes: hashPackage(SAMPLE_PACKAGE),
    });
    db.analysisRun.create.mockResolvedValue({ id: "run1" });

    const res = await ANALYZE(new Request("http://test/api/versions/v1/analyze", { method: "POST" }), { params: { id: "v1" } });
    expect(res.status).toBe(200);

    expect(db.releaseVersion.update).not.toHaveBeenCalled();
    expect(db.releaseVersion.updateMany).not.toHaveBeenCalled();
    expect(db.releaseVersion.upsert).not.toHaveBeenCalled();
    const rows = db.statement.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("status");
    expect(rows[0]).not.toHaveProperty("readiness");
  });
});
