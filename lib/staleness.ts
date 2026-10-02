import type { ItemHashes } from "./hash";

export type Citation = { itemId: string; hash: string };
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** The fields of a Statement that carry-over cares about. */
export type StatementLike = {
  id: string;
  kind: string;
  impact?: string | null;
  severity?: string | null;
  text: string;
  editedText?: string | null;
  citations: Citation[];
  uncited: boolean;
  status: ReviewStatus;
  runId?: string | null;
  reviewedAt?: Date | null;
};

export type CarriedStatement = Omit<StatementLike, "id"> & {
  carriedFrom: string;
  stale: boolean;
  staleReason: string | null;
};

/** Reasons a statement's citations no longer match the new version, e.g. ["F-2 changed"]. */
export function staleReasons(citations: Citation[], newHashes: ItemHashes): string[] {
  const reasons: string[] = [];
  for (const c of citations) {
    const h = newHashes[c.itemId];
    if (h === undefined) reasons.push(`${c.itemId} removed`);
    else if (h !== c.hash) reasons.push(`${c.itemId} changed`);
  }
  return reasons;
}

/**
 * Copy non-rejected statements from the previous version into a new one.
 * Citation hashes are kept as captured at generation time, so a statement stays
 * stale until it is regenerated; a fresh copy keeps its review status.
 * A stale copy is reset to PENDING so it must be re-reviewed.
 */
export function carryOver(prev: StatementLike[], newHashes: ItemHashes): CarriedStatement[] {
  return prev
    .filter((s) => s.status !== "REJECTED")
    .map(({ id, ...rest }) => {
      const reasons = staleReasons(rest.citations, newHashes);
      const stale = reasons.length > 0;
      return {
        ...rest,
        carriedFrom: id,
        stale,
        staleReason: stale ? reasons.join("; ") : null,
        status: stale ? "PENDING" : rest.status,
        reviewedAt: stale ? null : rest.reviewedAt ?? null,
      };
    });
}
