"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Bug, FlaskConical, Plus, Route, Sparkles, Trash2, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import { CHANGE_SECTIONS, nextId, SECTIONS, type QaItem, type ReleasePackage, type SectionKey } from "@/lib/package";
import { cn } from "@/lib/utils";

const SECTION_ICON: Record<SectionKey, { icon: LucideIcon; tint: string }> = {
  features: { icon: Sparkles, tint: "bg-indigo-50 text-indigo-600" },
  bugFixes: { icon: Bug, tint: "bg-rose-50 text-rose-600" },
  changedBehaviour: { icon: ArrowRightLeft, tint: "bg-amber-50 text-amber-600" },
  qaSummary: { icon: FlaskConical, tint: "bg-emerald-50 text-emerald-600" },
  knownLimitations: { icon: AlertTriangle, tint: "bg-orange-50 text-orange-600" },
  migrationNotes: { icon: Route, tint: "bg-sky-50 text-sky-600" },
  affectedGroups: { icon: Users, tint: "bg-violet-50 text-violet-600" },
};

type Props = {
  releaseId: string;
  initial: ReleasePackage;
  highlight: string[];
  onCreated: (versionId: string) => void;
};

export function PackageEditor({ releaseId, initial, highlight, onCreated }: Props) {
  const [pkg, setPkg] = useState<ReleasePackage>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirty = useMemo(() => JSON.stringify(pkg) !== JSON.stringify(initial), [pkg, initial]);
  const blankIds = useMemo(
    () => new Set(SECTIONS.flatMap(({ key }) => pkg[key].filter((it) => !it.text.trim()).map((it) => it.id))),
    [pkg],
  );
  const changeIds = CHANGE_SECTIONS.flatMap((k) => pkg[k].map((it) => it.id));

  useEffect(() => {
    if (highlight[0]) document.getElementById(`item-${highlight[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  const update = (fn: (draft: ReleasePackage) => void) =>
    setPkg((p) => {
      const draft = structuredClone(p);
      fn(draft);
      return draft;
    });

  const addItem = (key: SectionKey) =>
    update((d) => {
      const id = nextId(d, key);
      if (key === "qaSummary") d.qaSummary.push({ id, text: "", covers: [] });
      else d[key].push({ id, text: "" });
    });

  const removeItem = (key: SectionKey, id: string) =>
    update((d) => {
      (d[key] as { id: string }[]).splice(d[key].findIndex((it) => it.id === id), 1);
      // Keep QA covers consistent so removing an item doesn't create a dangling reference.
      for (const qa of d.qaSummary) qa.covers = qa.covers.filter((c) => c !== id);
    });

  async function save() {
    if (blankIds.size) {
      setShowErrors(true);
      toast.error("Fill in or remove the empty items before saving.");
      return;
    }
    setSaving(true);
    try {
      const r = await api<{ version: { id: string; versionNumber: number }; staleCount: number; carriedCount: number }>(
        `/api/releases/${releaseId}/versions`,
        { method: "POST", body: JSON.stringify({ package: pkg }) },
      );
      toast.success(
        `Saved as v${r.version.versionNumber}` + (r.staleCount ? `. ${r.staleCount} statement(s) are now stale and need review.` : ""),
      );
      onCreated(r.version.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={cn("sticky top-16 z-10 flex items-center justify-between rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur", dirty && "border-primary/40 ring-1 ring-primary/20")}>
        <p className="text-sm text-muted-foreground">
          {dirty ? "Unsaved changes. Saving creates a new version; old versions are never overwritten." : "No changes."}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => { setPkg(structuredClone(initial)); setShowErrors(false); }}>
            Discard
          </Button>
          <Button disabled={!dirty || saving} onClick={save}>
            {saving ? "Saving…" : "Save as new version"}
          </Button>
        </div>
      </div>

      {SECTIONS.map(({ key, label }) => (
        <Card key={key}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              {(() => {
                const { icon: Icon, tint } = SECTION_ICON[key];
                return (
                  <span className={cn("grid h-8 w-8 place-items-center rounded-md", tint)}>
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })()}
              <CardTitle className="text-base">{label}</CardTitle>
              <Badge variant="secondary" className="font-mono">{pkg[key].length}</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => addItem(key)}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pkg[key].length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items.{" "}
                {["qaSummary", "knownLimitations", "migrationNotes", "affectedGroups"].includes(key) &&
                  'This section is required; add "None" if that is deliberate.'}
              </p>
            )}
            {pkg[key].map((it, idx) => {
              const invalid = showErrors && blankIds.has(it.id);
              return (
                <div
                  key={it.id}
                  id={`item-${it.id}`}
                  className={cn(
                    "rounded-lg border bg-muted/20 p-3 transition-colors focus-within:border-primary/50 focus-within:bg-background",
                    highlight.includes(it.id) && "border-amber-400 bg-amber-50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-2 font-mono">{it.id}</Badge>
                    <div className="flex-1">
                      <Textarea
                        rows={2}
                        value={it.text}
                        placeholder="Describe this item"
                        aria-invalid={invalid}
                        className={cn(invalid && "border-destructive")}
                        onChange={(e) => update((d) => { d[key][idx].text = e.target.value; })}
                      />
                      {invalid && <p className="mt-1 text-xs text-destructive">Text is required</p>}
                      {key === "qaSummary" && (
                        <CoversPicker
                          options={changeIds}
                          value={(it as QaItem).covers}
                          onChange={(covers) => update((d) => { d.qaSummary[idx].covers = covers; })}
                        />
                      )}
                    </div>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${it.id}`} onClick={() => removeItem(key, it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Multiselect of change-item IDs as toggle chips. Unknown (dangling) IDs are shown so they can be removed. */
function CoversPicker({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = [...new Set([...options, ...value])];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Covers:</span>
      {all.length === 0 && <span className="text-xs text-muted-foreground">add features, fixes or changes first</span>}
      {all.map((id) => {
        const on = value.includes(id);
        const dangling = !options.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== id) : [...value, id])}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-xs transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              dangling && "border-destructive bg-destructive/10 text-destructive",
            )}
            title={dangling ? `${id} does not exist; click to remove` : undefined}
          >
            {id}
          </button>
        );
      })}
    </div>
  );
}
