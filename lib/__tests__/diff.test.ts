import { describe, it, expect } from "vitest";
import { diffPackages } from "../diff";
import { SAMPLE_PACKAGE } from "../sample";

describe("diffPackages", () => {
  const b = structuredClone(SAMPLE_PACKAGE);
  b.features[0].text = "Bulk CSV export for invoices";
  b.features.splice(1, 1); // remove F-2
  b.migrationNotes.push({ id: "M-1", text: "Set SESSION_IDLE_MINUTES" });
  const d = diffPackages(SAMPLE_PACKAGE, b);
  const status = (section: string, id: string) =>
    d.find((s) => s.section === section)!.items.find((i) => i.id === id)?.status;

  it("detects modified, removed, added, and unchanged items", () => {
    expect(status("features", "F-1")).toBe("modified");
    expect(status("features", "F-2")).toBe("removed");
    expect(status("migrationNotes", "M-1")).toBe("added");
    expect(status("bugFixes", "B-1")).toBe("unchanged");
  });

  it("includes a word diff for modified items", () => {
    const f1 = d[0].items.find((i) => i.id === "F-1")!;
    expect(f1.textDiff!.some((c) => c.removed && c.value.includes("3x"))).toBe(true);
  });

  it("treats a covers change as a modification", () => {
    const c = structuredClone(SAMPLE_PACKAGE);
    c.qaSummary[0].covers = ["F-1", "F-2"];
    expect(diffPackages(SAMPLE_PACKAGE, c).find((s) => s.section === "qaSummary")!.items[0].status).toBe("modified");
  });
});
