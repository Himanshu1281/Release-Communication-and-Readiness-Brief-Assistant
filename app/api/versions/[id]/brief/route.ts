import { prisma } from "@/lib/db";
import { ApiError, created, json, notFound, route } from "@/lib/api";
import { buildBrief } from "@/lib/brief";
import type { CheckResult } from "@/lib/checks";
import { toStatementLike } from "@/lib/services/versions";

export const POST = route(async (_req, { params, log }) => {
  const version = await prisma.releaseVersion.findUnique({
    where: { id: params.id },
    include: { release: true, statements: { orderBy: { createdAt: "asc" } } },
  });
  if (!version) throw notFound("Version");

  const result = buildBrief({
    releaseName: version.release.name,
    versionNumber: version.versionNumber,
    checks: version.checkResults as CheckResult[],
    statements: version.statements.map(toStatementLike),
  });

  if (!result.ok) {
    log.warn({ versionId: version.id, reasons: result.reasons }, "brief.blocked");
    throw new ApiError(422, "BRIEF_BLOCKED", "The brief cannot be generated yet", { reasons: result.reasons });
  }

  const brief = await prisma.brief.create({
    data: { versionId: version.id, markdown: result.markdown, statementIds: json(result.statementIds) },
  });
  log.info({ versionId: version.id, briefId: brief.id, statementCount: result.statementIds.length }, "brief.generated");
  return created({ brief });
});
