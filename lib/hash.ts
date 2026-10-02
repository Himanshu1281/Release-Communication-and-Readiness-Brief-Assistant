import { createHash } from "crypto";
import { allItems, type ReleasePackage } from "./package";

/** Whitespace-insensitive, case-sensitive: "Fixed  bug " and "Fixed bug" hash the same. */
export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** hash(item) = sha256(normalize(text) + JSON(sorted covers)). Covers order doesn't matter. */
export function hashItem(item: { text: string; covers?: string[] }): string {
  const covers = [...(item.covers ?? [])].sort();
  return createHash("sha256").update(normalize(item.text) + JSON.stringify(covers)).digest("hex");
}

export type ItemHashes = Record<string, string>;

export function hashPackage(pkg: ReleasePackage): ItemHashes {
  const out: ItemHashes = {};
  for (const it of allItems(pkg)) if (it.id) out[it.id] = hashItem(it);
  return out;
}
