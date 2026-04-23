import { RiCheckFill } from '@remixicon/react'
import { Checkbox } from '@/ui/checkbox'
import { DropdownMenuItem } from '@/ui/dropdown-menu'
import { useLocation } from 'react-router'
import { toIcon } from '@/utils/converters'
import { capitalize } from '@/utils/formaters'
import { ItemCategory, ItemType } from '@/prisma/browser'
import { Label } from '../ui/label'
import {
  addQueryParamValue,
  hasQueryParamValue,
  removeQueryParamValue,
} from '@/utils/query-params'

interface FilterItemProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Checkbox>,
  'value'
> {
  value: string
  name: string
  searchParams: URLSearchParams
}

export function FilterListItem({
  name,
  value,
  searchParams,
  children,
  ...props
}: FilterItemProps) {
  let location = useLocation()
  let _onSelect = (event: Event) => event.preventDefault()
  let Icon = toIcon(value as ItemCategory | ItemType)
  return (
    <DropdownMenuItem
      key={value}
      onSelect={_onSelect}
      className="gap-4 hover:cursor-pointer"
      asChild
    >
      <Label htmlFor={value} className="text-current hover:cursor-pointer">
        <span className="font-stashly text-sm grow flex gap-2 items-center hover:cursor-pointer">
          <Icon className="size-5 text-current" />
          {capitalize(value)}
        </span>
        <Checkbox
          id={value}
          key={location.key}
          name={name}
          value={value}
          className="size-5! hover:cursor-pointer"
          defaultChecked={hasQueryParamValue(searchParams, name, value)}
          onCheckedChange={(checked) => {
            checked
              ? addQueryParamValue(searchParams, name, value)
              : removeQueryParamValue(searchParams, name, value)
          }}
          {...props}
        />
      </Label>
    </DropdownMenuItem>
  )
}
