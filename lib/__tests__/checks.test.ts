import { describe, it, expect } from "vitest";
import { runChecks, hasErrors } from "../checks";
import { ReleasePackageSchema } from "../package";
import { SAMPLE_PACKAGE } from "../sample";

const base = () =>
  ReleasePackageSchema.parse({
    features: [{ id: "F-1", text: "Export" }],
    qaSummary: [{ id: "QA-1", text: "Tested", covers: ["F-1"] }],
    knownLimitations: [{ id: "L-1", text: "None" }],
    migrationNotes: [{ id: "M-1", text: "None" }],
    affectedGroups: [{ id: "G-1", text: "Admins" }],
  });

const ids = (pkg: ReturnType<typeof base>) => runChecks(pkg).map((c) => `${c.severity}:${c.id}`);

describe("runChecks", () => {
  it("passes a complete package", () => {
    expect(runChecks(base())).toEqual([]);
  });

  it("explicit 'None' counts as filled", () => {
    const pkg = base();
    expect(pkg.migrationNotes[0].text).toBe("None");
    expect(ids(pkg)).not.toContain("error:required:migrationNotes");
  });

  it("flags each missing required section as an error", () => {
    const pkg = { ...base(), qaSummary: [], knownLimitations: [], migrationNotes: [], affectedGroups: [] };
    expect(ids(pkg)).toEqual(
      expect.arrayContaining([
        "error:required:qaSummary",
        "error:required:knownLimitations",
        "error:required:migrationNotes",
        "error:required:affectedGroups",
      ]),
    );
  });

  it("treats a blank-text item as empty", () => {
    const pkg = { ...base(), migrationNotes: [{ id: "M-1", text: "   " }] };
    expect(ids(pkg)).toContain("error:required:migrationNotes");
  });

  it("errors when there are no changes", () => {
    const pkg = { ...base(), features: [], qaSummary: [{ id: "QA-1", text: "x", covers: [] }] };
    expect(ids(pkg)).toContain("error:no-changes");
  });

  it("warns on change items with no QA coverage", () => {
    const pkg = { ...base(), bugFixes: [{ id: "B-1", text: "Fix" }] };
    const r = runChecks(pkg).find((c) => c.id === "uncovered:B-1");
    expect(r).toMatchObject({ severity: "warning", itemIds: ["B-1"] });
    expect(hasErrors(runChecks(pkg))).toBe(false);
  });

  it("errors on dangling covers references", () => {
    const pkg = { ...base(), qaSummary: [{ id: "QA-1", text: "t", covers: ["F-1", "F-9"] }] };
    expect(ids(pkg)).toContain("error:dangling:QA-1:F-9");
  });

  it("errors on duplicate and empty IDs", () => {
    const pkg = {
      ...base(),
      features: [
        { id: "F-1", text: "a" },
        { id: "F-1", text: "b" },
        { id: "", text: "c" },
      ],
    };
    expect(ids(pkg)).toEqual(expect.arrayContaining(["error:duplicate:F-1", "error:empty-ids"]));
  });

  it("catches the planted problems in the sample", () => {
    const r = ids(SAMPLE_PACKAGE);
    expect(r).toContain("error:required:migrationNotes");
    expect(r).toContain("warning:uncovered:F-2");
    expect(r).toContain("warning:uncovered:C-1");
    expect(r).not.toContain("warning:uncovered:F-1");
  });
});
