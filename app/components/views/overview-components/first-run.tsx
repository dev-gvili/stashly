import { UploadFillIcon } from '@/components/icons'
import { Trigger } from '@/components/upload'
import { cn } from '@/utils/styles'
import { Link } from 'react-router'

const STEPS = [
  [
    '01',
    'Drop your first files',
    'Anything up to 5 GB each. Images, video, code, documents — Stashly reads them all.',
  ],
  [
    '02',
    'Let it sort itself',
    'Stashly groups by type and date as files land, so folders exist before you make them.',
  ],
  [
    '03',
    'Pin what you live in',
    'Pinned and favorited items ride the top of this page forever after.',
  ],
] as const

/**
 * The overview's first-run state: shown when the account has nothing at all.
 *
 * Deliberately not `FilesEmptyState` — that one is the generic "this list is
 * empty" fallback shared with `all` and `suggestions`, where a welcome
 * headline would be wrong. This is the page's own opening screen.
 *
 * `importTo` is optional: the cloud-import footer only renders once there is
 * somewhere for it to go.
 */
export function OverviewFirstRun({
  importTo,
  className,
}: {
  importTo?: string
  className?: string
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-5xl flex-col', className)}>
      <div className="text-muted-foreground font-stashly text-xs tracking-widest uppercase">
        Welcome to Stashly
      </div>
      <h1 className="font-stashly mt-2.5 text-3xl leading-none">
        Nothing here yet — that&rsquo;s the fun part
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[35em] text-sm text-pretty">
        Your stash is empty. Drop a folder in and this page fills with what you
        touched last, what you pinned, and what needs your attention.
      </p>

      {/* `Trigger` is a <label> over a hidden file input, so the whole zone is
          the browse affordance — no separate click handler. */}
      <Trigger className="border-input bg-card/50 hover:border-ring hover:bg-card mt-7 flex h-60 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-4 text-sm transition-colors">
        <UploadFillIcon className="text-muted-foreground size-8" />
        <span className="text-sm">Drop files or folders here</span>
        <span className="text-muted-foreground text-xs">
          or <span className="text-accent-foreground">browse your device</span>{' '}
          · up to 5 GB per file
        </span>
      </Trigger>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {STEPS.map(([number, title, body]) => (
          <div key={number} className="bg-card rounded-3xl p-5">
            <div className="text-accent-foreground font-stashly text-xs tracking-widest">
              {number}
            </div>
            <div className="mt-2 text-sm">{title}</div>
            <p className="text-muted-foreground mt-1.5 text-xs text-pretty">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="border-input mt-6 flex items-center gap-3 border-t border-dashed pt-5">
        {importTo && (
          <>
            <span className="text-muted-foreground flex-1 text-xs">
              Coming from Drive or Dropbox? Import keeps your folder structure.
            </span>
            <Link
              to={importTo}
              className="bg-card text-muted-foreground hover:text-foreground flex h-9 items-center rounded-xl px-4 text-xs tracking-wider whitespace-nowrap uppercase transition-colors"
            >
              Import from cloud
            </Link>
          </>
        )}
        <Trigger className="bg-accent text-accent-foreground ml-auto flex h-9 items-center rounded-xl border-none px-4 text-xs tracking-wider whitespace-nowrap uppercase">
          Upload files
        </Trigger>
      </div>
    </div>
  )
}
