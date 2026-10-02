"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner } from "@/components/states";
import { StatementCard } from "./statement-card";
import { api, type VersionDetail } from "@/lib/client";
import { allItems } from "@/lib/package";

const GROUPS: { kind: string; title: string; hint: string }[] = [
  { kind: "GAP", title: "Gaps", hint: "Missing or vague release information" },
  { kind: "UNSUPPORTED_CLAIM", title: "Unsupported claims", hint: "Claims the QA evidence does not back up" },
  { kind: "RISK", title: "Risks", hint: "Known risks and limitations" },
  { kind: "CLASSIFICATION", title: "Impact classification", hint: "End-user impact per change" },
  { kind: "TECH_SUMMARY", title: "Technical summary", hint: "For engineers and support" },
  { kind: "STAKEHOLDER_SUMMARY", title: "Stakeholder summary", hint: "For non-technical clients" },
];

const STEPS = ["Sending package to the model", "Running analysis and summaries in parallel", "Validating output and citations", "Saving statements"];

export function ReviewPanel({ detail, onChange }: { detail: VersionDetail; onChange: () => void }) {
  const { version, isLatest } = detail;
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [runError, setRunError] = useState<string>();

  // Progress is time-based: the server does the steps in one request.
  useEffect(() => {
    if (!running) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1500);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    setRunning(true);
    setRunError(undefined);
    try {
      const r = await api<{ statements: number; droppedInvalid: number; durationMs: number }>(`/api/versions/${version.id}/analyze`, {
        method: "POST",
      });
      toast.success(
        `Analysis done in ${(r.durationMs / 1000).toFixed(1)}s: ${r.statements} statement(s)` +
          (r.droppedInvalid ? `, ${r.droppedInvalid} dropped for invalid citations` : ""),
      );
      onChange();
    } catch (e) {
      setRunError((e as Error).message);
      onChange(); // refresh so the FAILED run shows in history
    } finally {
      setRunning(false);
    }
  }

  const items = new Map(allItems(version.package).map((it) => [it.id, it.text]));
  const lastRun = version.runs[0];
  const statements = version.statements;
  const stale = statements.filter((s) => s.stale).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-background p-4">
        <div className="text-sm">
          {lastRun ? (
            <p>
              Last run: <span className="font-medium">{lastRun.status.toLowerCase()}</span> · {lastRun.model} · prompt{" "}
              {lastRun.promptVer}
              {lastRun.durationMs != null && ` · ${(lastRun.durationMs / 1000).toFixed(1)}s`}
            </p>
          ) : (
            <p className="text-muted-foreground">No analysis has been run on this version.</p>
          )}
          <p className="text-muted-foreground">
            The AI drafts statements; only a human can approve them. Re-running keeps anything you approved, rejected or edited.
          </p>
        </div>
        <Button onClick={run} disabled={running || !isLatest}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {running ? "Running…" : statements.length ? "Re-run analysis" : "Run analysis"}
        </Button>
      </div>

      {running && (
        <ol className="space-y-2 rounded-md border bg-background p-4 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className={i > step ? "text-muted-foreground" : ""}>
              {i < step ? <CheckCircle2 className="mr-2 inline h-4 w-4 text-green-600" /> : i === step ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <span className="mr-2 inline-block w-4" />}
              {s}
            </li>
          ))}
        </ol>
      )}

      {runError && <ErrorBanner title="Analysis failed" message={runError} onRetry={isLatest ? run : undefined} />}
      {!runError && lastRun?.status === "FAILED" && !running && (
        <ErrorBanner title="The last analysis run failed" message={lastRun.error ?? "Unknown error"} onRetry={isLatest ? run : undefined} />
      )}

      {stale > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {stale} statement(s) cite items that changed since they were written. Edit to re-confirm them, or re-run analysis.
        </p>
      )}

      {!statements.length && !running ? (
        <EmptyState title="No statements yet">
          <p className="text-sm text-muted-foreground">Run analysis to get impact, gaps, unsupported claims, risks and summaries.</p>
        </EmptyState>
      ) : (
        GROUPS.map(({ kind, title, hint }) => {
          const group = statements.filter((s) => s.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} className="space-y-3">
              <div>
                <h3 className="font-semibold">
                  {title} <span className="text-sm font-normal text-muted-foreground">({group.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              {group.map((s) => (
                <StatementCard key={s.id} statement={s} items={items} readOnly={!isLatest} onChange={onChange} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
