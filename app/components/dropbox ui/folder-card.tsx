import React from 'react'
import {
  Card,
  CardTitle,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
} from '@/ui/card'
import { AspectRatio } from '@/ui/aspect-ratio'
import { RiFolderFill } from '@remixicon/react'
import { Link, useLocation, type LinkProps } from 'react-router'
import { formatSize } from '@/utils/formaters'

interface FolderCardProps extends LinkProps {
  id: string
  name: string
  size: number
  childCount: number
}

export const FolderCard = ({ to, size, ...props }: FolderCardProps) => {
  return (
    <Link to={to} {...props} prefetch="intent">
      <Card className="p-4 shadow-none flex items-start rounded flex-1">
        <CardHeader>
          <RiFolderFill className="size-16 text-foreground font-stashly" />
        </CardHeader>
        <CardContent className="flex flex-row  w-full justify-start aspect-video">
          <section className="w-full ">
            <CardTitle
              title={props.name}
              className="truncate text-foreground font-stashly"
            >
              {props.name}
            </CardTitle>
            {/* <div className="flex justify-between items-center w-full">
              </div> */}
          </section>
        </CardContent>
        <CardFooter>
          <CardDescription className="text-sm font-serif truncate font-normal text-muted-foreground font-stashly ">
            {formatSize('byte', 'unit', size)}
          </CardDescription>
          <CardDescription className="text-sm.0p font-serif font-normal text-muted-foreground font-stashly place-self-end">
            {props.childCount} items
          </CardDescription>
        </CardFooter>
      </Card>
    </Link>
  )
}
