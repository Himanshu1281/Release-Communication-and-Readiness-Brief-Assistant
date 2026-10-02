import { ReleasePackageSchema, type ReleasePackage } from "../package";
import type { AnalysisOutput, SummariesOutput } from "./schemas";
import type { LlmProvider, LlmRequest } from "./types";

/**
 * Deterministic stand-in for a real model (LLM_PROVIDER=mock). It applies simple
 * rules to the package, so it finds the planted problems in the sample without a key.
 */
export const mockProvider: LlmProvider = {
  name: "mock",
  model: "mock-v1",
  async complete({ task, user }: LlmRequest) {
    const pkg = ReleasePackageSchema.parse(JSON.parse(user.split("\n\n")[0]));
    const out = task === "analysis" ? mockAnalysis(pkg) : mockSummaries(pkg);
    return { text: JSON.stringify(out), usage: { inputTokens: 0, outputTokens: 0 } };
  },
};

const coveringQa = (pkg: ReleasePackage, id: string) => pkg.qaSummary.filter((q) => q.covers.includes(id));
const migrationIds = (pkg: ReleasePackage) => pkg.migrationNotes.map((m) => m.id);

function mockAnalysis(pkg: ReleasePackage): AnalysisOutput {
  const changes = [...pkg.features, ...pkg.bugFixes, ...pkg.changedBehaviour];
  const out: AnalysisOutput = { classifications: [], gaps: [], unsupportedClaims: [], risks: [] };

  for (const it of pkg.features) {
    out.classifications.push({ itemId: it.id, impact: "MEDIUM", reason: "New user-visible capability." });
  }
  for (const it of pkg.bugFixes) {
    out.classifications.push({ itemId: it.id, impact: "MEDIUM", reason: "Corrects behaviour users can see." });
  }
  for (const it of pkg.changedBehaviour) {
    out.classifications.push({ itemId: it.id, impact: "HIGH", reason: "Changes how existing users work." });
    if (!migrationIds(pkg).length) {
      out.gaps.push({ text: `${it.id} changes existing behaviour but there is no migration or communication note.`, citations: [it.id] });
    }
  }

  for (const it of changes) {
    const qa = coveringQa(pkg, it.id);
    if (/\d+(\.\d+)?\s*(x|%)|faster|fully tested/i.test(it.text)) {
      out.unsupportedClaims.push({
        text: `${it.id} makes a performance or completeness claim that QA does not measure.`,
        citations: [it.id, ...qa.map((q) => q.id)],
      });
    }
    for (const q of qa) {
      if (/\bonly\b/i.test(q.text)) {
        out.unsupportedClaims.push({
          text: `${it.id} is stated generally, but ${q.id} verified only a limited scope.`,
          citations: [it.id, q.id],
        });
      }
    }
  }

  out.gaps.push({ text: "No rollback guidance is provided.", citations: [] });
  for (const l of pkg.knownLimitations) out.risks.push({ text: l.text, severity: "MEDIUM", citations: [l.id] });
  for (const c of pkg.changedBehaviour) {
    out.risks.push({ text: `Users may be surprised by: ${c.text}`, severity: "HIGH", citations: [c.id] });
  }
  return out;
}

function mockSummaries(pkg: ReleasePackage): SummariesOutput {
  const changes = [...pkg.features, ...pkg.bugFixes, ...pkg.changedBehaviour];
  const groups = pkg.affectedGroups.map((g) => g.id);
  return {
    technical: [
      ...changes.map((c) => ({ text: c.text.replace(/,?\s*\d+x faster than before/i, "") + ".", citations: [c.id] })),
      ...pkg.migrationNotes.map((m) => ({ text: `Migration: ${m.text}.`, citations: [m.id] })),
      ...pkg.knownLimitations.map((l) => ({ text: `Limitation: ${l.text}.`, citations: [l.id] })),
    ],
    stakeholder: [
      ...pkg.features.map((f) => ({
        text: `New: ${f.text.replace(/,?\s*\d+x faster than before/i, "")}.`,
        citations: [f.id, ...groups],
      })),
      ...pkg.changedBehaviour.map((c) => ({ text: `Please note: ${c.text}.`, citations: [c.id, ...groups] })),
    ],
  };
}
