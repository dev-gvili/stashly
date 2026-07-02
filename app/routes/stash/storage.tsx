import {
  DataTable,
  type DataTableColumn,
} from '@/components/core-components/data-table'
import {
  ArchiveFillIcon,
  AudioFillIcon,
  BinaryIcon,
  CodeFillIcon,
  DocumentFillIcon,
  FileFillIcon,
  GraphicIcon,
  ImageFillIcon,
  Pdf2Icon,
  PresentationFillIcon,
  ShellFillIcon,
  SpreadSheetFillIcon,
  TrashFillIcon,
  VideoFillIcon,
} from '@/components/icons'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui'
import useConfirm from '@/hooks/useConfirm'
import type { ItemCategory } from '@/prisma/enums'
import { auth } from '@/services/auth'
import { emptyUserBucket, getStorageOverview } from '@/services/storage-actions'
import { Button } from '@/ui/button'
import { toIcon } from '@/utils'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { JSX, SVGProps } from 'react'
import { redirect, useFetcher } from 'react-router'
import type { Route } from './+types/storage'

export { ErrorBoundary } from '@/components/error-boundary'

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  await emptyUserBucket(session.user.id)
  return { ok: true }
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { quota, breakdown, largestItems, duplicates } =
    await getStorageOverview(session.user.id)

  return {
    bucket: session.user.bucket,
    quota,
    breakdown: breakdown.map((b) => ({
      category: b.category,
      size: Number(b.size),
      count: b.count,
      percentage: quota.total > 0 ? Math.round((Number(b.size) / Number(quota.total)) * 100) : 0,
    })),
    largestItems: largestItems.map((item) => ({
      id: item.id,
      name: item.name,
      size: Number(item.size),
      category: item.category,
      parentId: item.parentId,
    })),
    duplicates: duplicates.map((d) => ({
      name: d.name,
      size: Number(d.size),
      count: d.count,
      wastingBytes: Number(d.size) * (d.count - 1),
      items: d.items.map((i) => ({
        id: i.id,
        parentId: i.parentId,
        createdAt: i.createdAt.toISOString(),
      })),
    })),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type IconComp = (props: SVGProps<SVGSVGElement>) => JSX.Element

const categoryIcon: Record<string, IconComp> = {
  image: ImageFillIcon,
  video: VideoFillIcon,
  audio: AudioFillIcon,
  document: DocumentFillIcon,
  spreadsheet: SpreadSheetFillIcon,
  presentation: PresentationFillIcon,
  text: FileFillIcon,
  pdf: Pdf2Icon,
  archive: ArchiveFillIcon,
  code: CodeFillIcon,
  script: ShellFillIcon,
  binaries: BinaryIcon,
  graphic: GraphicIcon,
  unknown: FileFillIcon,
}

const categoryColor: Record<ItemCategory, string> = {
  image: '--chart-10',
  video: '--chart-14',
  audio: '--chart-9',
  document: '--chart-11',
  spreadsheet: '--chart-7',
  presentation: '--chart-12',
  text: '--chart-4',
  pdf: '--chart-13',
  archive: '--chart-8',
  code: '--chart-5',
  script: '--chart-1',
  binaries: '--chart-2',
  graphic: '--chart-6',
  unknown: '--chart-3',
}
const progressBgColor: Record<ItemCategory, string> = {
  image: '[&_div]:bg-chart-10',
  video: '[&_div]:bg-chart-14',
  audio: '[&_div]:bg-chart-9',
  document: '[&_div]:bg-chart-11',
  spreadsheet: '[&_div]:bg-chart-7',
  presentation: '[&_div]:bg-chart-12',
  text: '[&_div]:bg-chart-4',
  pdf: '[&_div]:bg-chart-13',
  archive: '[&_div]:bg-chart-8',
  code: '[&_div]:bg-chart-5',
  script: '[&_div]:bg-chart-1',
  binaries: '[&_div]:bg-chart-2',
  graphic: '[&_div]:bg-chart-6',
  unknown: '[&_div]:bg-chart-3',
}

function colorVar(category: string): string {
  return `var(${categoryColor[category as ItemCategory] ?? '--chart-3'})`
}

function toProgressColor(category: string): string {
  return `bg-(var(${categoryColor[category as ItemCategory]})!)}`
}
const CAT_GLYPH: Record<string, string> = {
  image: 'IMG',
  video: 'VID',
  audio: 'AUD',
  document: 'DOC',
  spreadsheet: 'XLS',
  presentation: 'PPT',
  text: 'TXT',
  pdf: 'PDF',
  archive: 'ARC',
  code: 'COD',
  script: 'SCR',
  binaries: 'BIN',
  graphic: 'GFX',
  unknown: 'UNK',
}

const statusLabel: Record<string, string> = {
  normal: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  exceeded: 'Full',
}

function fmt(bytes: number) {
  return formatSize('byte', 'unit', bytes)
}

// ─── Decorative bracket corners ──────────────────────────────────────────────

function Corners() {
  return (
    <>
      <i className="absolute top-0 left-0 size-3 border-t border-l border-foreground/60 pointer-events-none" />
      <i className="absolute top-0 right-0 size-3 border-t border-r border-foreground/60 pointer-events-none" />
      <i className="absolute bottom-0 left-0 size-3 border-b border-l border-foreground/60 pointer-events-none" />
      <i className="absolute bottom-0 right-0 size-3 border-b border-r border-foreground/60 pointer-events-none" />
    </>
  )
}

// ─── 3-letter category chip ──────────────────────────────────────────────────

function CatChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-5 border border-input rounded-[3px] bg-muted text-xs tracking-tight text-muted-foreground font-stashly">
      {CAT_GLYPH[category] ?? category.slice(0, 3).toUpperCase()}
    </span>
  )
}

// ─── KPI strip card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub: string
  tone?: 'default' | 'danger' | 'accent'
}) {
  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden font-stashly">
      <CardContent className="p-2.5">
        <div className="text-sm uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            'text-base mt-0.5',
            tone === 'danger' && 'text-destructive',
            tone === 'accent' && 'text-primary'
          )}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </CardContent>
    </Card>
  )
}

// ─── By-type breakdown table ─────────────────────────────────────────────────

type Breakdown = Route.ComponentProps['loaderData']['breakdown'][number]

function ByTypeTable({ breakdown }: { breakdown: Breakdown[] }) {
  if (breakdown.length === 0) {
    return (
      <section className="border border-input rounded-md bg-card p-4">
        <h3 className="text-xs uppercase tracking-[0.15em] font-stashly mb-2">
          By Type
        </h3>
        <p className="text-sm text-muted-foreground">No files yet.</p>
      </section>
    )
  }

  const totalSize = breakdown.reduce((s, b) => s + b.size, 0)
  const max = Math.max(...breakdown.map((b) => b.size))
  let columns: DataTableColumn<Breakdown>[] = [
    {
      key: 'category',
      header: 'Category',
      width: '160px',
      cell: (item: Breakdown) => {
        const Icon = toIcon(item.category)
        return (
          <div className="inline-flex items-center gap-2">
            <Icon className="size-5" />
            <span className="capitalize">{item.category}</span>
          </div>
        )
      },
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: (item: Breakdown) => {
        return (
          <Progress
            value={Math.round((item.size / totalSize) * 100)}
            max={totalSize > 0 ? 100 : 0}
            className={cn(`w-full rounded h-3`, '[&_div]:bg-current')}
          />
        )
      },
    },
    {
      key: 'size',
      header: 'Size',
      width: '120px',
      align: 'right',
      cell: (row) => fmt(row.size),
    },
    {
      key: 'count',
      header: 'Count',
      width: '80px',
      align: 'right',
      cell: (row) => row.count,
    },
    {
      key: 'percentage',
      header: '% of total',
      width: '80px',
      align: 'right',
      cell: (row) =>
        `${totalSize > 0 ? Math.round((row.size / totalSize) * 100) : 0}%`,
    },
  ]
  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">
      <CardHeader className="flex items-baseline px-4 py-4">
        <CardTitle className="text-sm uppercase font-stashly">
          By Type
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          — {breakdown.length} types ·{' '}
          {breakdown.reduce((s, b) => s + b.count, 0)} files
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={breakdown}
          className="[&_tr]:hover:bg-inherit"
        />
      </CardContent>
    </Card>
  )
}

// ─── Health actions ──────────────────────────────────────────────────────────

interface ActionRowProps {
  label: string
  detail: string
  cta: string
  tone: 'default' | 'danger' | 'accent'
  onClick?: () => void
  disabled?: boolean
}

function ActionRow({
  label,
  detail,
  cta,
  tone,
  onClick,
  disabled,
}: ActionRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-2 py-1.5 border-b border-dashed border-input last:border-0 h-full">
      <div>
        <div className="text-sm font-stashly">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
      <Button
        size="sm"
        variant={tone === 'accent' ? 'default' : 'outline'}
        className={cn(
          'font-stashly text-xs uppercase tracking-wider',
          tone === 'danger' &&
            'bg-transparent border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground',
          tone === 'default' && 'bg-card! border-input'
        )}
        onClick={onClick}
        disabled={disabled}
      >
        {cta}
      </Button>
    </div>
  )
}

function HealthActions({
  trashBytes,
  reclaimBytes,
  duplicateGroups,
  videoBytes,
  videoCount,
  imageCount,
  onEmptyBucket,
  emptying,
}: {
  trashBytes: number
  reclaimBytes: number
  duplicateGroups: number
  videoBytes: number
  videoCount: number
  imageCount: number
  onEmptyBucket: () => void
  emptying: boolean
}) {
  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden h-full">
      <CardHeader className="flex items-baseline px-4 py-4">
        <CardTitle className="text-sm uppercase font-stashly">Health</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          — actions
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-1">
          <ActionRow
            label="Empty bucket"
            detail={`${fmt(trashBytes)} in trash · permanent`}
            cta={emptying ? 'Emptying…' : 'Empty'}
            tone="danger"
            onClick={onEmptyBucket}
            disabled={emptying}
          />
          <ActionRow
            label="Resolve duplicates"
            detail={`${duplicateGroups} groups · save ${fmt(reclaimBytes)}`}
            cta="Resolve"
            tone="accent"
            disabled
          />
          <ActionRow
            label="Archive large videos"
            detail={`${videoCount} videos · ${fmt(videoBytes)}`}
            cta="Archive"
            tone="default"
            disabled
          />
          <ActionRow
            label="Compress images"
            detail={`${imageCount} images · est. save 5%`}
            cta="Compress"
            tone="default"
            disabled
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Largest files list ──────────────────────────────────────────────────────

type LargestItem = Route.ComponentProps['loaderData']['largestItems'][number]

function LargestFilesList({ items }: { items: LargestItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">
        <CardHeader className="flex items-baseline px-4 py-4">
          <CardTitle className="text-sm uppercase font-stashly">
            Largest Files
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">No files yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">
      <CardHeader className="flex items-baseline px-4 py-4">
        <CardTitle className="text-sm uppercase font-stashly">
          Largest Files
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          — top {items.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <ul className="space-y-0.5 font-stashly">
          {items.map((f, i) => {
            const Icon = toIcon(f.category) ?? FileFillIcon
            return (
              <li
                key={f.id}
                className="grid grid-cols-[20px_20px_1fr_auto] items-center gap-3 py-1.5 px-1.5 rounded-sm hover:bg-muted/40"
              >
                <span className="text-xs text-muted-foreground text-right tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Icon className="size-5!" />
                <span className="text-xs truncate min-w-0">{f.name}</span>
                <span className="text-xs text-right tabular-nums">
                  {fmt(f.size)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// ─── Duplicates list ─────────────────────────────────────────────────────────

type Duplicate = Route.ComponentProps['loaderData']['duplicates'][number]

function DuplicatesList({ duplicates }: { duplicates: Duplicate[] }) {
  const totalWaste = duplicates.reduce((s, d) => s + d.wastingBytes, 0)

  if (duplicates.length === 0) {
    return (
      <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">
        <CardHeader className="flex items-baseline px-4 py-4">
          <CardTitle className="text-sm uppercase font-stashly">
            Duplicates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No duplicates detected.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">
      <CardHeader className="flex items-baseline px-4 py-4">
        <CardTitle className="text-sm uppercase font-stashly">
          Duplicates
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          — {duplicates.length} groups
        </CardDescription>
        {totalWaste > 0 && (
          <span className="ml-auto inline-flex items-center h-6 px-2 text-xs uppercase tracking-wider rounded-sm border border-primary bg-primary/10 text-primary font-stashly">
            Save {fmt(totalWaste)}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <ul className="space-y-0.5 font-stashly">
          {duplicates.map((d) => (
            <li
              key={`${d.name}-${d.size}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5 px-1.5 rounded-sm hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="text-xs truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {d.count - 1} extra · wasting {fmt(d.wastingBytes)}
                </div>
              </div>
              <span className="inline-flex items-center justify-center w-7 h-5 border border-input rounded-[3px] text-xs text-muted-foreground">
                ×{d.count}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
                {fmt(d.size)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StoragePage({ loaderData }: Route.ComponentProps) {
  const { quota, breakdown, largestItems, duplicates, bucket } = loaderData
  const fetcher = useFetcher()
  const { open: confirmEmpty } = useConfirm()

  // Derived KPIs
  const fileCount = breakdown.reduce((s, b) => s + b.count, 0)
  const typeCount = breakdown.length
  const usedPct =
    quota.total > 0
      ? Math.round((Number(quota.used) / Number(quota.total)) * 100)
      : 0
  const avgPerFile = fileCount > 0 ? Number(quota.used) / fileCount : 0
  const largest = largestItems[0]
  const reclaimBytes = duplicates.reduce((s, d) => s + d.wastingBytes, 0)
  const videoBucket = breakdown.find((b) => b.category === 'video')
  const imageBucket = breakdown.find((b) => b.category === 'image')

  function handleEmptyBucket() {
    confirmEmpty({
      title: 'Empty Bucket',
      description:
        'This will permanently delete all your files and cannot be undone. Are you sure?',
      confirmText: 'Empty Bucket',
      variant: 'destructive',
      onConfirm: () => fetcher.submit({}, { method: 'POST' }),
    })
  }

  return (
    <div className="mx-auto">
      {/* ── Page header — matches the app's flat in-route header pattern ── */}
      <header className="flex items-center justify-between gap-4 pb-3 border-b border-input">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-xl font-semibold font-stashly truncate">
            Storage
          </h1>
          <span className="text-sm text-muted-foreground font-stashly hidden md:inline">
            / {bucket}
            {quota.status !== 'normal' && (
              <>
                {' '}
                ·{' '}
                <span className="text-destructive">
                  {quota.status}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="font-stashly bg-card! border-input"
            disabled
          >
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmptyBucket}
            disabled={fetcher.state === 'submitting'}
            className="font-stashly uppercase tracking-wider bg-transparent border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <TrashFillIcon className="size-4" />
            Empty bucket
          </Button>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-3">
        {/* KPI strip */}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <KpiCard
            label="Bucket"
            value={fmt(Number(quota.used))}
            sub={`of ${fmt(Number(quota.total))} · ${usedPct}%`}
          />
          <KpiCard
            label="Files"
            value={String(fileCount)}
            sub={`across ${typeCount} types`}
          />
          <KpiCard label="Avg" value={fmt(avgPerFile)} sub="per file" />
          <KpiCard
            label="Largest"
            value={largest ? fmt(largest.size) : '—'}
            sub={largest ? `${largest.category} · ${largest.name}` : 'no files'}
          />
          <KpiCard
            label="Trash"
            value={fmt(Number(quota.deleted))}
            sub="recently deleted"
            tone="danger"
          />
          <KpiCard
            label="Reclaim"
            value={fmt(Number(reclaimBytes))}
            sub={`${duplicates.length} dupes`}
            tone="accent"
          />
        </div>

        {/* By Type */}
        <div className="col-span-12 lg:col-span-7">
          <ByTypeTable breakdown={breakdown} />
        </div>

        {/* Health */}
        <div className="col-span-12 lg:col-span-5">
          <HealthActions
            trashBytes={Number(quota.deleted)}
            reclaimBytes={reclaimBytes}
            duplicateGroups={duplicates.length}
            videoBytes={videoBucket?.size ?? 0}
            videoCount={videoBucket?.count ?? 0}
            imageCount={imageBucket?.count ?? 0}
            onEmptyBucket={handleEmptyBucket}
            emptying={fetcher.state === 'submitting'}
          />
        </div>

        {/* Largest Files */}
        <div className="col-span-12 lg:col-span-7">
          <LargestFilesList items={largestItems} />
        </div>

        {/* Duplicates */}
        <div className="col-span-12 lg:col-span-5">
          <DuplicatesList duplicates={duplicates} />
        </div>
      </div>
    </div>
  )
}
