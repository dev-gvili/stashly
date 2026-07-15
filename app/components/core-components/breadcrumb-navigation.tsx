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
    <>
      <BreadcrumbLink asChild>
        <Link to={`${to}?${searchParams.toString()}`} className="font-stashly">
          {crumb.name === 'root' ? null : crumb.type === 'folder' ? (
            <span className="flex items-center gap-2">{crumb.name}</span>
          ) : (
            crumb.name
          )}
        </Link>
      </BreadcrumbLink>
      <BreadcrumbSeparator>/</BreadcrumbSeparator>
    </>
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
    <Breadcrumb className="w-full text-foreground">
      <BreadcrumbList>
        {/* Root — always first */}
        {root.id !== last.id ? (
          <BreadcrumbItem key={root.id}>
            <CrumbLink crumb={root} me={me} searchParams={searchParams} />
          </BreadcrumbItem>
        ) : null}

        {showAll ? (
          // ≤ 3 items: render all middle items (between root and last)
          crumbs.slice(1, -1).map((crumb) => (
            <BreadcrumbItem key={crumb.id}>
              <CrumbLink crumb={crumb} me={me} searchParams={searchParams} />
            </BreadcrumbItem>
          ))
        ) : (
          // > 3 items: collapse middle into dropdown
          <>
            <BreadcrumbDropdown crumbs={collapsed!} me={me} />
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            {secondToLast && (
              <BreadcrumbItem key={secondToLast.id}>
                <CrumbLink
                  crumb={secondToLast}
                  me={me}
                  searchParams={searchParams}
                />
              </BreadcrumbItem>
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
