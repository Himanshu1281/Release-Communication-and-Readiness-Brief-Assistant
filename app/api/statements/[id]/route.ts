import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, json, notFound, parseBody, route } from "@/lib/api";
import type { ItemHashes } from "@/lib/hash";
import type { Citation } from "@/lib/staleness";
import { assertLatest } from "@/lib/services/versions";

// Strict: only these two fields are human-editable. stale, citations, uncited etc. are rejected.
const PatchStatement = z
  .object({
    editedText: z.string().trim().min(1, "Edited text cannot be empty").max(2000).optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  })
  .strict()
  .refine((b) => b.editedText !== undefined || b.status !== undefined, "Provide editedText or status");

export const PATCH = route(async (req, { params, log }) => {
  const body = await parseBody(req, PatchStatement);
  const s = await prisma.statement.findUnique({ where: { id: params.id }, include: { version: true } });
  if (!s) throw notFound("Statement");
  await assertLatest(s.version);

  const data: Prisma.StatementUpdateInput = {};
  let stale = s.stale;
  const editedText = body.editedText ?? s.editedText;

  if (body.editedText !== undefined) {
    data.editedText = body.editedText;
    // A human rewrite re-confirms the statement against the current version:
    // re-stamp citation hashes and clear staleness. Citations to removed items are dropped.
    if (s.stale) {
      const hashes = s.version.itemHashes as ItemHashes;
      const citations = (s.citations as Citation[])
        .filter((c) => c.itemId in hashes)
        .map((c) => ({ itemId: c.itemId, hash: hashes[c.itemId] }));
      data.citations = json(citations);
      data.stale = false;
      data.staleReason = null;
      stale = false;
    }
    // Changing approved wording needs a fresh decision.
    if (body.status === undefined && s.status === "APPROVED" && body.editedText !== s.editedText) {
      data.status = "PENDING";
      data.reviewedAt = null;
    }
  }

  if (body.status !== undefined) {
    if (body.status === "APPROVED") {
      if (s.uncited && !editedText) {
        throw new ApiError(422, "UNCITED_REQUIRES_EDIT", "This statement has no citations. Edit it before approving.");
      }
      if (stale) {
        throw new ApiError(422, "STALE_REQUIRES_EDIT", `Statement is stale (${s.staleReason}). Edit it to re-confirm before approving.`);
      }
    }
    data.status = body.status;
    data.reviewedAt = body.status === "PENDING" ? null : new Date();
  }

  const updated = await prisma.statement.update({ where: { id: s.id }, data });
  log.info(
    { statementId: s.id, versionId: s.versionId, kind: s.kind, status: updated.status, edited: body.editedText !== undefined },
    "statement.reviewed",
  );
  return { statement: updated };
});
