"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type StatementDTO } from "@/lib/client";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-sky-100 text-sky-800 border-sky-200",
  NONE: "bg-muted text-muted-foreground",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

type Props = { statement: StatementDTO; items: Map<string, string>; readOnly: boolean; onChange: () => void };

export function StatementCard({ statement: s, items, readOnly, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.editedText ?? s.text);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string>();

  const level = s.impact ?? s.severity;
  const approveBlocker = s.uncited && !s.editedText
    ? "This statement has no citations. Edit it before approving."
    : s.stale
      ? "This statement is stale. Edit it to re-confirm against the current version."
      : null;

  async function patch(body: { editedText?: string; status?: string }, success: string) {
    setBusy(true);
    try {
      await api(`/api/statements/${s.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(success);
      setEditing(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function saveEdit() {
    if (!draft.trim()) return setEditError("Text cannot be empty");
    setEditError(undefined);
    patch({ editedText: draft.trim() }, "Edit saved");
  }

  return (
    <Card
      className={cn(
        "border-l-4 transition-shadow hover:shadow-sm",
        s.status === "APPROVED" ? "border-l-green-500" : s.status === "REJECTED" ? "border-l-red-400 opacity-60" : "border-l-muted-foreground/20",
        s.stale && "border-amber-300 border-l-amber-500",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={STATUS_STYLE[s.status]}>{s.status.toLowerCase()}</Badge>
          {level && <Badge variant="outline" className={LEVEL_STYLE[level]}>{level}</Badge>}
          {s.stale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help border-amber-300 bg-amber-100 text-amber-900">stale</Badge>
              </TooltipTrigger>
              <TooltipContent>{s.staleReason}</TooltipContent>
            </Tooltip>
          )}
          {s.stale && <span className="text-xs text-amber-800">{s.staleReason}</span>}
          {s.uncited && <Badge variant="outline" className="border-destructive/40 text-destructive">uncited</Badge>}
          {s.editedText && <Badge variant="secondary">edited</Badge>}
          {s.carriedFrom && <Badge variant="secondary">carried over</Badge>}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!!editError} />
            {editError && <p className="text-xs text-destructive">{editError}</p>}
            {s.stale && <p className="text-xs text-muted-foreground">Saving re-confirms this statement against the current version.</p>}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-relaxed">{s.editedText ?? s.text}</p>
            {s.editedText && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer">AI original</summary>
                <p className="mt-1">{s.text}</p>
              </details>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {s.citations.map((c) => (
              <Tooltip key={c.itemId}>
                <TooltipTrigger asChild>
                  <span className="cursor-help rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700">{c.itemId}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{items.get(c.itemId) ?? "This item no longer exists"}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {!readOnly && (
            <div className="flex gap-1.5">
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setDraft(s.editedText ?? s.text); }}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy} onClick={saveEdit}>Save</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>Edit</Button>
                  {s.status !== "REJECTED" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ status: "REJECTED" }, "Rejected")}>
                      Reject
                    </Button>
                  )}
                  {s.status !== "PENDING" && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch({ status: "PENDING" }, "Moved back to pending")}>
                      Undo
                    </Button>
                  )}
                  {s.status !== "APPROVED" &&
                    (approveBlocker ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* span wrapper: disabled buttons don't fire hover events */}
                          <span tabIndex={0}>
                            <Button size="sm" disabled>Approve</Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{approveBlocker}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => patch({ status: "APPROVED" }, "Approved")}>
                        Approve
                      </Button>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
