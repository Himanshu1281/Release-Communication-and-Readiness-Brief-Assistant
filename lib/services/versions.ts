import type { Prisma, Statement, StatementKind } from "@prisma/client";
import { prisma } from "../db";
import { ApiError, json, notFound } from "../api";
import { runChecks, type CheckResult } from "../checks";
import { hashPackage } from "../hash";
import { carryOver, type Citation, type StatementLike } from "../staleness";
import type { ReleasePackage } from "../package";
import type { Logger } from "../logger";

type Tx = Prisma.TransactionClient;

export const toStatementLike = (s: Statement): StatementLike & { stale: boolean } => ({
  id: s.id,
  kind: s.kind,
  impact: s.impact,
  severity: s.severity,
  text: s.text,
  editedText: s.editedText,
  citations: s.citations as Citation[],
  uncited: s.uncited,
  status: s.status,
  runId: s.runId,
  reviewedAt: s.reviewedAt,
  stale: s.stale,
});

/**
 * Create the next version of a release. Must run inside a transaction: the version
 * row, its check results and item hashes, and the carried-over statements are
 * written together or not at all. Previous versions are only read, never updated.
 */
export async function createVersion(tx: Tx, releaseId: string, pkg: ReleasePackage) {
  const checks = runChecks(pkg);
  const hashes = hashPackage(pkg);

  const prev = await tx.releaseVersion.findFirst({
    where: { releaseId },
    orderBy: { versionNumber: "desc" },
    include: { statements: true },
  });

  const version = await tx.releaseVersion.create({
    data: {
      releaseId,
      versionNumber: (prev?.versionNumber ?? 0) + 1,
      package: json(pkg),
      itemHashes: json(hashes),
      checkResults: json(checks),
    },
  });

  const carried = prev ? carryOver(prev.statements.map(toStatementLike), hashes) : [];
  if (carried.length) {
    await tx.statement.createMany({
      data: carried.map((c) => ({
        ...c,
        kind: c.kind as StatementKind,
        impact: c.impact as Statement["impact"],
        severity: c.severity as Statement["severity"],
        citations: json(c.citations),
        versionId: version.id,
      })),
    });
  }

  return { version, checks, carriedCount: carried.length, staleCount: carried.filter((c) => c.stale).length };
}

export function logVersionCreated(
  log: Logger,
  r: { version: { id: string; releaseId: string; versionNumber: number }; checks: CheckResult[]; carriedCount: number; staleCount: number },
) {
  const { id: versionId, releaseId, versionNumber } = r.version;
  log.info({ releaseId, versionId, versionNumber, carriedCount: r.carriedCount, staleCount: r.staleCount }, "version.created");
  log.info(
    {
      versionId,
      errors: r.checks.filter((c) => c.severity === "error").length,
      warnings: r.checks.filter((c) => c.severity === "warning").length,
    },
    "checks.completed",
  );
}

/** Old versions are immutable snapshots: reviews and readiness only change on the latest one. */
export async function assertLatest(version: { releaseId: string; versionNumber: number }) {
  const newer = await prisma.releaseVersion.count({
    where: { releaseId: version.releaseId, versionNumber: { gt: version.versionNumber } },
  });
  if (newer > 0) {
    throw new ApiError(409, "VERSION_LOCKED", `v${version.versionNumber} is not the latest version and is read-only`);
  }
}

export async function getVersionOr404(id: string) {
  const v = await prisma.releaseVersion.findUnique({ where: { id } });
  if (!v) throw notFound("Version");
  return v;
}
