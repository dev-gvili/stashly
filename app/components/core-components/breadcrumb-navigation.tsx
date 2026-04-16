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
import { BreadcrumbSeparatorIcon, HomeIcon } from '../icons'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui'
import { useBreadcrumbs } from '@/hooks'
import { useParams } from 'react-router'

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
            size="icon-sm"
            variant="ghost"
            className="[&_svg]:size-5! hover:text-foreground transition-colors hover:bg-transparent! hover:cursor-pointer p-0! size-5! rounded-xs appearance-none focus-visible:border-ring focus-visible:ring-primary/80 focus-visible:ring-2"
          >
            <BreadcrumbEllipsis />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {crumbs.map((crumb) => (
              <DropdownMenuItem key={crumb.id}>
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
  return (
    <>
      <BreadcrumbLink asChild>
        <Link
          to={`${href('/:me/stash/folders/:folderId', { me, folderId: crumb.id })}?${searchParams.toString()}`}
          className="font-stashly"
        >
          {crumb.name === 'root' ? (
            <HomeIcon className="size-5!" />
          ) : (
            crumb.name
          )}
        </Link>
      </BreadcrumbLink>
      <BreadcrumbSeparator>
        <BreadcrumbSeparatorIcon />
      </BreadcrumbSeparator>
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
    crumbs.length > 3 ? crumbs.slice(1, crumbs.length - 2) : null
  const showAll = crumbs.length <= 3

  return (
    <Breadcrumb className="w-full text-foreground">
      <BreadcrumbList>
        {/* Root — always first */}
        {crumbs.length > 1 ? (
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
            <BreadcrumbSeparator>
              <BreadcrumbSeparatorIcon />
            </BreadcrumbSeparator>
            {secondToLast && secondToLast.id !== root.id && (
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
          <BreadcrumbPage className="font-stashly">
            {last?.name === 'root' ? (
              <HomeIcon className="size-5!" />
            ) : (
              last?.name
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
