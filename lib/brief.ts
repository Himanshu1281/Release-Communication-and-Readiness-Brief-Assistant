import { hasErrors, type CheckResult } from "./checks";
import type { StatementLike } from "./staleness";

export type BriefStatement = StatementLike & { stale: boolean };

export type BriefInput = {
  releaseName: string;
  versionNumber: number;
  checks: CheckResult[];
  statements: BriefStatement[];
};

export type BriefResult =
  | { ok: true; markdown: string; statementIds: string[] }
  | { ok: false; reasons: string[] };

/** Gating rules, also used by the UI checklist. Empty array = OK to generate. */
export function briefBlockers({ checks, statements }: Pick<BriefInput, "checks" | "statements">): string[] {
  const reasons: string[] = [];
  if (hasErrors(checks)) reasons.push("Deterministic checks have errors.");
  const approved = statements.filter((s) => s.status === "APPROVED");
  const staleApproved = approved.filter((s) => s.stale);
  if (staleApproved.length) reasons.push(`${staleApproved.length} approved statement(s) are stale.`);
  if (approved.length - staleApproved.length === 0) reasons.push("No approved statements.");
  return reasons;
}

const SECTIONS: { kind: string; title: string }[] = [
  { kind: "STAKEHOLDER_SUMMARY", title: "Summary for stakeholders" },
  { kind: "TECH_SUMMARY", title: "Technical summary" },
  { kind: "CLASSIFICATION", title: "Change impact" },
  { kind: "RISK", title: "Risks" },
  { kind: "GAP", title: "Open gaps" },
  { kind: "UNSUPPORTED_CLAIM", title: "Claims not supported by QA" },
];

const textOf = (s: BriefStatement) => (s.editedText?.trim() ? s.editedText.trim() : s.text);
const cites = (s: BriefStatement) =>
  s.citations.length ? ` _(${s.citations.map((c) => c.itemId).join(", ")})_` : "";
const prefix = (s: BriefStatement) =>
  s.kind === "CLASSIFICATION" && s.impact
    ? `**${s.impact}** ${s.citations[0]?.itemId ?? ""}: `
    : s.kind === "RISK" && s.severity
      ? `**${s.severity}** `
      : "";

/** Template assembly only; no LLM. Same input always produces the same markdown. */
export function buildBrief(input: BriefInput): BriefResult {
  const reasons = briefBlockers(input);
  if (reasons.length) return { ok: false, reasons };

  const included = input.statements.filter((s) => s.status === "APPROVED" && !s.stale);
  const warnings = input.checks.filter((c) => c.severity === "warning");

  const lines = [`# Release brief: ${input.releaseName} (v${input.versionNumber})`, ""];
  for (const { kind, title } of SECTIONS) {
    const group = included.filter((s) => s.kind === kind);
    if (!group.length) continue;
    lines.push(`## ${title}`, "", ...group.map((s) => `- ${prefix(s)}${textOf(s)}${cites(s)}`), "");
  }
  if (warnings.length) {
    lines.push("## Check warnings", "", ...warnings.map((w) => `- ${w.message}`), "");
  }
  lines.push(`---`, `_Built from ${included.length} human-approved statement(s)._`, "");

  return { ok: true, markdown: lines.join("\n"), statementIds: included.map((s) => s.id) };
}
