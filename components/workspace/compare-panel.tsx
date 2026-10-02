"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorBanner, ListSkeleton } from "@/components/states";
import { useApi, type VersionSummary } from "@/lib/client";
import type { ItemDiff, SectionDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";

type CompareResponse = {
  a: { versionNumber: number };
  b: { versionNumber: number };
  sections: SectionDiff[];
  staleStatements: { id: string; kind: string; text: string; reasons: string[] }[];
};

const STATUS_STYLE: Record<ItemDiff["status"], string> = {
  added: "bg-green-100 text-green-800 border-green-200",
  removed: "bg-red-100 text-red-800 border-red-200",
  modified: "bg-amber-100 text-amber-800 border-amber-200",
  unchanged: "bg-muted text-muted-foreground",
};

export function ComparePanel({ releaseId, versions, current }: { releaseId: string; versions: VersionSummary[]; current: number }) {
  const numbers = versions.map((v) => v.versionNumber);
  const [b, setB] = useState(current > 1 ? current : numbers[numbers.length - 1]);
  const [a, setA] = useState(Math.max(1, b - 1));
  const [showUnchanged, setShowUnchanged] = useState(false);
  const { data, error, loading, reload } = useApi<CompareResponse>(
    a !== b ? `/api/releases/${releaseId}/compare?a=${a}&b=${b}` : null,
  );

  const picker = (value: number, onChange: (n: number) => void) => (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
      <SelectContent>
        {numbers.map((n) => <SelectItem key={n} value={String(n)}>v{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const changed = data?.sections.flatMap((s) => s.items).filter((i) => i.status !== "unchanged").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {picker(a, setA)}
        <span className="text-sm text-muted-foreground">→</span>
        {picker(b, setB)}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />
          Show unchanged items
        </label>
      </div>

      {a === b ? (
        <EmptyState title="Pick two different versions to compare" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Statements that go stale from v{data.a.versionNumber} to v{data.b.versionNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.staleStatements.length === 0 ? (
                <p className="text-sm text-muted-foreground">None. Every statement still matches the items it cites.</p>
              ) : (
                data.staleStatements.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-start gap-2 text-sm">
                    <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">{s.reasons.join("; ")}</Badge>
                    <span className="text-xs text-muted-foreground">{s.kind.toLowerCase().replace("_", " ")}</span>
                    <span className="flex-1">{s.text}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {changed === 0 && !showUnchanged && <EmptyState title="The packages are identical" />}

          {data.sections.map((sec) => {
            const rows = sec.items.filter((i) => showUnchanged || i.status !== "unchanged");
            if (!rows.length) return null;
            return (
              <Card key={sec.section}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{sec.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-[5rem_1fr_1fr] gap-3 text-xs font-medium text-muted-foreground">
                    <span />
                    <span>v{data.a.versionNumber}</span>
                    <span>v{data.b.versionNumber}</span>
                  </div>
                  {rows.map((i) => (
                    <div key={i.id} className="grid grid-cols-[5rem_1fr_1fr] gap-3 border-t pt-2 text-sm">
                      <div className="space-y-1">
                        <span className="font-mono text-xs">{i.id}</span>
                        <Badge variant="outline" className={cn("block w-fit", STATUS_STYLE[i.status])}>{i.status}</Badge>
                      </div>
                      <div className={cn(i.status === "removed" && "text-red-800 line-through")}>
                        {i.textDiff ? i.textDiff.filter((c) => !c.added).map((c, k) => (
                          <span key={k} className={cn(c.removed && "bg-red-100 text-red-800 line-through")}>{c.value}</span>
                        )) : i.before ?? <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className={cn(i.status === "added" && "text-green-800")}>
                        {i.textDiff ? i.textDiff.filter((c) => !c.removed).map((c, k) => (
                          <span key={k} className={cn(c.added && "bg-green-100 text-green-800")}>{c.value}</span>
                        )) : i.after ?? <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
