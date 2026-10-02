import { describe, it, expect } from "vitest";
import { carryOver, type StatementLike } from "../staleness";
import { hashPackage } from "../hash";
import { SAMPLE_PACKAGE } from "../sample";
import type { ReleasePackage } from "../package";

const v1 = SAMPLE_PACKAGE;
const h1 = hashPackage(v1);

const stmt = (id: string, itemIds: string[], status: StatementLike["status"] = "APPROVED"): StatementLike => ({
  id,
  kind: "RISK",
  text: `statement ${id}`,
  citations: itemIds.map((itemId) => ({ itemId, hash: h1[itemId] })),
  uncited: false,
  status,
  reviewedAt: new Date("2026-01-01"),
});

const withChange = (fn: (p: ReleasePackage) => void) => {
  const p = structuredClone(v1);
  fn(p);
  return hashPackage(p);
};

describe("carryOver", () => {
  it("keeps statements fresh and approved when cited items are unchanged", () => {
    const [s] = carryOver([stmt("s1", ["F-2"])], withChange((p) => (p.features[0].text = "edited")));
    expect(s).toMatchObject({ stale: false, staleReason: null, status: "APPROVED", carriedFrom: "s1" });
  });

  it("whitespace-only edits do not make statements stale", () => {
    const [s] = carryOver([stmt("s1", ["F-1"])], withChange((p) => (p.features[0].text += "   ")));
    expect(s.stale).toBe(false);
  });

  it("marks stale when a cited item changes, and resets to PENDING", () => {
    const [s] = carryOver([stmt("s1", ["F-1", "QA-1"])], withChange((p) => (p.features[0].text = "Export, 2x")));
    expect(s).toMatchObject({ stale: true, staleReason: "F-1 changed", status: "PENDING", reviewedAt: null });
  });

  it("marks stale when a cited item is removed", () => {
    const [s] = carryOver([stmt("s1", ["F-2"])], withChange((p) => p.features.splice(1, 1)));
    expect(s).toMatchObject({ stale: true, staleReason: "F-2 removed", status: "PENDING" });
  });

  it("marks QA statements stale when covers change", () => {
    const [s] = carryOver([stmt("s1", ["QA-1"])], withChange((p) => p.qaSummary[0].covers.push("F-2")));
    expect(s).toMatchObject({ stale: true, staleReason: "QA-1 changed" });
  });

  it("drops rejected statements and keeps pending ones pending", () => {
    const out = carryOver([stmt("r", ["F-1"], "REJECTED"), stmt("p", ["F-2"], "PENDING")], h1);
    expect(out.map((s) => s.carriedFrom)).toEqual(["p"]);
    expect(out[0].status).toBe("PENDING");
  });

  it("does not mutate the input statements", () => {
    const input = [stmt("s1", ["F-1"])];
    const snapshot = structuredClone(input);
    carryOver(input, withChange((p) => (p.features[0].text = "x")));
    expect(input).toEqual(snapshot);
  });
});
