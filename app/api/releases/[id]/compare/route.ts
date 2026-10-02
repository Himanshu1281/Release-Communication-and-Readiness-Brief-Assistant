import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, notFound, route } from "@/lib/api";
import { diffPackages } from "@/lib/diff";
import type { ItemHashes } from "@/lib/hash";
import type { ReleasePackage } from "@/lib/package";
import { staleReasons, type Citation } from "@/lib/staleness";

const Query = z.object({ a: z.coerce.number().int().min(1), b: z.coerce.number().int().min(1) });

export const GET = route(async (req, { params }) => {
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) throw new ApiError(400, "VALIDATION_ERROR", "Query needs version numbers a and b", q.error.flatten());

  const versions = await prisma.releaseVersion.findMany({
    where: { releaseId: params.id, versionNumber: { in: [q.data.a, q.data.b] } },
    include: { statements: { where: { status: { not: "REJECTED" } } } },
  });
  const a = versions.find((v) => v.versionNumber === q.data.a);
  const b = versions.find((v) => v.versionNumber === q.data.b);
  if (!a || !b) throw notFound("Version");

  // Which of version a's statements would be stale if carried to version b.
  const bHashes = b.itemHashes as ItemHashes;
  const staleStatements = a.statements
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      text: s.editedText ?? s.text,
      reasons: staleReasons(s.citations as Citation[], bHashes),
    }))
    .filter((s) => s.reasons.length > 0);

  return {
    a: { id: a.id, versionNumber: a.versionNumber },
    b: { id: b.id, versionNumber: b.versionNumber },
    sections: diffPackages(a.package as ReleasePackage, b.package as ReleasePackage),
    staleStatements,
  };
});
