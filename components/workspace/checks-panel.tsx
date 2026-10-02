"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import type { CheckResult } from "@/lib/checks";

export function ChecksPanel({ checks, onShowItems }: { checks: CheckResult[]; onShowItems: (ids: string[]) => void }) {
  if (!checks.length) {
    return (
      <EmptyState title="All deterministic checks passed">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </EmptyState>
    );
  }
  const sorted = [...checks].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  const errors = checks.filter((c) => c.severity === "error").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These rules run without AI on every save. {errors > 0 ? `${errors} error(s) block the final brief.` : "Warnings do not block the brief."}
      </p>
      {sorted.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-start gap-3 p-4">
            {c.severity === "error" ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div className="flex-1">
              <p className="text-sm">{c.message}</p>
              {c.itemIds.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {c.itemIds.map((id) => (
                    <button key={id} onClick={() => onShowItems([id])} className="font-mono text-xs text-primary underline-offset-2 hover:underline">
                      {id} →
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Badge variant={c.severity === "error" ? "destructive" : "secondary"}>{c.severity}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
