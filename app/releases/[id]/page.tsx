"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, GitCompare, ListChecks, Package, Sparkles, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBanner, ListSkeleton } from "@/components/states";
import { PackageEditor } from "@/components/workspace/package-editor";
import { ChecksPanel } from "@/components/workspace/checks-panel";
import { ReviewPanel } from "@/components/workspace/review-panel";
import { ComparePanel } from "@/components/workspace/compare-panel";
import { BriefPanel } from "@/components/workspace/brief-panel";
import { ReadinessBadge, ReadinessPanel } from "@/components/workspace/readiness-panel";
import { useApi, type ReleaseDetail, type VersionDetail } from "@/lib/client";

const COUNT_TONE = {
  error: "bg-red-100 text-red-700 ring-red-200",
  warning: "bg-amber-100 text-amber-800 ring-amber-200",
  info: "bg-indigo-100 text-indigo-700 ring-indigo-200",
};

/** Small count pill on a tab. Light background + dark text stays readable on active and inactive tabs. */
function TabCount({ tone, title, children }: { tone: keyof typeof COUNT_TONE; title: string; children: React.ReactNode }) {
  return (
    <span title={title} className={`ml-1 min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5 ring-1 ring-inset ${COUNT_TONE[tone]}`}>
      {children}
    </span>
  );
}

const TAB = "gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const release = useApi<ReleaseDetail>(`/api/releases/${params.id}`);
  const versions = useMemo(() => release.data?.release.versions ?? [], [release.data]);
  const [versionId, setVersionId] = useState<string>();
  const [tab, setTab] = useState("package");
  const [highlight, setHighlight] = useState<string[]>([]);

  // Default to the latest version once the release loads.
  useEffect(() => {
    if (!versionId && versions.length) setVersionId(versions[versions.length - 1].id);
  }, [versions, versionId]);

  const version = useApi<VersionDetail>(versionId ? `/api/versions/${versionId}` : null);
  const v = version.data;

  async function onVersionCreated(id: string) {
    await release.reload();
    setVersionId(id);
    setTab("checks");
  }

  function showItems(ids: string[]) {
    setHighlight(ids);
    setTab("package");
  }

  if (release.error) return <ErrorBanner message={release.error} onRetry={release.reload} />;
  if (!release.data) return <ListSkeleton rows={4} />;

  const errors = v?.version.checkResults.filter((c) => c.severity === "error").length ?? 0;
  const warnings = v?.version.checkResults.filter((c) => c.severity === "warning").length ?? 0;
  const pending = v?.version.statements.filter((s) => s.status === "PENDING").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-5 shadow-sm">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Releases
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{release.data.release.name}</h1>
          <p className="text-xs text-muted-foreground">
            {versions.length} version{versions.length === 1 ? "" : "s"}
            {v && ` · ${v.version.statements.length} statements · ${v.version.statements.filter((s) => s.status === "APPROVED").length} approved`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {v && <ReadinessBadge readiness={v.version.readiness} />}
          <Select value={versionId} onValueChange={(id) => { setVersionId(id); setHighlight([]); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((x, i) => (
                <SelectItem key={x.id} value={x.id}>
                  v{x.versionNumber}
                  {i === versions.length - 1 ? " (latest)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {v && !v.isLatest && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You are viewing v{v.version.versionNumber}, which is read-only. Reviews and readiness can only change on the latest
          version. Saving the package here creates a new version from this content.
        </p>
      )}

      {version.error ? (
        <ErrorBanner message={version.error} onRetry={version.reload} />
      ) : !v || v.version.id !== versionId ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-background p-1 shadow-sm ring-1 ring-border">
            <TabsTrigger value="package" className={TAB}><Package className="h-4 w-4" />Package</TabsTrigger>
            <TabsTrigger className={TAB} value="checks">
              <ListChecks className="h-4 w-4" />
              Checks
              {errors > 0 && <TabCount tone="error" title={`${errors} error(s)`}>{errors}</TabCount>}
              {errors === 0 && warnings > 0 && <TabCount tone="warning" title={`${warnings} warning(s)`}>{warnings}</TabCount>}
            </TabsTrigger>
            <TabsTrigger className={TAB} value="review">
              <Sparkles className="h-4 w-4" />
              AI Review
              {pending > 0 && <TabCount tone="info" title={`${pending} pending review`}>{pending}</TabCount>}
            </TabsTrigger>
            <TabsTrigger className={TAB} value="compare" disabled={versions.length < 2}>
              <GitCompare className="h-4 w-4" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="brief" className={TAB}><FileText className="h-4 w-4" />Brief</TabsTrigger>
            <TabsTrigger value="readiness" className={TAB}><UserCheck className="h-4 w-4" />Readiness</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-6" value="package">
            <PackageEditor
              key={v.version.id}
              releaseId={params.id}
              initial={v.version.package}
              highlight={highlight}
              onCreated={onVersionCreated}
            />
          </TabsContent>
          <TabsContent className="mt-6" value="checks">
            <ChecksPanel checks={v.version.checkResults} onShowItems={showItems} />
          </TabsContent>
          <TabsContent className="mt-6" value="review">
            <ReviewPanel detail={v} onChange={version.reload} />
          </TabsContent>
          <TabsContent className="mt-6" value="compare">
            <ComparePanel releaseId={params.id} versions={versions} current={v.version.versionNumber} />
          </TabsContent>
          <TabsContent className="mt-6" value="brief">
            <BriefPanel detail={v} onChange={version.reload} />
          </TabsContent>
          <TabsContent className="mt-6" value="readiness">
            <ReadinessPanel detail={v} onChange={() => { version.reload(); release.reload(); }} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
