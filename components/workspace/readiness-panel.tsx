"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Readiness } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, READINESS_LABEL, type VersionDetail } from "@/lib/client";
import { cn } from "@/lib/utils";

const STYLE: Record<Readiness, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  READY_FOR_RELEASE: "bg-green-100 text-green-800 border-green-200",
  NOT_READY: "bg-red-100 text-red-800 border-red-200",
};

export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  return <Badge variant="outline" className={STYLE[readiness]}>{READINESS_LABEL[readiness]}</Badge>;
}

export function ReadinessPanel({ detail, onChange }: { detail: VersionDetail; onChange: () => void }) {
  const { version, isLatest, briefBlockers } = detail;
  const [name, setName] = useState("");
  const [decision, setDecision] = useState<"READY_FOR_RELEASE" | "NOT_READY">();
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Enter your name (at least 2 characters)";
    if (!decision) errs.decision = "Choose a decision";
    if (!confirm) errs.confirm = "Tick the box to confirm";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await api(`/api/versions/${version.id}/readiness`, {
        method: "POST",
        body: JSON.stringify({ reviewerName: name.trim(), readiness: decision, confirm: true }),
      });
      toast.success(`v${version.versionNumber} marked ${READINESS_LABEL[decision!].toLowerCase()}`);
      setConfirm(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ReadinessBadge readiness={version.readiness} />
          {version.readinessBy ? (
            <p className="text-muted-foreground">
              Set by <span className="font-medium text-foreground">{version.readinessBy}</span> on{" "}
              {new Date(version.readinessAt!).toLocaleString()}
            </p>
          ) : (
            <p className="text-muted-foreground">No decision recorded for v{version.versionNumber}.</p>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            Readiness can only be set here, by a named person. The AI cannot change it, and no other action does.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Record a decision</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLatest ? (
            <p className="text-sm text-muted-foreground">Old versions are read-only. Switch to the latest version to record a decision.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="reviewer">Reviewer name</Label>
                <Input id="reviewer" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} className={cn(errors.name && "border-destructive")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Decision</Label>
                <div className="flex gap-2">
                  {(["READY_FOR_RELEASE", "NOT_READY"] as const).map((r) => (
                    <Button key={r} type="button" variant={decision === r ? "default" : "outline"} onClick={() => setDecision(r)}>
                      {READINESS_LABEL[r]}
                    </Button>
                  ))}
                </div>
                {errors.decision && <p className="text-xs text-destructive">{errors.decision}</p>}
                {decision === "READY_FOR_RELEASE" && briefBlockers.length > 0 && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Heads up: the brief is still blocked ({briefBlockers.join(" ")}). You can still record this decision.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                I reviewed this version and take responsibility for this decision.
              </label>
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}

              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record decision"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
