import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { requestLogger, type Logger } from "./logger";

/** Every error response has the shape { error: { code, message, details } }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);

export type RouteCtx = { log: Logger; requestId: string; params: Record<string, string> };

/** Wraps a handler with a request-scoped logger, x-request-id header, and uniform error responses. */
export function route(handler: (req: Request, ctx: RouteCtx) => Promise<Response | unknown>) {
  return async (req: Request, { params }: { params: Record<string, string> }) => {
    const { log, requestId } = requestLogger(req.headers);
    let res: Response;
    try {
      const out = await handler(req, { log, requestId, params: params ?? {} });
      res = out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      const err = toApiError(e);
      if (err.status >= 500) log.error({ err: e, path: new URL(req.url).pathname }, "request.failed");
      else log.warn({ code: err.code, path: new URL(req.url).pathname }, "request.rejected");
      res = NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.details ?? null } },
        { status: err.status },
      );
    }
    res.headers.set("x-request-id", requestId);
    return res;
  };
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return notFound("Record");
    if (e.code === "P2002") return new ApiError(409, "CONFLICT", "Concurrent update, please retry");
  }
  return new ApiError(500, "INTERNAL", "Unexpected server error");
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid request body", r.error.flatten());
  return r.data;
}

export const created = (body: unknown) => NextResponse.json(body, { status: 201 });

/** Prisma's Json input type, for values we've already validated. */
export const json = (v: unknown) => v as Prisma.InputJsonValue;
