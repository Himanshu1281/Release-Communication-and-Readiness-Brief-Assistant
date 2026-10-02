import type { ItemHashes } from "./hash";
import type { Citation } from "./staleness";

export type RawStatement = { kind: string; text: string; citations: string[] };

export type ValidatedStatement<T extends RawStatement> = Omit<T, "citations"> & {
  citations: Citation[];
  uncited: boolean;
};

export type InvalidCitation = { kind: string; text: string; unknownIds: string[] };

/**
 * Guardrail: a statement that cites any ID not in the package is dropped entirely,
 * because a reference to a nonexistent item means the model invented something.
 * Statements with zero citations are kept but flagged uncited (except GAP, where
 * "something is missing" may legitimately have nothing to cite).
 * Valid citations are stamped with the item hash at generation time, for staleness.
 */
export function validateCitations<T extends RawStatement>(
  statements: T[],
  hashes: ItemHashes,
): { kept: ValidatedStatement<T>[]; dropped: InvalidCitation[] } {
  const kept: ValidatedStatement<T>[] = [];
  const dropped: InvalidCitation[] = [];

  for (const s of statements) {
    const ids = [...new Set(s.citations.map((c) => c.trim()))];
    const unknownIds = ids.filter((id) => !(id in hashes));
    if (unknownIds.length) {
      dropped.push({ kind: s.kind, text: s.text, unknownIds });
      continue;
    }
    kept.push({
      ...s,
      citations: ids.map((itemId) => ({ itemId, hash: hashes[itemId] })),
      uncited: ids.length === 0 && s.kind !== "GAP",
    });
  }
  return { kept, dropped };
}
