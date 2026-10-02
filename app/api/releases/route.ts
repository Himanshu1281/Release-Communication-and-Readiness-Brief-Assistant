import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, parseBody, route } from "@/lib/api";
import { ReleasePackageSchema } from "@/lib/package";
import { createVersion, logVersionCreated } from "@/lib/services/versions";

const CreateRelease = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  package: ReleasePackageSchema.default({}),
});

export const POST = route(async (req, { log }) => {
  const body = await parseBody(req, CreateRelease);

  const result = await prisma.$transaction(async (tx) => {
    const release = await tx.release.create({ data: { name: body.name } });
    return { release, ...(await createVersion(tx, release.id, body.package)) };
  });

  log.info({ releaseId: result.release.id, name: result.release.name }, "release.created");
  logVersionCreated(log, result);
  return created({ release: result.release, version: result.version });
});

export const GET = route(async () => {
  const releases = await prisma.release.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true, versionNumber: true, readiness: true, createdAt: true },
      },
    },
  });
  return {
    releases: releases.map(({ versions, ...r }) => ({ ...r, latestVersion: versions[0] ?? null })),
  };
});
