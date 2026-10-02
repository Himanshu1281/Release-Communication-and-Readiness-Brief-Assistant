import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, notFound, parseBody, route } from "@/lib/api";
import { ReleasePackageSchema } from "@/lib/package";
import { createVersion, logVersionCreated } from "@/lib/services/versions";

const CreateVersion = z.object({ package: ReleasePackageSchema });

// Always creates a new version; existing versions are never overwritten.
export const POST = route(async (req, { params, log }) => {
  const body = await parseBody(req, CreateVersion);
  const release = await prisma.release.findUnique({ where: { id: params.id } });
  if (!release) throw notFound("Release");

  const result = await prisma.$transaction((tx) => createVersion(tx, release.id, body.package));

  logVersionCreated(log, result);
  return created({
    version: result.version,
    carriedCount: result.carriedCount,
    staleCount: result.staleCount,
  });
});
