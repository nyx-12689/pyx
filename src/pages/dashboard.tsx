import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useShallow } from "zustand/react/shallow"

import { Failures } from "@/components/dashboard/failures"
import { KpiTiles, TrendChart } from "@/components/dashboard/overview"
import { MediaMix, ToolTable } from "@/components/dashboard/performance"
import { MonthCalendar } from "@/components/dashboard/rhythm"
import { RunningNow, StatusStrip } from "@/components/dashboard/status-strip"
import { StorageSection } from "@/components/dashboard/storage"
import { MissingDependenciesBanner } from "@/components/install-dependency"
import { Page, SectionTitle } from "@/components/page"
import { CosmicButton } from "@/components/ui/cosmic-button"
import { HaloTabs, HaloTabsIndicator, HaloTabsList, HaloTabsTrigger } from "@/components/ui/halo-tabs"
import { PixelHeading } from "@/components/ui/pixel-heading-character"
import TextAnimate from "@/components/ui/text-animate"
import { buckets, period, previousPeriod, type RangeDays, within } from "@/lib/analytics"
import { JobRow } from "@/pages/activity"
import { isActive, recordToJob, useApp } from "@/store"

const RANGES: { days: RangeDays; label: string; previous: string }[] = [
  { days: 1, label: "Today", previous: "yesterday" },
  { days: 7, label: "7 days", previous: "previous 7 days" },
  { days: 30, label: "30 days", previous: "previous 30 days" },
  { days: 90, label: "90 days", previous: "previous 90 days" },
]

function Header({ days, onDaysChange }: { days: RangeDays; onDaysChange: (days: RangeDays) => void }) {
  const navigate = useNavigate()
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <PixelHeading as="h2" mode="wave" showLabel={false} className="text-2xl leading-none font-semibold tracking-tight">
          Pyx
        </PixelHeading>
        <TextAnimate
          text="Convert, extract and inspect media."
          type="calmInUp"
          className="text-muted-foreground flex overflow-hidden text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <HaloTabs value={days} onValueChange={(v) => onDaysChange(v as RangeDays)}>
          <HaloTabsList variant="pill">
            {RANGES.map((r) => (
              <HaloTabsTrigger key={r.days} value={r.days}>
                {r.label}
              </HaloTabsTrigger>
            ))}
            <HaloTabsIndicator variant="pill" />
          </HaloTabsList>
        </HaloTabs>
        <CosmicButton as="button" onClick={() => navigate({ to: "/tools" })}>
          Open a tool
        </CosmicButton>
      </div>
    </header>
  )
}

export function DashboardPage() {
  const history = useApp((s) => s.history)
  const live = useApp((s) => s.jobOrder.some((id) => isActive(s.jobs[id])))
  const missing = useApp(useShallow((s) => s.deps?.dependencies.filter((d) => !d.path).map((d) => d.name) ?? []))
  const [days, setDays] = useState<RangeDays>(30)
  const range = RANGES.find((r) => r.days === days)!

  const all = useMemo(() => history ?? [], [history])
  const p = useMemo(() => period(days), [days])
  const records = useMemo(() => within(all, p), [all, p])
  const previous = useMemo(() => within(all, previousPeriod(p)), [all, p])
  const bs = useMemo(() => buckets(days, p), [days, p])
  const recent = useMemo(() => all.slice(0, 5).map(recordToJob), [all])

  return (
    // Clip sideways: the Open a tool button's spinning glow would otherwise widen the page.
    <Page className="space-y-8 overflow-x-clip">
      <Header days={days} onDaysChange={setDays} />

      {missing.length > 0 && <MissingDependenciesBanner names={missing} />}

      <section className="space-y-3">
        <StatusStrip history={all} />
        <RunningNow />
      </section>

      {history === null ? (
        <p className="text-muted-foreground py-16 text-center text-sm">Loading history…</p>
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle>Overview</SectionTitle>
            <KpiTiles records={records} previous={previous} buckets={bs} periodLabel={range.previous} live={live} />
            <TrendChart records={records} previous={previous} buckets={bs} period={p} periodLabel={range.previous} />
          </section>

          <section className="space-y-3">
            <SectionTitle>Storage</SectionTitle>
            <StorageSection records={records} allRecords={all} days={days} />
          </section>

          <section className="space-y-3">
            <SectionTitle>Performance</SectionTitle>
            <ToolTable records={records} buckets={bs} />
            <div className="grid gap-4 lg:grid-cols-3">
              <Failures records={records} className="lg:col-span-2" />
              <MediaMix records={records} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>When you work</SectionTitle>
            <MonthCalendar records={all} />
          </section>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle
          actions={
            recent.length > 0 && (
              <Link to="/activity" className="text-muted-foreground text-xs hover:underline">
                View all
              </Link>
            )
          }
        >
          Recent activity
        </SectionTitle>
        {recent.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            Nothing yet. Open a tool, add some files and run it.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {recent.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </Page>
  )
}
