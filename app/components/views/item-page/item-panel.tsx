import { ActivityFeed } from '@/components/core-components/activity-feed'
import { RenameDialog } from '@/components/core-components/rename-dialog'
import { ShareDialog } from '@/components/core-components/share-dialog'
import {
  ActivityFillIcon,
  AudioFillIcon,
  CollectionFillIcon,
  DetailsFillIcon,
  DocumentFillIcon,
  DownloadFillIcon,
  HeartFillIcon,
  HeartIcon,
  ImageFillIcon,
  LinkIcon,
  MoreMenuFillIcon,
  MoveFillIcon,
  Pdf2Icon,
  RenameFillIcon,
  ShareItemFillIcon,
  TrashFillIcon,
  VideoFillIcon,
} from '@/components/icons'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '@/components/ui'
import { useClipboard, useZoom } from '@/hooks'
import type { StashItemPanel } from '@/types/stash.types'
import { toUserInitial } from '@/utils'
import {
  formatDuration,
  formatMediaDate,
  formatPageSize,
  formatSize,
} from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { JSX } from 'react'
import React from 'react'
import { href, useFetcher } from 'react-router'

function SectionHead({ icon, label }: { icon?: JSX.Element; label: string }) {
  return (
    <div className="mb-4 inline-flex items-start gap-2">
      {icon}
      <h3 className="font-stashly text-sm text-semibold uppercase text-muted-foreground">
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

function AudioDetails({ item }: { item: StashItemPanel }) {
  const a = item.audio
  return (
    <dl>
      <Row label="Kind" value={item.file?.mimeType} mono />
      <Row label="Size" value={formatSize('byte', 'unit', Number(item.size))} />
      {a?.duration != null && (
        <Row label="Duration" value={formatDuration(a.duration)} mono />
      )}
      {a?.bitrate != null && (
        <Row label="Bitrate" value={`${a.bitrate} kbps`} mono />
      )}
    </dl>
  )
}

function VideoDetails({ item }: { item: StashItemPanel }) {
  const v = item.video
  const resolution = v?.width && v?.height ? `${v.width} × ${v.height}` : null
  return (
    <dl className="space-y-1">
      <Row label="Kind" value={item.file?.mimeType || 'Video'} mono />
      <Row label="Size" value={formatSize('byte', 'unit', Number(item.size))} />
      {v?.duration != null && (
        <Row label="Duration" value={formatDuration(v.duration)} mono />
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

function ImageDetails({ item }: { item: StashItemPanel }) {
  const img = item.image
  const dims = img?.width && img?.height ? `${img.width} × ${img.height}` : null
  const dpi =
    img?.horizontalResolution && img?.verticalResolution
      ? img.horizontalResolution === img.verticalResolution
        ? `${img.horizontalResolution} DPI`
        : `${img.horizontalResolution} × ${img.verticalResolution} DPI`
      : null
  const depth = img?.bitDepth != null ? `${img.bitDepth}-bit` : null
  return (
    <dl className="space-y-1">
      <Row label="Kind" value={item.file?.mimeType || 'Image'} mono />
      <Row label="Size" value={formatSize('byte', 'unit', Number(item.size))} />
      <Row label="Dimensions" value={dims} mono />
      <Row label="Resolution" value={dpi} mono />
      <Row label="Bit depth" value={depth} mono />
    </dl>
  )
}

function CameraInfo({ image }: { image: StashItemPanel['image'] }) {
  if (!image) return null
  const camera =
    image.cameraMake || image.cameraModel
      ? [image.cameraMake, image.cameraModel].filter(Boolean).join(' ')
      : null
  const aperture = image.fNumber != null ? `f/${image.fNumber}` : null
  const iso = image.iso != null ? `ISO ${image.iso}` : null
  const shutter =
    image.exposureTime != null
      ? image.exposureTime < 1
        ? `1/${Math.round(1 / image.exposureTime)}s`
        : `${image.exposureTime}s`
      : null
  const focal = image.focalLength != null ? `${image.focalLength}mm` : null
  const taken = image.takenDateTime ? formatMediaDate(image.takenDateTime) : null
  const gps =
    image.latitude != null && image.longitude != null
      ? `${image.latitude.toFixed(5)}, ${image.longitude.toFixed(5)}`
      : null

  if (!camera && !aperture && !iso && !shutter && !focal && !taken && !gps)
    return null

  return (
    <section className="py-4">
      <SectionHead icon={<ImageFillIcon className="size-4" />} label="Camera" />
      <dl className="space-y-1">
        <Row label="Camera" value={camera} />
        <Row label="Aperture" value={aperture} mono />
        <Row label="ISO" value={iso} mono />
        <Row label="Shutter" value={shutter} mono />
        <Row label="Focal length" value={focal} mono />
        <Row label="Taken" value={taken} mono />
        <Row label="GPS" value={gps} mono />
      </dl>
    </section>
  )
}

function PdfDetails({ item }: { item: StashItemPanel }) {
  const p = item.pdf
  return (
    <dl className="space-y-1">
      <Row label="Kind" value={item.file?.mimeType} mono />
      <Row label="Size" value={formatSize('byte', 'unit', Number(item.size))} />
      {p?.pageCount != null && (
        <Row label="Pages" value={String(p.pageCount)} mono />
      )}
      <Row
        label="Page size"
        value={formatPageSize(p?.pageWidth, p?.pageHeight)}
      />
      <Row label="Title" value={p?.title} />
      <Row label="Author" value={p?.author} />
      <Row label="Producer" value={p?.producer} />
    </dl>
  )
}

function DocumentInfo({ pdf }: { pdf: StashItemPanel['pdf'] }) {
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
          <Row
            label="Doc created"
            value={formatMediaDate(pdf.docCreatedAt)}
            mono
          />
        )}
        {pdf.docModifiedAt && (
          <Row
            label="Doc modified"
            value={formatMediaDate(pdf.docModifiedAt)}
            mono
          />
        )}
        {pdf.hasFormFields && <Row label="Form fields" value="Yes" />}
        {pdf.hasSignatures && <Row label="Signed" value="Yes" />}
      </dl>
    </section>
  )
}

function MarkdownDetails({ item }: { item: StashItemPanel }) {
  const m = item.markdown
  return (
    <dl>
      <Row label="Kind" value={item.file?.mimeType || 'Markdown'} mono />
      <Row label="Size" value={formatSize('byte', 'unit', Number(item.size))} />
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

function MarkdownInfo({ md }: { md: StashItemPanel['markdown'] }) {
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
          <Row
            label="Doc created"
            value={formatMediaDate(md.docCreatedAt)}
            mono
          />
        )}
        {md.docModifiedAt && (
          <Row
            label="Doc modified"
            value={formatMediaDate(md.docModifiedAt)}
            mono
          />
        )}
      </dl>
    </section>
  )
}

function TrackDetails({ audio }: { audio: StashItemPanel['audio'] }) {
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

function Timeline({ item }: { item: StashItemPanel }) {
  return <ActivityFeed activities={item.activities} />
}

function ItemDates({ item }: { item: StashItemPanel }) {
  return (
    <dl className="space-y-1">
      <Row label="Added" value={formatMediaDate(item.createdAt)} mono />
      {item.updatedAt && (
        <Row label="Modified" value={formatMediaDate(item.updatedAt)} mono />
      )}
      {item.openedAt && (
        <Row label="Last opened" value={formatMediaDate(item.openedAt)} mono />
      )}
    </dl>
  )
}

function Sharing({ item }: { item: StashItemPanel }) {
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

function FavoriteCount({ item }: { item: StashItemPanel }) {
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
  item: StashItemPanel
  className?: string
}) {
  const isPdf = !!item.pdf || item.file?.mimeType === 'application/pdf'
  const isMarkdown =
    !!item.markdown || /\.(md|markdown|mdown|mkd)$/i.test(item.name)
  const isVideo = !!item.video || !!item.file?.mimeType?.startsWith('video/')
  const isImage = !!item.image || !!item.file?.mimeType?.startsWith('image/')
  const displayTitle =
    item.audio?.title ??
    item.pdf?.title ??
    item.markdown?.title ??
    item.name.replace(/\.[^.]+$/, '')
  return (
    <Sidebar
      side="right"
      id="item_panel"
      collapsible="offcanvas"
      variant="floating"
      width="20rem"
      className="p-0 bg-card border border-none rounded-md h-[calc(100vh-4rem)] overflow-hidden"
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
          ) : isImage ? (
            <ImageFillIcon className="size-4" />
          ) : (
            <AudioFillIcon className="size-4" />
          )}
          {isPdf
            ? 'PDF'
            : isMarkdown
              ? 'Markdown'
              : isVideo
                ? 'Video'
                : isImage
                  ? 'Image'
                  : 'Audio'}
        </span>
        <h1 className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
          {displayTitle}
        </h1>
        {(item.audio?.artist || item.pdf?.author || item.markdown?.author) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.audio?.artist ?? item.pdf?.author ?? item.markdown?.author}
          </p>
        )}
        <FavoriteCount item={item} />
      </SidebarHeader>

      {/* Tabbed body — Details (everything) vs Activity feed */}
      <Tabs
        defaultValue="details"
        className="flex min-h-0 flex-1 flex-col gap-0 bg-card!"
      >
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="gap-1.5">
              <DetailsFillIcon className="size-5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <ActivityFillIcon className="size-5" />
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Details tab — everything that isn't the activity feed */}
        <TabsContent value="details" className="min-h-0 pb-16">
          <ScrollArea className="h-full overflow-hidden bg-card! p-4 ">
            {/* Details */}
            <section className="py-4">
              <SectionHead
                label="Details"
              />
              {isPdf ? (
                <PdfDetails item={item} />
              ) : isMarkdown ? (
                <MarkdownDetails item={item} />
              ) : isVideo ? (
                <VideoDetails item={item} />
              ) : isImage ? (
                <ImageDetails item={item} />
              ) : (
                <AudioDetails item={item} />
              )}
            </section>

            {/* Camera / EXIF info */}
            <CameraInfo image={item.image ?? null} />

            {/* Track info */}
            <TrackDetails audio={item.audio} />

            {/* PDF document info */}
            <DocumentInfo pdf={item.pdf ?? null} />

            {/* Markdown content info */}
            <MarkdownInfo md={item.markdown ?? null} />

            {/* Timeline */}
            <section className="py-4">
              <SectionHead
                label="Timeline"
              />
              <ItemDates item={item} />
            </section>

            {/* Sharing */}
            {item.permissions.length > 0 && (
              <section className="py-4">
                <SectionHead
                  label="Shared with"
                />
                <Sharing item={item} />
              </section>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Activity tab — the activity feed */}
        <TabsContent value="activity" className="min-h-0">
          <ScrollArea className="h-full overflow-hidden bg-card! p-4">
            <section className="py-4">
              <SectionHead
                icon={<ActivityFillIcon className="size-4" />}
                label="Activity"
              />
              <Timeline item={item} />
            </section>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <SidebarFooter className="bg-card p-0 relative">
        <ActionToolbar item={item} />
      </SidebarFooter>
    </Sidebar>
  )
}

function ToolButton({
  label,
  children,
  onClick,
  active,
  disabled,
  asChild,
}: React.ComponentPropsWithoutRef<typeof Button> & {
  label: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <Tooltip
      content={label}
      side="bottom"
      align="center"
      aria-disabled={disabled}
      asChild
    >
      <Button
        variant="ghost"
        size="icon-sm"
        asChild={asChild}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'hover:bg-transparent data-[state=open]:bg-transparent',
          active && 'text-primary!!'
        )}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

/* floating action toolbar */
function ActionToolbar({ item }: { item: StashItemPanel }) {
  const fetcher = useFetcher({ key: item.id })
  const [isFavorite, setIsFavorite] = React.useState(false) // wire to item.favorite
  const [open, setOpen] = React.useState(false) // share dialog

  /* ----- download ---------------------------------------------------------- */
  const [isDownloading, setIsDownloading] = React.useState(false)
  const handleDownload = React.useCallback(async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const res = await fetch(item.url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = item.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } finally {
      setIsDownloading(false)
    }
  }, [item.url, item.name, isDownloading])

  /* ----- zoom & pan -------------------------------------------------------- */
  const zoom = useZoom()

  /* ----- clipboard --------------------------------------------------------- */
  const { copy: copyLink, copied: linkCopied } = useClipboard()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 ">
      <div className="pointer-events-auto flex items-center justify-around bg-card p-2 w-full">
        <ToolButton
          label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          active={isFavorite}
          onClick={() => setIsFavorite((v) => !v)}
        >
          <HeartIcon
            className={cn('size-5', isFavorite && 'fill-primary text-primary')}
          />
        </ToolButton>
        <ToolButton
          label="Share"
          onClick={(e) => {
            setOpen(true)
          }}
        >
          <ShareItemFillIcon className="size-5" />
        </ToolButton>
        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          itemId={item.id}
          itemName={item.name}
          itemType="file"
        />
        <ToolButton
          label="Download"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <DownloadFillIcon className="size-5" />
        </ToolButton>
        <ToolButton
          label={linkCopied ? 'Copied!' : 'Copy link'}
          onClick={() => copyLink(item.url)}
        >
          <LinkIcon className="size-5" />
        </ToolButton>

        <ToolButton label="Add to collection">
          <CollectionFillIcon className="size-5" />
        </ToolButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-md hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-accent-foreground "
              aria-label="More"
            >
              <MoreMenuFillIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="flex-col flex rounded-md shadow-stashly overflow-hidden font-stashly border border-input p-2 bg-sidebar max-w-max"
          >
            <RenameDialog
              defaultName={item.name}
              intent="rename_item"
              extraData={{ itemId: item.id }}
              action="/api/items"
              title="Rename item"
            >
              <DropdownMenuItem
                className="font-stashly text-sidebar-foreground justify-start px-1.5 hover:bg-transparent"
                onSelect={(e) => e.preventDefault()}
              >
                <RenameFillIcon className="text-current size-5!" /> Rename
              </DropdownMenuItem>
            </RenameDialog>
            <DropdownMenuItem className="font-stashly text-sidebar-foreground justify-start px-1.5 hover:bg-transparent">
              <MoveFillIcon className=" text-current size-5" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="font-stashly text-sidebar-foreground justify-start px-1.5 hover:bg-transparent"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fetcher.submit(
                  { intent: 'trash_item', selectedItem: item.id },
                  { method: 'POST', action: href('/api/items') }
                )
              }}
            >
              <TrashFillIcon className="size-5 text-current" /> Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
