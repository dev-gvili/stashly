import { AddIcon } from '@/components/icons'
import type { ItemCategory, ItemType } from '@/prisma/enums'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { ButtonGroup } from '@/ui/button-group'
import {
  DropdownMenu as DropDown,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { ScrollArea } from '@/ui/scroll-area'
import { Separator } from '@/ui/separator'
import { toIcon } from '@/utils/converters'
import { capitalize } from '@/utils/formaters'
import {
  getQueryParamArray,
  hasQueryParam,
  removeQueryParam,
} from '@/utils/query-params'
import { useLocation, useSearchParams } from 'react-router'
import { FilterListItem } from './FilterListItem'
import { Tooltip } from '../ui/tooltip'

const FilterList = <TData extends Record<string, string> = {}>({
  filterKey,
  label,
  data,
}: {
  filterKey: string
  label: string
  data: TData
}) => {
  const location = useLocation()
  if (
    location.pathname.includes('/videos') ||
    location.pathname.includes('/images')
  ) {
    return null
  }
  let [searchParams, setSearchParams] = useSearchParams()
  let canReset = hasQueryParam(searchParams, filterKey)
  let selectedItems = getQueryParamArray(searchParams, filterKey)

  return (
    <DropDown modal={true} key={searchParams.toString()}>
      <Tooltip content={label} asChild>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border border rounded-md font-stashly hover:cursor-pointer"
          >
            <AddIcon className="size-5!" />
            <span className="text-foreground">{label}</span>
            {selectedItems.length > 0 && (
              <>
                <Separator
                  orientation="vertical"
                  className="mx-2 h-4 border-dashed border border-muted"
                />
                {selectedItems.length > 2 ? (
                  <Badge className="text-xs rounded font-stashly font-normal hover:bg-muted bg-accent/30 text-accent-foreground">
                    {`${selectedItems.length} Selected`}
                  </Badge>
                ) : (
                  selectedItems.map((item) => {
                    let Icon = toIcon(item as ItemCategory | ItemType)
                    return (
                      <Badge className="text-xs rounded font-stashly hover:bg-muted bg-accent/30 text-accent-foreground text-center! items-center flex">
                        <Icon className="size-4" />
                        <span className="h-full mt-0.5">
                          {capitalize(item)}
                        </span>
                      </Badge>
                    )
                  })
                )}
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        alignOffset={4}
        className="shadow-stashly border border-border rounded-md p-1 w-48"
      >
        <ButtonGroup className="w-full">
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-sm hover:cursor-pointer font-stashly flex-1"
            disabled={!canReset}
            onClick={(e) => {
              setSearchParams(
                (currentParams) => {
                  removeQueryParam(currentParams, filterKey)
                  currentParams.delete('cursor')
                  return currentParams
                },
                { replace: true }
              )
            }}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-sm hover:cursor-pointer font-stashly flex-1"
            onClick={(e) => {
              setSearchParams(
                (currentParams) => {
                  currentParams.delete('cursor')
                  return currentParams
                },
                { replace: true }
              )
            }}
          >
            Apply
          </Button>
        </ButtonGroup>
        <ScrollArea type="hover" className="max-h-80">
          <section
            className="max-h-80 
 [*:has([data-state='visible'])_&]:w-fit "
          >
            {Object.keys(data)
              .sort()
              .map((value) => {
                return (
                  <FilterListItem
                    key={value}
                    value={value}
                    name={filterKey}
                    searchParams={searchParams}
                  />
                )
              })}
          </section>
        </ScrollArea>
      </DropdownMenuContent>
    </DropDown>
  )
}

export { FilterList }
