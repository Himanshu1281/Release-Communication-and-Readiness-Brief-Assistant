import { route } from "@/lib/api";
import { runAnalysis } from "@/lib/services/analysis";
import { assertAnalyzeAllowed } from "@/lib/services/rate-limit";
import { assertLatest, getVersionOr404 } from "@/lib/services/versions";

export const maxDuration = 60;

// Runs even when deterministic checks have errors: the AI review is still useful
// for fixing the package. Only the final brief is gated on check errors.
export const POST = route(async (_req, { params, log }) => {
  const version = await getVersionOr404(params.id);
  await assertLatest(version);
  await assertAnalyzeAllowed(version.id);
  return runAnalysis({ version, log });
});
