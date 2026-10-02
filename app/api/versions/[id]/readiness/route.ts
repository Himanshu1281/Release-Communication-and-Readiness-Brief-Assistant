import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/api";
import { assertLatest, getVersionOr404 } from "@/lib/services/versions";

// The ONLY route that writes readiness. It needs a typed reviewer name and an explicit confirmation.
const ReadinessBody = z
  .object({
    reviewerName: z.string().trim().min(2, "Reviewer name is required").max(100),
    readiness: z.enum(["READY_FOR_RELEASE", "NOT_READY"]),
    confirm: z.literal(true, { errorMap: () => ({ message: "You must confirm this decision" }) }),
  })
  .strict();

export const POST = route(async (req, { params, log }) => {
  const body = await parseBody(req, ReadinessBody);
  const version = await getVersionOr404(params.id);
  await assertLatest(version);

  const updated = await prisma.releaseVersion.update({
    where: { id: version.id },
    data: { readiness: body.readiness, readinessBy: body.reviewerName, readinessAt: new Date() },
    select: { id: true, versionNumber: true, readiness: true, readinessBy: true, readinessAt: true },
  });
  log.info(
    { versionId: version.id, readiness: body.readiness, reviewer: body.reviewerName, previous: version.readiness },
    "readiness.set",
  );
  return { version: updated };
});
