import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useBreadcrumbs } from '@/hooks'
import type { Breadcrumb as BreadcrumbData } from '@/services/breadcrumbs'
import { removeQueryParam } from '@/utils'
import { toItemUrl } from '@/utils/converters'
import { Fragment } from 'react'
import { Link, useMatches, useParams, useSearchParams } from 'react-router'

export interface StashBreadcrumbsProps {
  crumbs: BreadcrumbData[]
  me: string
}

/**
 * The folder page is reachable through two route trees — the personal stash and
 * a workspace — and only the prefix differs. Both crumb variants below build
 * links through this so they can't drift apart, and each reads `:workspaceId`
 * off the current route rather than taking it as a prop, which keeps the five
 * JSX call sites in `Breadcrumbs` unchanged.
 *
 * The prefix logic itself lives in `toItemUrl`, so breadcrumbs and item cards
 * cannot disagree about where a folder lives.
 */
function useFolderHref(me: string) {
  let { workspaceId } = useParams()
  // Inside Trash the trail is "Trash / trashed folders…", and every crumb must
  // stay in Trash: a trashed folder's live route shows it as if it were in
  // place. `TRASH_CRUMB_ID` is the synthetic "Trash" head.
  let inTrash = useMatches().some((m) => m.id === 'stash-trash-folder')
  return (folderId: string) => {
    if (inTrash) {
      return folderId === TRASH_CRUMB_ID
        ? `/${me}/stash/trash`
        : `/${me}/stash/trash/folders/${folderId}`
    }
    return toItemUrl({ type: 'folder', id: folderId, parentId: '', me, workspaceId })
  }
}

/** Same as `TRASH_CRUMB_ID` in `@/services/item-actions` (server-only module). */
const TRASH_CRUMB_ID = 'trash'

const BreadcrumbDropdown = ({ crumbs, me }: StashBreadcrumbsProps) => {
  let [searchParams] = useSearchParams()
  let folderHref = useFolderHref(me)
  if (!searchParams.has('layout')) {
    searchParams.set('layout', 'grid')
  }
  return (
    <BreadcrumbItem className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="[&_svg]:size-6! hover:text-foreground transition-colors hover:bg-transparent! hover:cursor-pointer p-0! size-5! rounded-xs appearance-none border-none ring-0 focus:ring-0 focus-visible:border-none focus-visible:ring-0"
          >
            <BreadcrumbEllipsis />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="rounded-md shadow-xl overflow-hidden font-stashly ring-2 ring-input border-none p-0 bg-card"
        >
          <DropdownMenuGroup>
            {crumbs.map((crumb) => (
              <DropdownMenuItem
                key={crumb.id}
                asChild
                className="hover:bg-transparent! hover:cursor-pointer"
              >
                <Link
                  to={`${folderHref(crumb.id)}?${searchParams.toString()}`}
                >
                  {crumb.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  )
}

function CrumbLink({
  crumb,
  me,
  searchParams,
}: {
  crumb: BreadcrumbData
  me: string
  searchParams: URLSearchParams
}) {
  let folderHref = useFolderHref(me)
  removeQueryParam(searchParams, 'cursor') // Clear cursor when navigating via breadcrumbs, to prevent confusion when the selected item(s) disappear from the new page. Note: this mutates searchParams in-place, which is fine because we're only using it to build the href for the Link component below.
  removeQueryParam(searchParams, 'selectedItems') // Clear selected items for same reason as cursor. If we kept selectedItems in the URL, then when the user clicks a breadcrumb to navigate to a parent folder, the selectedItems that were relevant in the child folder would still be in the URL, which could cause unexpected behavior (e.g. bulk actions appearing for items that aren't actually selected in the new folder).

  if (!searchParams.has('layout')) {
    searchParams.set('layout', 'grid')
  }
  let to = folderHref(crumb.id)
  return (
    <BreadcrumbLink asChild>
      {/* Ancestor crumbs are capped and ellipsised: folder names come straight
          from uploads and can be arbitrarily long (a bulk drive export easily
          blows past the header width). `title` keeps the full name reachable. */}
      <Link
        to={`${to}?${searchParams.toString()}`}
        title={crumb.name}
        className="font-stashly block max-w-40 truncate"
      >
        {crumb.name === 'root' ? null : crumb.type === 'folder' ? (
          <span className="flex items-center gap-2 truncate">{crumb.name}</span>
        ) : (
          crumb.name
        )}
      </Link>
    </BreadcrumbLink>
  )
}

export function Breadcrumbs() {
  let { me } = useParams()
  let crumbs = useBreadcrumbs() // ensure breadcrumbs are loaded
  let [searchParams] = useSearchParams()
  if (!crumbs || !me) return null

  const root = crumbs[0]
  const last = crumbs[crumbs.length - 1]
  const secondToLast = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null
  const collapsed =
    crumbs.length > 2 ? crumbs.slice(1, crumbs.length - 2) : null
  const showAll = crumbs.length <= 3

  return (
    // min-w-0 lets the trail shrink below its content width inside the header
    // flex row; without it the nav keeps its intrinsic width and pushes the
    // right-hand controls out (or wraps onto a second line, breaking h-14).
    <Breadcrumb className="min-w-0 flex-1">
      {/* flex-nowrap: a long trail must ellipsise, never wrap. */}
      <BreadcrumbList className="flex-nowrap">
        {/* Root — always first. Separators are siblings of the items, never
            nested inside them: BreadcrumbSeparator renders an <li>, so it has
            to stay a direct child of the <ol>. */}
        {root.id !== last.id ? (
          <Fragment key={root.id}>
            <BreadcrumbItem className="min-w-0">
              <CrumbLink crumb={root} me={me} searchParams={searchParams} />
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0">/</BreadcrumbSeparator>
          </Fragment>
        ) : null}

        {showAll ? (
          // ≤ 3 items: render all middle items (between root and last)
          crumbs.slice(1, -1).map((crumb) => (
            <Fragment key={crumb.id}>
              <BreadcrumbItem className="min-w-0">
                <CrumbLink crumb={crumb} me={me} searchParams={searchParams} />
              </BreadcrumbItem>
              <BreadcrumbSeparator className="shrink-0">/</BreadcrumbSeparator>
            </Fragment>
          ))
        ) : (
          // > 3 items: collapse middle into dropdown
          <>
            <BreadcrumbDropdown crumbs={collapsed!} me={me} />
            <BreadcrumbSeparator className="shrink-0">/</BreadcrumbSeparator>
            {secondToLast && (
              <Fragment key={secondToLast.id}>
                <BreadcrumbItem className="min-w-0">
                  <CrumbLink
                    crumb={secondToLast}
                    me={me}
                    searchParams={searchParams}
                  />
                </BreadcrumbItem>
                <BreadcrumbSeparator className="shrink-0">
                  /
                </BreadcrumbSeparator>
              </Fragment>
            )}
          </>
        )}

        {/* Last item — always current page */}
        <BreadcrumbItem key={last?.id} className="min-w-0">
          <BreadcrumbPage
            className="font-stashly block truncate"
            title={last?.name}
          >
            {last?.name}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
