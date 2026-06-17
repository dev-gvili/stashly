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
  VideoFillIcon,
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
  Avatar,
  AvatarImage,
  AvatarFallback,
  SidebarProvider,
} from '@/components/ui'
import { toUserInitial } from '@/utils'
import { user } from '@/schemas/machine.schemas'

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
  markdown?: {
    title: string | null
    author: string | null
    description: string | null
    tags: string | null
    wordCount: number | null
    readingTime: number | null
    headingCount: number | null
    linkCount: number | null
    imageCount: number | null
    codeBlockCount: number | null
    taskCount: number | null
    hasFrontmatter: boolean | null
    docCreatedAt: Date | string | null
    docModifiedAt: Date | string | null
  } | null
  video?: {
    width: number | null
    height: number | null
    duration: number | null
    bitrate: number | null
    codec: string | null
    container: string | null
    frameRate: number | null
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
    <div className="mb-4 inline-flex items-start gap-2">
      {icon}
      <h3 className="font-stashly text-xs  uppercase text-muted-foreground">
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
    <div className="flex items-baseline justify-between gap-4 py-1 flex-wrap">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate whitespace-pre-line text-right text-xs text-muted-foreground w-full',
          'font-stashly tabular-nums flex-1'
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
      <Avatar className="h-8 w-8 rounded-md">
        <AvatarImage src={image || ''} alt={name!} />
        <AvatarFallback className="rounded-sm font-sans">
          {toUserInitial(name!)}
        </AvatarFallback>
      </Avatar>
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

function VideoDetails({ item }: { item: PanelItemShape }) {
  const v = item.video
  const resolution = v?.width && v?.height ? `${v.width} × ${v.height}` : null
  return (
    <dl className="space-y-1">
      <Row label="Kind" value={item.file?.mimeType || 'Video'} mono />
      <Row label="Size" value={fmtSize(item.size)} />
      {v?.duration != null && (
        <Row label="Duration" value={fmtDuration(v.duration)} mono />
      )}
      <Row label="Resolution" value={resolution} mono />
      {v?.frameRate != null && (
        <Row label="Frame rate" value={`${Math.round(v.frameRate)} fps`} mono />
      )}
      <Row label="Codec" value={v?.codec} mono />
      <Row label="Container" value={v?.container} mono />
      {v?.bitrate != null && (
        <Row
          label="Bitrate"
          value={`${Math.round(v.bitrate / 1000)} kbps`}
          mono
        />
      )}
    </dl>
  )
}

function PdfDetails({ item }: { item: PanelItemShape }) {
  const p = item.pdf
  return (
    <dl className="space-y-1">
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
        icon={<DocumentFillIcon className="size-6" />}
        label="Document"
      />
      <dl className="space-y-1">
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

function MarkdownDetails({ item }: { item: PanelItemShape }) {
  const m = item.markdown
  return (
    <dl>
      <Row label="Kind" value={item.file?.mimeType || 'Markdown'} mono />
      <Row label="Size" value={fmtSize(item.size)} />
      {m?.wordCount != null && (
        <Row label="Words" value={m.wordCount.toLocaleString()} mono />
      )}
      {m?.readingTime != null && m.readingTime > 0 && (
        <Row label="Reading time" value={`${m.readingTime} min`} mono />
      )}
      {m?.headingCount != null && (
        <Row label="Headings" value={String(m.headingCount)} mono />
      )}
      <Row label="Title" value={m?.title} />
      <Row label="Author" value={m?.author} />
    </dl>
  )
}

function MarkdownInfo({ md }: { md: PanelItemShape['markdown'] }) {
  if (!md) return null
  const rows = [
    md.description,
    md.tags,
    md.linkCount,
    md.imageCount,
    md.codeBlockCount,
    md.taskCount,
    md.docCreatedAt,
    md.docModifiedAt,
  ]
  if (!rows.some((v) => v != null && v !== '' && v !== 0)) return null
  return (
    <section className="py-4">
      <SectionHead
        icon={<DocumentFillIcon className="size-4" />}
        label="Content"
      />
      <dl className="space-y-1">
        <Row label="Description" value={md.description} />
        <Row label="Tags" value={md.tags} />
        {md.linkCount != null && md.linkCount > 0 && (
          <Row label="Links" value={String(md.linkCount)} mono />
        )}
        {md.imageCount != null && md.imageCount > 0 && (
          <Row label="Images" value={String(md.imageCount)} mono />
        )}
        {md.codeBlockCount != null && md.codeBlockCount > 0 && (
          <Row label="Code blocks" value={String(md.codeBlockCount)} mono />
        )}
        {md.taskCount != null && md.taskCount > 0 && (
          <Row label="Tasks" value={String(md.taskCount)} mono />
        )}
        {md.docCreatedAt && (
          <Row label="Doc created" value={fmtDate(md.docCreatedAt)} mono />
        )}
        {md.docModifiedAt && (
          <Row label="Doc modified" value={fmtDate(md.docModifiedAt)} mono />
        )}
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
      <SectionHead icon={<AudioFillIcon className="size-4" />} label="Track" />
      <dl className="space-y-1">
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
    <dl className="space-y-1">
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
    <div className="space-y-2">
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
      <HeartFillIcon className="text-destructive size-4" />
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
  const isMarkdown =
    !!item.markdown || /\.(md|markdown|mdown|mkd)$/i.test(item.name)
  const isVideo = !!item.video || !!item.file?.mimeType?.startsWith('video/')
  const displayTitle =
    item.audio?.title ??
    item.pdf?.title ??
    item.markdown?.title ??
    item.name.replace(/\.[^.]+$/, '')
  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        side="right"
        id="item_panel"
        collapsible="offcanvas"
        variant="floating"
        width="20rem"
        className="p-0 bg-card border border-input! shadow-stashly rounded-md h-[calc(100vh-4rem)] overflow-hidden"
      >
        {/* Header */}
        <SidebarHeader className="bg-card! ">
          {/* Category badge */}
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-md  px-2 py-1 font-stashly text-xs text-secondary-foreground">
            {isPdf ? (
              <Pdf2Icon className="size-4" />
            ) : isMarkdown ? (
              <DocumentFillIcon className="size-4" />
            ) : isVideo ? (
              <VideoFillIcon className="size-4" />
            ) : (
              <AudioFillIcon className="size-4" />
            )}
            {isPdf
              ? 'PDF'
              : isMarkdown
                ? 'Markdown'
                : isVideo
                  ? 'Video'
                  : 'Audio'}
          </span>
          <h1 className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
            {displayTitle}
          </h1>
          {(item.audio?.artist ||
            item.pdf?.author ||
            item.markdown?.author) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.audio?.artist ?? item.pdf?.author ?? item.markdown?.author}
            </p>
          )}
          <FavoriteCount item={item} />
        </SidebarHeader>

        {/* Scrollable body */}
        <ScrollArea className="h-screen overflow-hidden bg-card! p-4">
          {/* Details */}
          <section className="py-4">
            <SectionHead
              icon={<DetailsFillIcon className="size-5" />}
              label="Details"
            />
            {isPdf ? (
              <PdfDetails item={item} />
            ) : isMarkdown ? (
              <MarkdownDetails item={item} />
            ) : isVideo ? (
              <VideoDetails item={item} />
            ) : (
              <AudioDetails item={item} />
            )}
          </section>

          {/* Track info */}
          <TrackDetails audio={item.audio} />

          {/* PDF document info */}
          <DocumentInfo pdf={item.pdf ?? null} />

          {/* Markdown content info */}
          <MarkdownInfo md={item.markdown ?? null} />

          {/* Timeline */}
          <section className="py-4">
            <SectionHead
              icon={<ActivityFillIcon className="size-4" />}
              label="Timeline"
            />
            <ItemDates item={item} />
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

          {/* Activity */}
          <section className="py-4">
            <SectionHead
              icon={<ActivityFillIcon className="size-4" />}
              label="Activity"
            />
            <Timeline item={item} />
          </section>
        </ScrollArea>
        <SidebarFooter className="bg-card"></SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}
