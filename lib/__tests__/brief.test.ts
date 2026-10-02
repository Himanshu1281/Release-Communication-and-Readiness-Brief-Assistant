import { describe, it, expect } from "vitest";
import { buildBrief, type BriefStatement } from "../brief";
import type { CheckResult } from "../checks";

const s = (id: string, over: Partial<BriefStatement> = {}): BriefStatement => ({
  id,
  kind: "TECH_SUMMARY",
  text: `original ${id}`,
  citations: [{ itemId: "F-1", hash: "h" }],
  uncited: false,
  status: "APPROVED",
  stale: false,
  ...over,
});
const warn: CheckResult = { id: "uncovered:F-2", severity: "warning", message: "F-2 has no QA", itemIds: ["F-2"] };
const err: CheckResult = { id: "required:migrationNotes", severity: "error", message: "empty", itemIds: [] };
const input = (statements: BriefStatement[], checks: CheckResult[] = []) => ({
  releaseName: "R",
  versionNumber: 2,
  checks,
  statements,
});

describe("buildBrief", () => {
  it("includes only approved, non-stale statements", () => {
    const r = buildBrief(
      input([s("a"), s("p", { status: "PENDING" }), s("r", { status: "REJECTED" }), s("st", { status: "PENDING", stale: true })]),
    );
    expect(r.ok && r.statementIds).toEqual(["a"]);
    expect(r.ok && r.markdown).not.toContain("original p");
  });

  it("uses edited text over the original", () => {
    const r = buildBrief(input([s("a", { editedText: "human wording" })]));
    expect(r.ok && r.markdown).toContain("human wording");
    expect(r.ok && r.markdown).not.toContain("original a");
  });

  it("is blocked by deterministic errors", () => {
    expect(buildBrief(input([s("a")], [err]))).toEqual({ ok: false, reasons: ["Deterministic checks have errors."] });
  });

  it("is not blocked by warnings, and lists them", () => {
    const r = buildBrief(input([s("a")], [warn]));
    expect(r.ok && r.markdown).toContain("F-2 has no QA");
  });

  it("is blocked when an approved statement is stale", () => {
    const r = buildBrief(input([s("a"), s("b", { stale: true })]));
    expect(r).toEqual({ ok: false, reasons: ["1 approved statement(s) are stale."] });
  });

  it("is blocked with no approved statements", () => {
    expect(buildBrief(input([s("a", { status: "PENDING" })]))).toEqual({ ok: false, reasons: ["No approved statements."] });
  });

  it("is deterministic", () => {
    const i = input([s("a"), s("b", { kind: "RISK", severity: "HIGH" })], [warn]);
    expect(buildBrief(i)).toEqual(buildBrief(i));
  });
});
