import { diffWords, type Change } from "diff";
import { hashItem } from "./hash";
import { SECTIONS, type ReleasePackage, type SectionKey } from "./package";

export type ItemDiffStatus = "added" | "removed" | "modified" | "unchanged";

export type ItemDiff = {
  id: string;
  status: ItemDiffStatus;
  before?: string;
  after?: string;
  textDiff?: Change[]; // only for modified items
};

export type SectionDiff = { section: SectionKey; label: string; items: ItemDiff[] };

const display = (it: { text: string; covers?: string[] }) =>
  it.covers?.length ? `${it.text} [covers: ${it.covers.join(", ")}]` : it.text;

/** Compare two packages item by item, matched on stable ID within each section. */
export function diffPackages(a: ReleasePackage, b: ReleasePackage): SectionDiff[] {
  return SECTIONS.map(({ key, label }) => {
    const before = new Map(a[key].map((it) => [it.id, it]));
    const after = new Map(b[key].map((it) => [it.id, it]));
    const items: ItemDiff[] = [];

    for (const [id, old] of before) {
      const cur = after.get(id);
      if (!cur) {
        items.push({ id, status: "removed", before: display(old) });
      } else if (hashItem(old) !== hashItem(cur)) {
        items.push({
          id,
          status: "modified",
          before: display(old),
          after: display(cur),
          textDiff: diffWords(display(old), display(cur)),
        });
      } else {
        items.push({ id, status: "unchanged", before: display(old), after: display(cur) });
      }
    }
    for (const [id, cur] of after) {
      if (!before.has(id)) items.push({ id, status: "added", after: display(cur) });
    }
    return { section: key, label, items };
  });
}
