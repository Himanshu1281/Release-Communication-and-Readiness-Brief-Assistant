"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisRun, Brief, ReleaseVersion, Statement } from "@prisma/client";
import type { CheckResult } from "./checks";
import type { ItemHashes } from "./hash";
import type { ReleasePackage } from "./package";
import type { Citation } from "./staleness";

export class ClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** fetch wrapper that unwraps the API's { error: { code, message, details } } shape. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  } catch {
    throw new ClientError("Network error. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ClientError(body?.error?.message ?? `Request failed (${res.status})`, body?.error?.code, body?.error?.details);
  }
  return body as T;
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(undefined);
    try {
      setData(await api<T>(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

// JSON shapes returned by the API.
export type StatementDTO = Omit<Statement, "citations"> & { citations: Citation[] };
export type RunDTO = Omit<AnalysisRun, "rawOutput">;
export type VersionSummary = Pick<ReleaseVersion, "id" | "versionNumber" | "readiness" | "readinessBy" | "createdAt">;

export type VersionDetail = {
  version: Omit<ReleaseVersion, "package" | "checkResults" | "itemHashes"> & {
    package: ReleasePackage;
    checkResults: CheckResult[];
    itemHashes: ItemHashes;
    release: { id: string; name: string };
    statements: StatementDTO[];
    runs: RunDTO[];
  };
  isLatest: boolean;
  latestBrief: Brief | null;
  briefBlockers: string[];
};

export type ReleaseDetail = { release: { id: string; name: string; createdAt: string; versions: VersionSummary[] } };

export const READINESS_LABEL = { DRAFT: "Draft", READY_FOR_RELEASE: "Ready for release", NOT_READY: "Not ready" } as const;
