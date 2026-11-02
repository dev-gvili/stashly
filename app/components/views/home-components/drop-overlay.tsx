import { UploadFillIcon } from '@/components/icons'

export function DropOverlay({ destination = 'My stash' }: { destination?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-xs"
    >
      <UploadFillIcon className="size-9 text-primary" />
      <span className="font-stashly text-lg font-semibold tracking-tight">Drop to upload to {destination}</span>
      <span className="font-stashly text-sm text-muted-foreground">Files become searchable as soon as they land</span>
    </div>
  )
}
