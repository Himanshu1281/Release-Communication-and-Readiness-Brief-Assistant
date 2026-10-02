import { allItems, CHANGE_SECTIONS, SECTIONS, type ReleasePackage, type SectionKey } from "./package";

export type CheckResult = {
  id: string;
  severity: "error" | "warning";
  message: string;
  itemIds: string[];
};

const REQUIRED: SectionKey[] = ["qaSummary", "knownLimitations", "migrationNotes", "affectedGroups"];

const label = (k: SectionKey) => SECTIONS.find((s) => s.key === k)!.label;

/** A section counts as filled if it has at least one item with non-blank text. "None" counts. */
const filled = (pkg: ReleasePackage, k: SectionKey) => pkg[k].some((it) => it.text.trim() !== "");

export function runChecks(pkg: ReleasePackage): CheckResult[] {
  const results: CheckResult[] = [];
  const items = allItems(pkg);

  // 1. Required sections
  for (const k of REQUIRED) {
    if (!filled(pkg, k)) {
      results.push({
        id: `required:${k}`,
        severity: "error",
        message: `${label(k)} is empty. Add an entry, or write "None" if that is deliberate.`,
        itemIds: [],
      });
    }
  }

  // 2. At least one change
  if (!CHANGE_SECTIONS.some((k) => filled(pkg, k))) {
    results.push({
      id: "no-changes",
      severity: "error",
      message: "The release has no features, bug fixes, or changed behaviour.",
      itemIds: [],
    });
  }

  // 5. Empty and duplicate IDs (run before coverage so the messages read in a sensible order)
  const empties = items.filter((it) => it.id === "");
  if (empties.length) {
    results.push({
      id: "empty-ids",
      severity: "error",
      message: `${empties.length} item(s) have an empty ID.`,
      itemIds: [],
    });
  }
  const seen = new Map<string, number>();
  for (const it of items) if (it.id) seen.set(it.id, (seen.get(it.id) ?? 0) + 1);
  for (const [id, n] of seen) {
    if (n > 1) {
      results.push({ id: `duplicate:${id}`, severity: "error", message: `ID ${id} is used ${n} times.`, itemIds: [id] });
    }
  }

  // 4. Dangling QA references
  for (const qa of pkg.qaSummary) {
    for (const ref of qa.covers) {
      if (!seen.has(ref)) {
        results.push({
          id: `dangling:${qa.id}:${ref}`,
          severity: "error",
          message: `${qa.id} covers ${ref}, which does not exist.`,
          itemIds: [qa.id],
        });
      }
    }
  }

  // 3. QA coverage
  const covered = new Set(pkg.qaSummary.flatMap((qa) => qa.covers));
  for (const k of CHANGE_SECTIONS) {
    for (const it of pkg[k]) {
      if (it.id && !covered.has(it.id)) {
        results.push({
          id: `uncovered:${it.id}`,
          severity: "warning",
          message: `${it.id} has no QA evidence (no QA item covers it).`,
          itemIds: [it.id],
        });
      }
    }
  }

  return results;
}

export const hasErrors = (r: CheckResult[]) => r.some((c) => c.severity === "error");
