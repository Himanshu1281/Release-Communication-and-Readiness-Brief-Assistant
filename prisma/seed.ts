import { prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { mockProvider } from "../lib/llm/mock";
import type { ReleasePackage } from "../lib/package";
import { COMPARE_SAMPLE_V1, COMPARE_SAMPLE_V2, SAMPLE_PACKAGE } from "../lib/sample";
import { runAnalysis } from "../lib/services/analysis";
import { createVersion, logVersionCreated } from "../lib/services/versions";
import type { Citation } from "../lib/staleness";

/**
 * Seeds two demo releases. Idempotent: a release whose name already exists is skipped.
 * Analysis uses the deterministic mock provider, so seeding never spends LLM quota.
 *
 * 1. "Invoices 2.4 (sample)": v1 with a mock analysis, ready to review.
 * 2. "Mobile app 5.0 (compare sample)": v1 analysed with some statements approved,
 *    then v2, so the Compare tab shows a diff and approved statements going stale.
 */
async function seedRelease(name: string, versions: ReleasePackage[], approveCiting: string[] = []) {
  if (await prisma.release.findFirst({ where: { name } })) {
    logger.info({ name }, "seed.skipped (already exists)");
    return;
  }

  const first = await prisma.$transaction(async (tx) => {
    const release = await tx.release.create({ data: { name } });
    return { release, ...(await createVersion(tx, release.id, versions[0])) };
  });
  logger.info({ releaseId: first.release.id, name }, "release.created");
  logVersionCreated(logger, first);

  await runAnalysis({ version: first.version, log: logger, provider: mockProvider });

  // Simulate a reviewer: approve cited statements that touch the given items.
  if (approveCiting.length) {
    const statements = await prisma.statement.findMany({ where: { versionId: first.version.id, uncited: false } });
    const ids = statements
      .filter((s) => (s.citations as Citation[]).some((c) => approveCiting.includes(c.itemId)))
      .map((s) => s.id);
    await prisma.statement.updateMany({ where: { id: { in: ids } }, data: { status: "APPROVED", reviewedAt: new Date() } });
    logger.info({ name, approved: ids.length }, "seed.approved");
  }

  for (const pkg of versions.slice(1)) {
    const r = await prisma.$transaction((tx) => createVersion(tx, first.release.id, pkg));
    logVersionCreated(logger, r);
  }
}

async function main() {
  await seedRelease("Invoices 2.4 (sample)", [SAMPLE_PACKAGE]);
  // Approving statements that cite F-1 (changed) and F-3 (removed) makes them stale in v2;
  // those citing F-2 and L-1 (unchanged) stay approved.
  await seedRelease("Mobile app 5.0 (compare sample)", [COMPARE_SAMPLE_V1, COMPARE_SAMPLE_V2], ["F-1", "F-2", "F-3", "L-1"]);
  logger.info("seed.done");
}

main()
  .catch((e) => {
    logger.error({ err: e }, "seed.failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
