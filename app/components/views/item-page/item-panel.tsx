import type { JSX } from 'react'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import {
  AudioFillIcon,
  CollectionFillIcon,
  DetailsFillIcon,
  DocumentFillIcon,
  HeartFillIcon,
  ActivityFillIcon,
  Pdf2Icon,
} from '@/components/icons'
import { ActivityFeed } from '@/components/core-components/activity-feed'
import type { ActivityWithRelations } from '@/utils/activity'
import {
  ScrollArea,
  Sidebar,
  useSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
} from '@/components/ui'

// ---------------------------------------------------------------------------
// Types (subset of what getFileItem returns — only what the panel renders)
// ---------------------------------------------------------------------------

export type PanelItemShape = {
  id: string
  name: string
  size: bigint
  createdAt: Date | string | null
  updatedAt: Date | string | null
  openedAt?: Date | string | null
  status: string
  file: { mimeType: string | null; extension: string | null } | null
  audio: {
    title: string | null
    artist: string | null
    album: string | null
    albumArtist: string | null
    track: number | null
    trackCount: number | null
    duration: number | null
    bitrate: number | null
    bitDepth?: number | null
    sampleRate?: number | null
    channels?: number | null
  } | null
  pdf?: {
    pageCount: number | null
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
    producer: string | null
    pdfVersion: string | null
    language: string | null
    hasFormFields: boolean | null
    hasSignatures: boolean | null
    pageWidth: number | null
    pageHeight: number | null
    docCreatedAt: Date | string | null
    docModifiedAt: Date | string | null
  } | null
  favorites: Array<{
    favoritedBy: { id: string; name: string; image: string | null }
  }>
  permissions: Array<{
    roles: string
    users: Array<{ id: string; name: string; image: string | null }>
  }>
  activities: Array<ActivityWithRelations>
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function fmtDuration(sec: number | null | undefined): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtSize(bytes: bigint): string {
  return formatSize('byte', 'unit', Number(bytes))
}

// Named paper sizes in PDF points (1pt = 1/72in), portrait orientation.
const PAPER_SIZES: Array<{
  name: string
  w: number
  h: number
  metric: boolean
}> = [
  { name: 'Letter', w: 612, h: 792, metric: false },
  { name: 'Legal', w: 612, h: 1008, metric: false },
  { name: 'Tabloid', w: 792, h: 1224, metric: false },
  { name: 'A3', w: 842, h: 1191, metric: true },
  { name: 'A4', w: 595, h: 842, metric: true },
  { name: 'A5', w: 420, h: 595, metric: true },
]

function fmtPageSize(
  widthPt: number | null | undefined,
  heightPt: number | null | undefined
): string | null {
  if (!widthPt || !heightPt) return null
  const short = Math.min(widthPt, heightPt)
  const long = Math.max(widthPt, heightPt)
  const match = PAPER_SIZES.find(
    (p) => Math.abs(p.w - short) <= 3 && Math.abs(p.h - long) <= 3
  )
  const dims = match?.metric
    ? `${Math.round((widthPt / 72) * 25.4)} × ${Math.round((heightPt / 72) * 25.4)} mm`
    : `${Math.round((widthPt / 72) * 10) / 10} × ${Math.round((heightPt / 72) * 10) / 10} in`
  return match ? `${match.name} · ${dims}` : dims
}

// ---------------------------------------------------------------------------
// Panel atoms
// ---------------------------------------------------------------------------

function SectionHead({ icon, label }: { icon?: JSX.Element; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && (
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <h3 className="font-stashly text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <dt className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-xs',
          mono ? 'font-stashly tabular-nums' : ''
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function UserAvatar({
  name,
  image,
  role,
}: {
  name: string
  image: string | null
  role?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {image ? (
        <img
          src={image}
          alt={name}
          className="size-7 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs">{name}</span>
      {role && (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
          {role}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail blocks
// ---------------------------------------------------------------------------

function AudioDetails({ item }: { item: PanelItemShape }) {
  const a = item.audio
  return (
    <dl>
      <Row label="Kind" value={item.file?.mimeType} mono />
      <Row label="Size" value={fmtSize(item.size)} />
      {a?.duration != null && (
        <Row label="Duration" value={fmtDuration(a.duration)} mono />
      )}
      {a?.bitrate != null && (
        <Row label="Bitrate" value={`${a.bitrate} kbps`} mono />
      )}
    </dl>
  )
}

function PdfDetails({ item }: { item: PanelItemShape }) {
  const p = item.pdf
  return (
    <dl>
      <Row label="Kind" value={item.file?.mimeType} mono />
      <Row label="Size" value={fmtSize(item.size)} />
      {p?.pageCount != null && (
        <Row label="Pages" value={String(p.pageCount)} mono />
      )}
      <Row label="Page size" value={fmtPageSize(p?.pageWidth, p?.pageHeight)} />
      <Row label="Title" value={p?.title} />
      <Row label="Author" value={p?.author} />
      <Row label="Producer" value={p?.producer} />
    </dl>
  )
}

function DocumentInfo({ pdf }: { pdf: PanelItemShape['pdf'] }) {
  if (!pdf) return null
  const rows = [
    pdf.subject,
    pdf.creator,
    pdf.language,
    pdf.pdfVersion,
    pdf.docCreatedAt,
    pdf.docModifiedAt,
    pdf.hasFormFields,
    pdf.hasSignatures,
  ]
  if (!rows.some((v) => v != null && v !== false && v !== '')) return null
  return (
    <section>
      <SectionHead
        icon={<DocumentFillIcon className="size-4" />}
        label="Document"
      />
      <dl>
        <Row label="Subject" value={pdf.subject} />
        <Row label="Created with" value={pdf.creator} />
        <Row label="Language" value={pdf.language} mono />
        {pdf.pdfVersion && (
          <Row label="PDF version" value={pdf.pdfVersion} mono />
        )}
        {pdf.docCreatedAt && (
          <Row label="Doc created" value={fmtDate(pdf.docCreatedAt)} mono />
        )}
        {pdf.docModifiedAt && (
          <Row label="Doc modified" value={fmtDate(pdf.docModifiedAt)} mono />
        )}
        {pdf.hasFormFields && <Row label="Form fields" value="Yes" />}
        {pdf.hasSignatures && <Row label="Signed" value="Yes" />}
      </dl>
    </section>
  )
}

function TrackDetails({ audio }: { audio: PanelItemShape['audio'] }) {
  if (!audio) return null
  const { artist, album, albumArtist, track, trackCount } = audio
  const trackStr =
    track != null
      ? trackCount != null
        ? `${track} of ${trackCount}`
        : String(track)
      : null
  if (!artist && !album && !trackStr) return null
  return (
    <section>
      <SectionHead
        icon={<AudioFillIcon className="size-4" />}
        label="Track"
      />
      <dl>
        <Row label="Artist" value={artist} />
        <Row label="Album" value={album} />
        {albumArtist && albumArtist !== artist && (
          <Row label="Album artist" value={albumArtist} />
        )}
        <Row label="Track" value={trackStr} mono />
      </dl>
    </section>
  )
}

function Timeline({ item }: { item: PanelItemShape }) {
  return <ActivityFeed activities={item.activities} />
}

function ItemDates({ item }: { item: PanelItemShape }) {
  return (
    <dl>
      <Row label="Added" value={fmtDate(item.createdAt)} mono />
      {item.updatedAt && (
        <Row label="Modified" value={fmtDate(item.updatedAt)} mono />
      )}
      {item.openedAt && (
        <Row label="Last opened" value={fmtDate(item.openedAt)} mono />
      )}
    </dl>
  )
}

function Sharing({ item }: { item: PanelItemShape }) {
  const allUsers = item.permissions.flatMap((p) =>
    p.users.map((u) => ({ ...u, role: p.roles }))
  )
  if (!allUsers.length) {
    return (
      <p className="text-xs text-muted-foreground">Only you have access.</p>
    )
  }
  return (
    <div className="space-y-2.5">
      {allUsers.map((u) => (
        <UserAvatar key={u.id} name={u.name} image={u.image} role={u.role} />
      ))}
    </div>
  )
}

function FavoriteCount({ item }: { item: PanelItemShape }) {
  const count = item.favorites.length
  if (!count) return null
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <HeartFillIcon
        className="text-destructive size-4"
      />
      <span>
        Favorited by{' '}
        <span className="font-medium text-foreground">
          {item.favorites
            .slice(0, 2)
            .map((f) => f.favoritedBy.name)
            .join(', ')}
          {count > 2 ? ` +${count - 2} more` : ''}
        </span>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ItemPanel — exported main component
// ---------------------------------------------------------------------------

export function ItemPanel({
  item,
  className,
}: {
  item: PanelItemShape
  className?: string
}) {
  const isPdf = !!item.pdf || item.file?.mimeType === 'application/pdf'
  const displayTitle =
    item.audio?.title ?? item.pdf?.title ?? item.name.replace(/\.[^.]+$/, '')
  const { open, state } = useSidebar('item_panel')
  return (
    <Sidebar
      side="right"
      id="item_panel"
      collapsible="none"
      variant="sidebar"
      width="sm"
      className='p-4 bg-card'
    >
      {/* Header */}
      <SidebarHeader className="bg-card!">
        {/* Category badge */}
        <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 font-stashly text-xs text-secondary-foreground">
          {isPdf ? (
            <Pdf2Icon className="size-4" />
          ) : (
            <AudioFillIcon className="size-4" />
          )}
          {isPdf ? 'PDF' : 'Audio'}
        </span>
        <h1 className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
          {displayTitle}
        </h1>
        {(item.audio?.artist || item.pdf?.author) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.audio?.artist ?? item.pdf?.author}
          </p>
        )}
        <FavoriteCount item={item} />
      </SidebarHeader>

      {/* Scrollable body */}
      <SidebarContent className="bg-card! border-none">
        <ScrollArea className="h-full">
          <SidebarGroup>
            <SidebarGroupContent>
              {/* Details */}
              <section>
                <SectionHead
                  icon={<DetailsFillIcon className="size-4" />}
                  label="Details"
                />
                {isPdf ? (
                  <PdfDetails item={item} />
                ) : (
                  <AudioDetails item={item} />
                )}
              </section>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Track info */}
          <TrackDetails audio={item.audio} />

          {/* PDF document info */}
          <DocumentInfo pdf={item.pdf ?? null} />

          {/* Timeline */}
          <section>
            <SectionHead
              icon={<ActivityFillIcon className="size-4" />}
              label="Timeline"
            />
            <ItemDates item={item} />
          </section>

          {/* Activity */}
          <section>
            <SectionHead
              icon={<ActivityFillIcon className="size-4" />}
              label="Activity"
            />
            <Timeline item={item} />
          </section>

          {/* Sharing */}
          {item.permissions.length > 0 && (
            <section>
              <SectionHead
                icon={<CollectionFillIcon className="size-4" />}
                label="Shared with"
              />
              <Sharing item={item} />
            </section>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="bg-card"></SidebarFooter>
    </Sidebar>
  )
}
