import { z } from "zod";

// IDs are free-form strings here on purpose: empty or duplicate IDs are reported
// by checks.ts as errors instead of being rejected at parse time, so the user sees why.
export const ItemSchema = z.object({
  id: z.string().trim(),
  text: z.string(),
});

export const QaItemSchema = ItemSchema.extend({
  covers: z.array(z.string().trim()).default([]),
});

export const ReleasePackageSchema = z.object({
  features: z.array(ItemSchema).default([]),
  bugFixes: z.array(ItemSchema).default([]),
  changedBehaviour: z.array(ItemSchema).default([]),
  qaSummary: z.array(QaItemSchema).default([]),
  knownLimitations: z.array(ItemSchema).default([]),
  migrationNotes: z.array(ItemSchema).default([]),
  affectedGroups: z.array(ItemSchema).default([]),
});

export type Item = z.infer<typeof ItemSchema>;
export type QaItem = z.infer<typeof QaItemSchema>;
export type ReleasePackage = z.infer<typeof ReleasePackageSchema>;
export type SectionKey = keyof ReleasePackage;

export const SECTIONS: { key: SectionKey; label: string; prefix: string }[] = [
  { key: "features", label: "Features", prefix: "F" },
  { key: "bugFixes", label: "Bug fixes", prefix: "B" },
  { key: "changedBehaviour", label: "Changed behaviour", prefix: "C" },
  { key: "qaSummary", label: "QA summary", prefix: "QA" },
  { key: "knownLimitations", label: "Known limitations", prefix: "L" },
  { key: "migrationNotes", label: "Migration notes", prefix: "M" },
  { key: "affectedGroups", label: "Affected groups", prefix: "G" },
];

/** Sections whose items describe changes; these need QA coverage. */
export const CHANGE_SECTIONS: SectionKey[] = ["features", "bugFixes", "changedBehaviour"];

export type FlatItem = { id: string; text: string; covers?: string[]; section: SectionKey };

/** All items across sections, in section order. */
export function allItems(pkg: ReleasePackage): FlatItem[] {
  return SECTIONS.flatMap(({ key }) =>
    (pkg[key] as (Item | QaItem)[]).map((it) => ({ ...it, section: key })),
  );
}

/** Next auto ID for a section, e.g. F-3. Never reuses a number already present. */
export function nextId(pkg: ReleasePackage, section: SectionKey): string {
  const prefix = SECTIONS.find((s) => s.key === section)!.prefix;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = pkg[section].reduce((m, it) => {
    const n = re.exec(it.id)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `${prefix}-${max + 1}`;
}
