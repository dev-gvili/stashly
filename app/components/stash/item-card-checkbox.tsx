import { Checkbox } from '@/ui/checkbox'
import {
  addQueryParamValue,
  hasQueryParamValue,
  removeQueryParamValue,
} from '@/utils/query-params'
import React from 'react'
import { useSearchParams } from 'react-router'
export function ItemCardCheckBox(
  props: React.ComponentPropsWithoutRef<typeof Checkbox>
) {
  let [searchParams, setSearchParams] = useSearchParams()
  let isChecked = hasQueryParamValue(
    searchParams,
    props.name!,
    `${props.value}`
  )
  let handleChange = (checked: boolean) => {
    if (checked) {
      setSearchParams(
        addQueryParamValue(searchParams, props.name!, `${props.value}`),
        { replace: true }
      )
    } else {
      setSearchParams(
        removeQueryParamValue(searchParams, props.name!, `${props.value}`),
        { replace: true }
      )
    }
  }

  return (
    <Checkbox checked={isChecked} onCheckedChange={handleChange} {...props} />
  )
}
