import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { Breadcrumb as BreadcrumbData } from '@/services/breadcrumbs'
import { href, useSearchParams } from 'react-router'
import { Link } from 'react-router'
import {
  BreadcrumbSeparatorIcon,
  FolderFillIcon,
  FolderOpenIcon,
  HomeFillIcon,
} from '@/components/icons'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useBreadcrumbs } from '@/hooks'
import { useParams } from 'react-router'
import { removeQueryParam } from '@/utils'

export interface StashBreadcrumbsProps {
  crumbs: BreadcrumbData[]
  me: string
}

const BreadcrumbDropdown = ({ crumbs, me }: StashBreadcrumbsProps) => {
  let [searchParams] = useSearchParams()
  if(!searchParams.has('layout')){
    searchParams.set('layout', 'grid')
  }
  return (
    <BreadcrumbItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="[&_svg]:size-6! hover:text-foreground transition-colors hover:bg-transparent! hover:cursor-pointer p-0! size-5! rounded-xs appearance-none border-none ring-0 focus:ring-0 focus-visible:border-none focus-visible:ring-0 "
          >
            <BreadcrumbEllipsis />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-40 bg-card text-card-foreground font-stashly"
        >
          <DropdownMenuGroup>
            {crumbs.map((crumb) => (
              <DropdownMenuItem
                key={crumb.id}
                asChild
                className="hover:bg-transparent! hover:cursor-pointer"
              >
                <Link
                  to={`${href('/:me/stash/folders/:folderId', {
                    me,
                    folderId: crumb.id,
                  })}?${searchParams.toString()}`}
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
  removeQueryParam(searchParams, 'cursor') // Clear cursor when navigating via breadcrumbs, to prevent confusion when the selected item(s) disappear from the new page. Note: this mutates searchParams in-place, which is fine because we're only using it to build the href for the Link component below.
  removeQueryParam(searchParams, 'selectedItems') // Clear selected items for same reason as cursor. If we kept selectedItems in the URL, then when the user clicks a breadcrumb to navigate to a parent folder, the selectedItems that were relevant in the child folder would still be in the URL, which could cause unexpected behavior (e.g. bulk actions appearing for items that aren't actually selected in the new folder).

  let to = href('/:me/stash/folders/:folderId', { me, folderId: crumb.id })
  return (
    <BreadcrumbLink asChild>
      <Link to={`${to}?${searchParams.toString()}`} className="font-stashly">
        {crumb.name === 'root' ? null : crumb.type === 'folder' ? (
          <span className="flex items-center gap-2">{crumb.name}</span>
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
    <Breadcrumb className="w-full flex-1 max-w-max">
      <BreadcrumbList>
        {/* Root — always first. Separators are siblings of the items, never
            nested inside them: BreadcrumbSeparator renders an <li>, so it has
            to stay a direct child of the <ol>. */}
        {root.id !== last.id ? (
          <Fragment key={root.id}>
            <BreadcrumbItem>
              <CrumbLink crumb={root} me={me} searchParams={searchParams} />
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
          </Fragment>
        ) : null}

        {showAll ? (
          // ≤ 3 items: render all middle items (between root and last)
          crumbs.slice(1, -1).map((crumb) => (
            <Fragment key={crumb.id}>
              <BreadcrumbItem>
                <CrumbLink crumb={crumb} me={me} searchParams={searchParams} />
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
            </Fragment>
          ))
        ) : (
          // > 3 items: collapse middle into dropdown
          <>
            <BreadcrumbDropdown crumbs={collapsed!} me={me} />
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            {secondToLast && (
              <Fragment key={secondToLast.id}>
                <BreadcrumbItem>
                  <CrumbLink
                    crumb={secondToLast}
                    me={me}
                    searchParams={searchParams}
                  />
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
              </Fragment>
            )}
          </>
        )}

        {/* Last item — always current page */}
        <BreadcrumbItem key={last?.id}>
          <BreadcrumbPage className="font-stashly">{last?.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
