import { Link } from "wouter";
import { Star } from "lucide-react";
import { useGetProfile } from "@workspace/api-client-react";
import { useArchiveCatalog } from "@/lib/useArchiveCatalog";
import { catalogMilestones, catalogRewardsForMilestone } from "@/lib/archiveResources";
import { RewardCard } from "@/components/LevelRewardModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";
import { uiText } from "@/contexts/LanguageContext";

/** Compact entry to the single resource index, also used by level notifications. */
export function RewardsLibrarySection() {
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const catalog = useArchiveCatalog();
  if (profileLoading || catalog.isLoading) return <div className="space-y-3"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  const level = profile?.level ?? 0;
  const milestones = catalogMilestones(catalog.data ?? []);
  const next = milestones.find(m => m > level);
  const unlocked = milestones.filter(m => m <= level).flatMap(m => catalogRewardsForMilestone(catalog.data ?? [], m));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 p-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold"><Star className="h-4 w-4 text-primary" />{uiText("reorg.archive.level", { level })}</p>
          {next && <p className="text-xs text-muted-foreground">{uiText("reorg.archive.next", { level: next })}</p>}
        </div>
        <Link href="/wiki?t=unlocked"><Button size="sm">{uiText("reorg.archive.open")}</Button></Link>
      </div>
      {catalog.isError && <QueryErrorState onRetry={() => void catalog.refetch()} />}
      {unlocked.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{unlocked.slice(0, 4).map(r => <RewardCard key={r.id} reward={r} compact />)}</div>
        : <p className="text-sm text-muted-foreground">{uiText("reorg.archive.empty_body")}</p>}
    </div>
  );
}
