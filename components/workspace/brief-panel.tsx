"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Copy, Download, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner } from "@/components/states";
import { api, ClientError, type VersionDetail } from "@/lib/client";

type BriefDTO = NonNullable<VersionDetail["latestBrief"]>;

export function BriefPanel({ detail, onChange }: { detail: VersionDetail; onChange: () => void }) {
  const { version } = detail;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; reasons?: string[] }>();
  const [brief, setBrief] = useState<BriefDTO | null>(detail.latestBrief);

  // Same rules as lib/brief.ts; the server re-checks them when generating.
  const approved = version.statements.filter((s) => s.status === "APPROVED");
  const gates = [
    { ok: !version.checkResults.some((c) => c.severity === "error"), label: "No deterministic check errors" },
    { ok: !approved.some((s) => s.stale), label: "No approved statement is stale" },
    { ok: approved.some((s) => !s.stale), label: `At least one approved statement (${approved.length} approved)` },
  ];
  const ready = gates.every((g) => g.ok);

  async function generate() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ brief: BriefDTO }>(`/api/versions/${version.id}/brief`, { method: "POST" });
      setBrief(r.brief);
      toast.success("Brief generated");
      onChange();
    } catch (e) {
      const reasons = e instanceof ClientError ? (e.details as { reasons?: string[] } | undefined)?.reasons : undefined;
      setError({ message: (e as Error).message, reasons });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(brief!.markdown);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed. Your browser blocked clipboard access.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([brief!.markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${version.release.name.replace(/[^\w.-]+/g, "-")}-v${version.versionNumber}-brief.md`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Before you generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm">
            {gates.map((g) => (
              <li key={g.label} className="flex items-start gap-2">
                {g.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                {g.label}
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={generate} disabled={busy || !ready}>
            {busy ? "Generating…" : brief ? "Regenerate brief" : "Generate brief"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Built by a fixed template from approved, non-stale statements only. Edited text is used over the AI original. No AI is
            involved in this step.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {error && (
          <ErrorBanner
            title={error.message}
            message={error.reasons?.join("\n") ?? "Try again."}
            onRetry={generate}
          />
        )}
        {brief ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
                <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" /> Download .md</Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">Generated {new Date(brief.createdAt).toLocaleString()}</p>
              <article className="prose-sm space-y-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
                <ReactMarkdown>{brief.markdown}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No brief yet">
            <p className="text-sm text-muted-foreground">Approve statements in AI Review, then generate the brief here.</p>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
