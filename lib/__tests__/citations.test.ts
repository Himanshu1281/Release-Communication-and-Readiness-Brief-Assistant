import { describe, it, expect } from "vitest";
import { validateCitations } from "../citations";
import { hashPackage } from "../hash";
import { SAMPLE_PACKAGE } from "../sample";

const hashes = hashPackage(SAMPLE_PACKAGE);

describe("validateCitations", () => {
  it("drops statements citing unknown IDs", () => {
    const { kept, dropped } = validateCitations(
      [
        { kind: "RISK", text: "ok", citations: ["L-1"] },
        { kind: "RISK", text: "invented", citations: ["L-1", "F-99"] },
      ],
      hashes,
    );
    expect(kept.map((s) => s.text)).toEqual(["ok"]);
    expect(dropped).toEqual([{ kind: "RISK", text: "invented", unknownIds: ["F-99"] }]);
  });

  it("stamps citations with the current item hash and dedupes", () => {
    const { kept } = validateCitations([{ kind: "RISK", text: "x", citations: ["F-1", "F-1"] }], hashes);
    expect(kept[0].citations).toEqual([{ itemId: "F-1", hash: hashes["F-1"] }]);
  });

  it("flags uncited statements, except GAPs", () => {
    const { kept } = validateCitations(
      [
        { kind: "TECH_SUMMARY", text: "a", citations: [] },
        { kind: "GAP", text: "b", citations: [] },
      ],
      hashes,
    );
    expect(kept.map((s) => s.uncited)).toEqual([true, false]);
  });

  it("preserves extra fields such as impact", () => {
    const { kept } = validateCitations([{ kind: "CLASSIFICATION", text: "a", citations: ["C-1"], impact: "HIGH" }], hashes);
    expect(kept[0].impact).toBe("HIGH");
  });
});
