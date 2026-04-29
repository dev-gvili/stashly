import { auth } from '@/services/auth'
import { redirect, useFetcher } from 'react-router'
import type { Route } from './+types/storage'
import { getStorageOverview, emptyUserBucket } from '@/services/storage-actions'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import {
  ImageIcon,
  VideoIcon,
  AudioIcon,
  DocumentIcon,
  ArchiveIcon,
  CodeIcon,
  PdfIcon,
  SlidesIcon,
  FileIcon,
  BinaryIcon,
  ShellIcon,
  TrashIcon,
  StorageIcon,
} from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import useConfirm from '@/hooks/useConfirm'
import type { JSX, SVGProps } from 'react'

export { ErrorBoundary } from '@/components/error-boundary'

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  await emptyUserBucket(session.user.id)
  return { ok: true }
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const { quota, breakdown, largestItems, duplicates } =
    await getStorageOverview(session.user.id)

  const used = Number(quota?.used ?? 0n)
  const total = Number(quota?.total ?? 0n)

  return {
    quota: {
      used,
      total,
      deleted: Number(quota?.deleted ?? 0n),
      remaining: Number(quota?.remaining ?? 0n),
      status: quota?.status ?? 'normal',
    },
    breakdown: breakdown.map((b) => ({
      category: b.category,
      size: Number(b.size),
      count: b.count,
      percentage: total > 0 ? Math.round((Number(b.size) / total) * 100) : 0,
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

// ─── Category helpers ─────────────────────────────────────────────────────────

type IconComp = (props: SVGProps<SVGSVGElement>) => JSX.Element

const categoryIcon: Record<string, IconComp> = {
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioIcon,
  document: DocumentIcon,
  spreadsheet: FileIcon,
  presentation: SlidesIcon,
  text: FileIcon,
  pdf: PdfIcon,
  archive: ArchiveIcon,
  code: CodeIcon,
  script: ShellIcon,
  binaries: BinaryIcon,
  graphic: FileIcon,
  unknown: FileIcon,
}

const categoryColor: Record<string, string> = {
  image: '#3b82f6',
  video: '#8b5cf6',
  audio: '#ec4899',
  document: '#f59e0b',
  spreadsheet: '#10b981',
  presentation: '#f97316',
  text: '#6b7280',
  pdf: '#ef4444',
  archive: '#84cc16',
  code: '#06b6d4',
  script: '#64748b',
  binaries: '#a855f7',
  graphic: '#f43f5e',
  unknown: '#d1d5db',
}

const statusLabel: Record<string, string> = {
  normal: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  exceeded: 'Full',
}

const statusVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  normal: 'secondary',
  warning: 'outline',
  critical: 'destructive',
  exceeded: 'destructive',
}

function fmt(bytes: number) {
  return formatSize('byte', 'unit', bytes)
}

function CategoryIcon({
  category,
  ...props
}: { category: string } & SVGProps<SVGSVGElement>) {
  const Icon = categoryIcon[category] ?? FileIcon
  return <Icon {...props} />
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuotaCard({
  used,
  total,
  deleted,
  remaining,
  status,
}: {
  used: number
  total: number
  deleted: number
  remaining: number
  status: string
}) {
  const usedPct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const deletedPct = total > 0 ? Math.min((deleted / total) * 100, 100) : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <StorageIcon className="size-4 text-muted-foreground" />
            Storage
          </CardTitle>
          <Badge variant={statusVariant[status] ?? 'secondary'}>
            {statusLabel[status] ?? status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{fmt(used)} used</span>
            <span className="text-muted-foreground">of {fmt(total)}</span>
          </div>
          {/* Storage bar */}
          <div className="h-3 w-full overflow-hidden rounded-md bg-muted">
            <div className="flex h-full">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${usedPct}%` }}
              />
              <div
                className="h-full bg-destructive/40 transition-all"
                style={{ width: `${deletedPct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <LegendDot color="bg-primary" label="Used" value={fmt(used)} />
          <LegendDot
            color="bg-destructive/40"
            label="Trash"
            value={fmt(deleted)}
          />
          <LegendDot color="bg-muted" label="Free" value={fmt(remaining)} />
        </div>
      </CardContent>
    </Card>
  )
}

function LegendDot({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm shrink-0', color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function BreakdownCard({
  breakdown,
}: {
  breakdown: {
    category: string
    size: number
    count: number
    percentage: number
  }[]
}) {
  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No files yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Storage by Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Segmented bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-md">
          {breakdown.map((b) => (
            <div  
              key={b.category}
              className="h-full transition-all"
              style={{
                width: `${b.percentage}%`,
                backgroundColor: categoryColor[b.category] ?? '#d1d5db',
              }}
              title={`${b.category}: ${fmt(b.size)}`}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {breakdown.map((b) => (
            <div
              key={b.category}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: categoryColor[b.category] ?? '#d1d5db',
                  }}
                />
                <CategoryIcon
                  category={b.category}
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="text-sm capitalize truncate">
                  {b.category}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                <span>{fmt(b.size)}</span>
                <span className="text-xs">({b.count})</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LargestFilesCard({
  items,
  maxSize,
}: {
  items: { id: string; name: string; size: number; category: string }[]
  maxSize: number
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Largest Files</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No files found.</p>
        )}
        {items.map((item) => {
          const barPct =
            maxSize > 0 ? Math.round((item.size / maxSize) * 100) : 0
          return (
            <div key={item.id} className="space-y-0.5 py-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon
                    category={item.category}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="text-sm truncate">{item.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmt(item.size)}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function DuplicatesCard({
  duplicates,
}: {
  duplicates: {
    name: string
    size: number
    count: number
    wastingBytes: number
    items: { id: string; parentId: string | null; createdAt: string }[]
  }[]
}) {
  const totalWaste = duplicates.reduce((acc, d) => acc + d.wastingBytes, 0)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">Possible Duplicates</CardTitle>
          {totalWaste > 0 && (
            <Badge variant="outline" className="text-xs shrink-0">
              Save {fmt(totalWaste)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {duplicates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No duplicates detected.
          </p>
        )}
        {duplicates.map((d) => (
          <div key={`${d.name}-${d.size}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{d.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge className="text-xs px-1.5 py-0 h-5">×{d.count}</Badge>
                <span className="text-xs text-muted-foreground">
                  {fmt(d.size)} each
                </span>
              </div>
            </div>
            <p className="text-xs text-destructive">
              {d.count - 1} extra {d.count - 1 === 1 ? 'copy' : 'copies'} —
              wasting {fmt(d.wastingBytes)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoragePage({ loaderData }: Route.ComponentProps) {
  const { quota, breakdown, largestItems, duplicates } = loaderData
  const maxSize = largestItems[0]?.size ?? 0
  const fetcher = useFetcher()
  const { open: confirmEmpty } = useConfirm()

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
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <StorageIcon className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Storage</h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleEmptyBucket}
          disabled={fetcher.state !== 'idle'}
        >
          <TrashIcon className="size-4 mr-1.5" />
          Empty Bucket
        </Button>
      </div>

      <QuotaCard {...quota} />

      <BreakdownCard breakdown={breakdown} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LargestFilesCard items={largestItems} maxSize={maxSize} />
        <DuplicatesCard duplicates={duplicates} />
      </div>
    </div>
  )
}
