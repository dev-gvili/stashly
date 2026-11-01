import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/workspace'
import { redirect } from 'react-router'
import { getWorkspaceOverview } from '@/services/workspace-actions'
import { WorkspaceOverview } from '@/components/views/workspace-overview'
import { DesignCanvas, DCSection, DCArtboard } from '@/components/ui/design-canvas'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.workspace?.name ?? 'Workspace'} — Stashly` },
    { description: data?.workspace?.description ?? '' },
  ]
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const { workspaceId, me } = params

  const {
    workspace,
    currentMember,
    memberships,
    recentItems,
    pendingInvitations,
    storageUsedBytes,
  } = await getWorkspaceOverview(session.user.id, workspaceId)

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
      storageUsedBytes,
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
