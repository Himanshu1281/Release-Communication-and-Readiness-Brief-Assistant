import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/api";

export const GET = route(async (_req, { params }) => {
  const release = await prisma.release.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: { versionNumber: "asc" },
        select: { id: true, versionNumber: true, readiness: true, readinessBy: true, createdAt: true },
      },
    },
  });
  if (!release) throw notFound("Release");
  return { release };
});
