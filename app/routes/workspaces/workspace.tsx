import type { Route } from './+types/workspace'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { prisma } from '@/services/db'
import { requireAtLeastRole } from '@/services/workspace-actions'
import { WorkspaceOverview } from '@/components/views/workspace-overview'
import { DesignCanvas, DCSection, DCArtboard } from '@/components/ui/design-canvas'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.workspace?.name ?? 'Workspace'} — Stashly` },
    { description: data?.workspace?.description ?? '' },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { workspaceId, me } = params

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { storagePlan: true },
  })
  if (!workspace) throw new Response('Not found', { status: 404 })

  // Verify membership
  await requireAtLeastRole(session.user.id, workspaceId, 'viewer')

  const currentMember = await prisma.workspaceMember.findUnique({
    where: { memberId_workspaceId: { memberId: session.user.id, workspaceId } },
  })

  // Members with user details
  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { member: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: [{ role: 'asc' }, { member: { name: 'asc' } }],
  })

  // Recent items in the workspace
  const recentItems = await prisma.item.findMany({
    where: { workspaceId, status: 'normal' },
    select: {
      id: true, name: true, category: true, size: true, updatedAt: true,
      owner: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  })

  // Pending invitations for this workspace
  const pendingInvitations = await prisma.invitation.findMany({
    where: { workspaceId },
    include: {
      sender: { select: { name: true } },
      recipients: { where: { status: 'pending' }, select: { id: true, email: true, role: true, createdAt: true } },
    },
  })

  // Aggregate storage used by items in this workspace
  const storageAgg = await prisma.item.aggregate({
    where: { workspaceId },
    _sum: { size: true },
  })

  const storageLimitBytes = workspace.storagePlan
    ? BigInt(workspace.storagePlan.storageLimit ?? 0) * 1024n * 1024n * 1024n
    : 50n * 1024n * 1024n * 1024n

  const pendingInvites = pendingInvitations.flatMap((inv) =>
    inv.recipients.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      sentAt: r.createdAt,
      senderName: inv.sender.name,
    }))
  )

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      storageUsedBytes: storageAgg._sum.size ?? 0n,
      storageLimitBytes,
      role: (currentMember?.role ?? 'viewer') as 'owner' | 'admin' | 'member' | 'viewer',
    },
    members: memberships.map((m) => ({
      id: m.member.id,
      name: m.member.name,
      email: m.member.email,
      image: m.member.image,
      role: m.role,
      storageBytes: 0n,
      status: 'offline' as const,
    })),
    pendingInvites,
    recentItems: recentItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      size: item.size,
      updatedAt: item.updatedAt,
      ownerName: item.owner.name,
    })),
    pinnedItems: [],
    me: me ?? session.user.name,
  }
}

export default function WorkspacePage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <DesignCanvas>
        <DCSection
          id="workspace-overview"
          title={loaderData.workspace.name}
          subtitle="3 layout variants — drag to reorder, click to focus"
        >
          <DCArtboard id="ops" label="A · Ops" width={960} height={640}>
            <WorkspaceOverview {...loaderData} variant="ops" />
          </DCArtboard>
          <DCArtboard id="dossier" label="B · Dossier" width={960} height={640}>
            <WorkspaceOverview {...loaderData} variant="dossier" />
          </DCArtboard>
          <DCArtboard id="split" label="C · Split" width={960} height={640}>
            <WorkspaceOverview {...loaderData} variant="split" />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </div>
  )
}
