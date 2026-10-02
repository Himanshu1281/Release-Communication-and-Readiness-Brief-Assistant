import { z } from "zod";

// Guardrail: these schemas deliberately have NO status/approval/readiness fields.
// z.object() strips unknown keys, so `"status": "APPROVED"` in model output is discarded.
const Cited = z.object({
  text: z.string().trim().min(1),
  citations: z.array(z.string()).default([]),
});

export const AnalysisOutput = z.object({
  classifications: z.array(
    z.object({
      itemId: z.string().trim().min(1),
      impact: z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]),
      reason: z.string().trim().min(1),
    }),
  ),
  gaps: z.array(Cited),
  unsupportedClaims: z.array(Cited),
  risks: z.array(Cited.extend({ severity: z.enum(["HIGH", "MEDIUM", "LOW"]) })),
});

export const SummariesOutput = z.object({
  technical: z.array(Cited),
  stakeholder: z.array(Cited),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutput>;
export type SummariesOutput = z.infer<typeof SummariesOutput>;
