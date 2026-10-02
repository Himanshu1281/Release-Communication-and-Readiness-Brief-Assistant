"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, GitCompare, ListChecks, Package, Sparkles, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorBanner, ListSkeleton } from "@/components/states";
import { ReadinessBadge } from "@/components/workspace/readiness-panel";
import { api, useApi, type VersionSummary } from "@/lib/client";
import { SAMPLE_PACKAGE } from "@/lib/sample";

type ListResponse = {
  releases: { id: string; name: string; createdAt: string; latestVersion: VersionSummary | null }[];
};

export default function HomePage() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<ListResponse>("/api/releases");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState<"create" | "sample" | null>(null);

  async function create(body: object, kind: "create" | "sample") {
    setBusy(kind);
    try {
      const r = await api<{ release: { id: string } }>("/api/releases", { method: "POST", body: JSON.stringify(body) });
      toast.success(kind === "sample" ? "Sample release loaded" : "Release created");
      router.push(`/releases/${r.release.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setNameError("Give the release a name");
    setNameError(undefined);
    create({ name: name.trim() }, "create");
  }

  const loadSample = () => create({ name: "Invoices 2.4 (sample)", package: SAMPLE_PACKAGE }, "sample");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-50 via-background to-background p-6 sm:p-8">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Release readiness, with evidence</h1>
          <p className="text-muted-foreground">
            Paste in what changed. Deterministic checks catch missing information, AI drafts the analysis with citations to
            your items, and a person approves every statement before a brief is built.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            {[
              { icon: ListChecks, label: "Rule-based checks" },
              { icon: Sparkles, label: "Cited AI review" },
              { icon: GitCompare, label: "Staleness across versions" },
              { icon: UserCheck, label: "Human-only approval" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
                <Icon className="h-3.5 w-3.5 text-primary" /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Releases</h2>
          <p className="text-sm text-muted-foreground">Each save creates a new immutable version.</p>
        </div>
        <form onSubmit={onCreate} className="flex items-start gap-2">
          <div>
            <Input
              placeholder="New release name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
              className={nameError ? "border-destructive" : ""}
            />
            {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
          </div>
          <Button type="submit" disabled={!!busy}>
            {busy === "create" ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={loadSample} disabled={!!busy}>
            {busy === "sample" ? "Loading…" : "Load sample"}
          </Button>
        </form>
      </div>

      {loading && !data ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : !data?.releases.length ? (
        <EmptyState title="No releases yet">
          <p className="max-w-md text-sm text-muted-foreground">
            Load the sample to see checks, AI review, staleness and the gated brief, all in one click.
          </p>
          <Button onClick={loadSample} disabled={!!busy}>
            {busy === "sample" ? "Loading…" : "Load sample release"}
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {data.releases.map((r) => (
            <Link key={r.id} href={`/releases/${r.id}`} className="group">
              <Card className="transition-all group-hover:border-primary/40 group-hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-primary">
                    <Package className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">Created {new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  {r.latestVersion && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">v{r.latestVersion.versionNumber}</Badge>
                      <ReadinessBadge readiness={r.latestVersion.readiness} />
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
