import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/api";
import { briefBlockers } from "@/lib/brief";
import type { CheckResult } from "@/lib/checks";
import { toStatementLike } from "@/lib/services/versions";

export const GET = route(async (_req, { params }) => {
  const version = await prisma.releaseVersion.findUnique({
    where: { id: params.id },
    include: {
      release: { select: { id: true, name: true } },
      statements: { orderBy: { createdAt: "asc" } },
      runs: { orderBy: { createdAt: "desc" }, take: 5, omit: { rawOutput: true } },
      briefs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!version) throw notFound("Version");

  const latest = await prisma.releaseVersion.aggregate({
    where: { releaseId: version.releaseId },
    _max: { versionNumber: true },
  });

  const { briefs, ...rest } = version;
  return {
    version: rest,
    isLatest: latest._max.versionNumber === version.versionNumber,
    latestBrief: briefs[0] ?? null,
    briefBlockers: briefBlockers({
      checks: version.checkResults as CheckResult[],
      statements: version.statements.map(toStatementLike),
    }),
  };
});
