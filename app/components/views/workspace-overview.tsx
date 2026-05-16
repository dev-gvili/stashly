import { cn } from '@/utils/styles'
import { WorkspaceIcon, ActivityIcon, UserIcon, FavoriteIcon, AddIcon, MoreIcon } from '@/components/icons'
import type { WorkspaceMemberRole } from '@/prisma/enums'
import { formatSize } from '@/utils/formaters'
import { href, Link } from 'react-router'

// ── Types ────────────────────────────────────────────────────────────

export interface WorkspaceOverviewMember {
  id: string
  name: string
  email: string
  image: string | null
  role: WorkspaceMemberRole
  storageBytes: bigint
  status: 'online' | 'idle' | 'offline'
}

export interface WorkspaceOverviewItem {
  id: string
  name: string
  category: string
  size: bigint
  updatedAt: Date | null
  ownerName: string
}

export interface WorkspaceOverviewPinnedItem {
  id: string
  name: string
  type: 'collection' | 'folder'
  itemCount: number
}

export interface WorkspaceOverviewInvite {
  id: string
  email: string
  role: string
  sentAt: Date
  senderName: string
}

export interface WorkspaceOverviewProps {
  workspace: {
    id: string
    name: string
    slug: string | null
    description: string | null
    storageUsedBytes: bigint
    storageLimitBytes: bigint
    role: WorkspaceMemberRole
    color?: string
  }
  members: WorkspaceOverviewMember[]
  pendingInvites: WorkspaceOverviewInvite[]
  recentItems: WorkspaceOverviewItem[]
  pinnedItems: WorkspaceOverviewPinnedItem[]
  me: string
  variant?: 'ops' | 'dossier' | 'split'
}

// ── Helpers ──────────────────────────────────────────────────────────

const ROLE_META: Record<WorkspaceMemberRole, { short: string; color: string }> = {
  owner:  { short: 'OWN', color: 'oklch(0.62 0.15 39)' },
  admin:  { short: 'ADM', color: 'oklch(0.55 0.18 18)' },
  member: { short: 'MEM', color: 'oklch(0.55 0.15 230)' },
  viewer: { short: 'VWR', color: 'oklch(0.55 0.005 240)' },
}

const CAT_GLYPH: Record<string, string> = {
  video: 'VID', audio: 'AUD', presentation: 'PPT', spreadsheet: 'XLS',
  image: 'IMG', pdf: 'PDF', document: 'DOC', code: 'COD', archive: 'ZIP',
  unknown: 'FIL',
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function fmtStorage(bytes: bigint): string {
  const n = Number(bytes)
  if (n === 0) return '0 B'
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function storagePct(used: bigint, total: bigint): number {
  if (total === 0n) return 0
  return Math.min(100, Number((used * 100n) / total))
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Atoms ────────────────────────────────────────────────────────────

function MemberAvatar({
  name, size = 24, ring = false, image,
}: { name: string; size?: number; ring?: boolean; image?: string | null }) {
  const hue = (name.charCodeAt(0) * 7) % 360
  const bg = `oklch(0.7 0.1 ${hue})`
  return (
    <span
      className={cn('inline-flex items-center justify-center font-stashly rounded-full shrink-0 text-background', ring && 'ring-2 ring-card')}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
      title={name}
    >
      {image
        ? <img src={image} className="w-full h-full rounded-full object-cover" alt={name} />
        : initials(name)}
    </span>
  )
}

function RoleBadge({ role }: { role: WorkspaceMemberRole }) {
  const m = ROLE_META[role]
  return (
    <span
      className="inline-flex items-center h-5 px-1.5 text-[10px] uppercase tracking-[0.12em] rounded-[3px] border font-stashly"
      style={{ borderColor: 'var(--border)', color: m.color }}
    >
      {m.short}
    </span>
  )
}

function Glyph({ g }: { g: string }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-5 border border-border rounded-[3px] bg-muted/30 text-muted-foreground font-stashly text-[9px]">
      {g}
    </span>
  )
}

function MiniBar({ pct, color = 'var(--foreground)' }: { pct: number; color?: string }) {
  return (
    <div className="h-[3px] bg-muted rounded-full overflow-hidden">
      <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

function StatusDot({ status }: { status: WorkspaceOverviewMember['status'] }) {
  return (
    <span className={cn(
      'absolute -bottom-px -right-px w-2 h-2 rounded-full ring-1 ring-card',
      status === 'online' && 'bg-[oklch(0.66_0.13_160)]',
      status === 'idle' && 'bg-[oklch(0.75_0.12_80)]',
      status === 'offline' && 'bg-muted-foreground/40',
    )} />
  )
}

function Corners() {
  const cls = 'border-accent/60'
  return (
    <>
      <i className={`absolute -top-px -left-px w-3 h-3 border-t border-l ${cls}`} />
      <i className={`absolute -top-px -right-px w-3 h-3 border-t border-r ${cls}`} />
      <i className={`absolute -bottom-px -left-px w-3 h-3 border-b border-l ${cls}`} />
      <i className={`absolute -bottom-px -right-px w-3 h-3 border-b border-r ${cls}`} />
    </>
  )
}

function SectionLabel({ children, sub, action }: {
  children: React.ReactNode; sub?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-foreground">{children}</h3>
      {sub && <span className="text-[9px] text-muted-foreground">— {sub}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

function StatTile({ label, value, sub, dot }: { label: string; value: string | number; sub: string; dot?: string }) {
  return (
    <div className="border border-input rounded-md p-2.5 bg-card">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {dot && <span className="w-1 h-1 rounded-[1px]" style={{ background: dot }} />}
        {label}
      </div>
      <div className="text-[18px] font-stashly mt-0.5 leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}

// ── OV01 · OPS — ops/control-room dashboard ─────────────────────────

function OverviewOps({ workspace, members, pendingInvites, recentItems, pinnedItems, me }: WorkspaceOverviewProps) {
  const onlineCount = members.filter((m) => m.status === 'online').length
  const adminCount = members.filter((m) => m.role === 'admin' || m.role === 'owner').length
  const viewerCount = members.filter((m) => m.role === 'viewer').length
  const pct = storagePct(workspace.storageUsedBytes, workspace.storageLimitBytes)

  return (
    <div className="p-4 space-y-4">
      {/* header */}
      <header className="flex items-baseline gap-3 pb-3 border-b border-dashed border-input">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: workspace.color ?? 'oklch(0.62 0.15 39)' }} />
        <h1 className="text-base font-stashly">{workspace.name}</h1>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">/ workspace</span>
        <RoleBadge role={workspace.role} />
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.66_0.13_160)] animate-pulse" />
          {onlineCount} · live
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Members" value={members.length} sub={`${adminCount} admins · ${viewerCount} viewer${viewerCount !== 1 ? 's' : ''}`} />
        <StatTile
          label="Storage"
          value={fmtStorage(workspace.storageUsedBytes)}
          sub={`of ${fmtStorage(workspace.storageLimitBytes)} · ${pct}%`}
          dot="oklch(0.62 0.15 39)"
        />
        <StatTile label="Activity" value={recentItems.length} sub="items updated recently" />
        <StatTile label="Pending" value={pendingInvites.length} sub="invites awaiting" />
      </div>

      {/* members + invite */}
      <section className="border border-input rounded-md bg-card p-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em]">Members</span>
          <div className="flex items-center -space-x-1.5">
            {members.slice(0, 5).map((m) => (
              <MemberAvatar key={m.id} name={m.name} image={m.image} size={22} ring />
            ))}
            {members.length > 5 && (
              <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-muted border border-card text-[9px] font-stashly text-muted-foreground">
                +{members.length - 5}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">· {onlineCount} online</span>
          <div className="ml-auto">
            <Link
              to={href('/:me/workspaces/:workspaceId/members', { me, workspaceId: workspace.id })}
              className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Manage →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {members.slice(0, 6).map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1 text-[11px]">
              <div className="relative">
                <MemberAvatar name={m.name} image={m.image} size={20} />
                <StatusDot status={m.status} />
              </div>
              <span className="flex-1 truncate">{m.name}</span>
              <RoleBadge role={m.role} />
              <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right">{fmtStorage(m.storageBytes)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* pinned + activity */}
      <div className="grid grid-cols-12 gap-3">
        {pinnedItems.length > 0 ? (
          <section className="col-span-7 border border-input rounded-md bg-card p-3">
            <SectionLabel sub="quick access">Pinned</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {pinnedItems.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-sm hover:bg-muted/40 cursor-pointer border border-dashed border-input">
                  <Glyph g={p.type === 'collection' ? 'COL' : 'FLD'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate">{p.name}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{p.type} · {p.itemCount} items</div>
                  </div>
                  <span className="text-muted-foreground text-[10px]">→</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="col-span-7 border border-dashed border-input rounded-md bg-card p-3 flex flex-col items-center justify-center gap-2 text-center">
            <FavoriteIcon className="w-5 h-5 text-muted-foreground/40" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">No pinned items</p>
          </section>
        )}

        <section className="col-span-5 border border-input rounded-md bg-card p-3">
          <SectionLabel sub="recent updates">Activity</SectionLabel>
          {recentItems.length > 0 ? (
            <ul className="space-y-0.5">
              {recentItems.slice(0, 6).map((item) => (
                <li key={item.id} className="grid grid-cols-[28px_1fr_auto] gap-2 items-start py-1 text-[10.5px]">
                  <Glyph g={CAT_GLYPH[item.category] ?? 'FIL'} />
                  <div className="leading-snug">
                    <span className="text-muted-foreground">updated </span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {item.updatedAt ? timeAgo(item.updatedAt) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-muted-foreground py-4 text-center uppercase tracking-[0.15em]">No recent activity</p>
          )}
        </section>
      </div>

      {/* recent files */}
      {recentItems.length > 0 && (
        <section className="border border-input rounded-md bg-card p-3">
          <SectionLabel
            sub="last touched"
            action={
              <Link
                to={href('/:me/workspaces/:workspaceId/recent', { me, workspaceId: workspace.id })}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            }
          >
            Recent files
          </SectionLabel>
          <div className="grid grid-cols-6 gap-2">
            {recentItems.slice(0, 6).map((f) => (
              <div key={f.id} className="border border-input rounded-sm bg-background p-2 hover:border-ring cursor-pointer">
                <Glyph g={CAT_GLYPH[f.category] ?? 'FIL'} />
                <div className="text-[10px] mt-2 truncate">{f.name}</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                  <MemberAvatar name={f.ownerName} size={12} />
                  <span className="truncate">{f.ownerName.split(' ')[0]}</span>
                  <span className="ml-auto tabular-nums">{fmtStorage(f.size)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── OV02 · DOSSIER — single column, blueprint feel ──────────────────

function OverviewDossier({ workspace, members, recentItems, pinnedItems, pendingInvites, me }: WorkspaceOverviewProps) {
  const onlineCount = members.filter((m) => m.status === 'online').length
  const pct = storagePct(workspace.storageUsedBytes, workspace.storageLimitBytes)

  return (
    <div className="p-4 space-y-4">
      <section className="relative border border-input rounded-md bg-card p-5">
        <Corners />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3 flex items-center gap-2">
          <span>STA-WS · {workspace.id.slice(-8).toUpperCase()}</span>
          <span className="opacity-50">/</span>
          <span>REV · {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.66_0.13_160)] animate-pulse" />
            ACTIVE
          </span>
        </div>
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-7">
            <div className="flex items-baseline gap-3">
              <span className="text-[44px] font-stashly leading-none">{workspace.name}</span>
              <RoleBadge role={workspace.role} />
            </div>
            {workspace.slug && (
              <div className="text-[11px] text-muted-foreground mt-2">
                stashly.app/<span className="text-foreground">{workspace.slug}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center -space-x-1.5">
                {members.slice(0, 6).map((m) => (
                  <MemberAvatar key={m.id} name={m.name} image={m.image} size={22} ring />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">{members.length} members · {onlineCount} online</span>
              <Link
                to={href('/:me/workspaces/:workspaceId/members', { me, workspaceId: workspace.id })}
                className="ml-2 text-[10px] uppercase tracking-[0.18em] text-accent-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <AddIcon className="w-3 h-3" /> INVITE
              </Link>
            </div>
          </div>
          <div className="col-span-5 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Storage</div>
            <div className="text-[28px] font-stashly leading-none">
              {fmtStorage(workspace.storageUsedBytes)}{' '}
              <span className="text-[14px] text-muted-foreground">of {fmtStorage(workspace.storageLimitBytes)}</span>
            </div>
            <MiniBar pct={pct} color="oklch(0.62 0.15 39)" />
            <div className="grid grid-cols-3 gap-3 mt-3 text-[10px]">
              <div>
                <div className="text-muted-foreground uppercase tracking-wider">Files</div>
                <div className="text-[14px] mt-0.5">{recentItems.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-wider">Members</div>
                <div className="text-[14px] mt-0.5">{members.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-wider">Pending</div>
                <div className="text-[14px] mt-0.5">{pendingInvites.length}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-3">
        <section className="col-span-5 border border-input rounded-md bg-card p-4">
          <SectionLabel
            sub={`${members.length} total`}
            action={
              <Link
                to={href('/:me/workspaces/:workspaceId/members', { me, workspaceId: workspace.id })}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Manage →
              </Link>
            }
          >
            Members
          </SectionLabel>
          <ul className="space-y-1">
            {members.slice(0, 5).map((m) => (
              <li key={m.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 py-1 text-[11px]">
                <div className="relative">
                  <MemberAvatar name={m.name} image={m.image} size={22} />
                  <StatusDot status={m.status} />
                </div>
                <div className="min-w-0">
                  <div className="truncate">{m.name}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.email}</div>
                </div>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        </section>

        <section className="col-span-7 border border-input rounded-md bg-card p-4">
          <SectionLabel sub="last 24h">Recent files</SectionLabel>
          <ul className="space-y-1.5">
            {recentItems.slice(0, 5).map((item) => (
              <li key={item.id} className="grid grid-cols-[1fr_auto] gap-2 items-baseline py-1 text-[11px] border-b border-dashed border-input last:border-0">
                <div className="flex items-center gap-2">
                  <Glyph g={CAT_GLYPH[item.category] ?? 'FIL'} />
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {item.updatedAt ? timeAgo(item.updatedAt) : '—'}
                </span>
              </li>
            ))}
            {recentItems.length === 0 && (
              <li className="text-[10px] text-muted-foreground py-4 text-center uppercase tracking-[0.15em]">No files yet</li>
            )}
          </ul>
        </section>
      </div>

      {pinnedItems.length > 0 && (
        <section className="border border-input rounded-md bg-card p-4">
          <SectionLabel sub="quick access">Pinned</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {pinnedItems.map((p) => (
              <div key={p.id} className="border border-dashed border-input rounded-sm p-2 flex items-center gap-2 hover:border-ring cursor-pointer">
                <Glyph g={p.type === 'collection' ? 'COL' : 'FLD'} />
                <div className="min-w-0">
                  <div className="text-[11px] truncate">{p.name}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{p.itemCount} items</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── OV03 · SPLIT — left rail + right content ─────────────────────────

function OverviewSplit({ workspace, members, recentItems, pinnedItems, pendingInvites, me }: WorkspaceOverviewProps) {
  const onlineCount = members.filter((m) => m.status === 'online').length
  const pct = storagePct(workspace.storageUsedBytes, workspace.storageLimitBytes)

  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-3">
        {/* left rail */}
        <aside className="col-span-4 space-y-3">
          <div className="border border-input rounded-md bg-card p-3 relative">
            <Corners />
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center font-stashly text-[14px] text-white"
                style={{ background: workspace.color ?? 'oklch(0.62 0.15 39)' }}
              >
                {workspace.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-stashly truncate">{workspace.name}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {workspace.role} · {workspace.slug ?? workspace.id.slice(-8)}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground uppercase tracking-wider">Storage</span>
                <span>{fmtStorage(workspace.storageUsedBytes)}</span>
              </div>
              <MiniBar pct={pct} color={workspace.color ?? 'oklch(0.62 0.15 39)'} />
              <div className="flex justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
                <span>{pct}% used</span>
                <span>{fmtStorage(workspace.storageLimitBytes - workspace.storageUsedBytes)} free</span>
              </div>
            </div>
          </div>

          <div className="border border-input rounded-md bg-card p-3">
            <SectionLabel
              sub={`${members.length}`}
              action={
                <Link
                  to={href('/:me/workspaces/:workspaceId/members', { me, workspaceId: workspace.id })}
                  className="text-[10px] text-accent-foreground"
                >
                  + Invite
                </Link>
              }
            >
              Members
            </SectionLabel>
            <ul className="space-y-0.5">
              {members.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-1 hover:bg-muted/40 -mx-2 px-2 rounded-sm cursor-pointer">
                  <div className="relative">
                    <MemberAvatar name={m.name} image={m.image} size={22} />
                    <StatusDot status={m.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate">{m.name}</div>
                  </div>
                  <RoleBadge role={m.role} />
                </li>
              ))}
            </ul>

            {pendingInvites.length > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed border-input">
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                  Pending · {pendingInvites.length}
                </div>
                {pendingInvites.slice(0, 2).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 py-1 text-[10.5px] text-muted-foreground">
                    <span className="w-4 h-4 rounded-[2px] border border-dashed border-input flex items-center justify-center text-[9px]">@</span>
                    <span className="flex-1 truncate">{p.email}</span>
                    <span className="text-[9px] uppercase tracking-wider">{timeAgo(p.sentAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* right content */}
        <section className="col-span-8 space-y-3">
          {pinnedItems.length > 0 && (
            <div className="border border-input rounded-md bg-card p-3">
              <SectionLabel sub="pinned">Quick access</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {pinnedItems.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-sm border border-dashed border-input hover:border-ring cursor-pointer">
                    <Glyph g={p.type === 'collection' ? 'COL' : 'FLD'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] truncate">{p.name}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{p.type} · {p.itemCount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-input rounded-md bg-card p-3">
            <SectionLabel
              sub="recent"
              action={
                <Link
                  to={href('/:me/workspaces/:workspaceId/recent', { me, workspaceId: workspace.id })}
                  className="text-[10px] text-muted-foreground"
                >
                  All →
                </Link>
              }
            >
              Files
            </SectionLabel>
            {recentItems.length > 0 ? (
              <div className="space-y-0.5">
                {recentItems.slice(0, 8).map((f) => (
                  <div key={f.id} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 py-1.5 px-2 -mx-2 rounded-sm hover:bg-muted/40 cursor-pointer">
                    <Glyph g={CAT_GLYPH[f.category] ?? 'FIL'} />
                    <div className="text-[11px] truncate">{f.name}</div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{fmtStorage(f.size)}</span>
                    <MemberAvatar name={f.ownerName} size={16} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground py-4 text-center uppercase tracking-[0.15em]">No files yet</p>
            )}
          </div>

          {recentItems.length > 0 && (
            <div className="border border-input rounded-md bg-card p-3">
              <SectionLabel sub="last activity">Updates</SectionLabel>
              <ul className="space-y-1">
                {recentItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="grid grid-cols-[24px_1fr_auto] gap-2 items-baseline py-1 text-[10.5px]">
                    <Glyph g={CAT_GLYPH[item.category] ?? 'FIL'} />
                    <div>
                      <span className="text-muted-foreground">{item.ownerName.split(' ')[0]} </span>
                      <span className="text-muted-foreground">updated </span>
                      <span>{item.name}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {item.updatedAt ? timeAgo(item.updatedAt) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────

function WorkspaceEmpty({ workspace, me }: Pick<WorkspaceOverviewProps, 'workspace' | 'me'>) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 px-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-input flex items-center justify-center">
          <WorkspaceIcon className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <Corners />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-sm font-stashly uppercase tracking-[0.18em]">{workspace.name}</h2>
        <p className="text-[11px] text-muted-foreground">No files or members yet.</p>
      </div>
      <Link
        to={href('/:me/workspaces/:workspaceId/members', { me, workspaceId: workspace.id })}
        className="text-[10px] uppercase tracking-[0.18em] border border-input rounded-sm px-3 py-1.5 hover:bg-muted transition-colors"
      >
        Invite Members
      </Link>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────

export function WorkspaceOverview(props: WorkspaceOverviewProps) {
  const isEmpty = props.members.length === 0 && props.recentItems.length === 0
  if (isEmpty) return <WorkspaceEmpty workspace={props.workspace} me={props.me} />

  switch (props.variant) {
    case 'dossier': return <OverviewDossier {...props} />
    case 'split':   return <OverviewSplit {...props} />
    default:        return <OverviewOps {...props} />
  }
}
