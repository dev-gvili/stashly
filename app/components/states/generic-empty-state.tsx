import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyContent,
} from '@/ui/empty'

export interface GenericEmptyStateProps {
  children?: React.ReactNode
  icon: React.ReactNode
  title: string
  description: string
}

export const GenericEmptyState = ({
  children,
  icon,
  title,
  description,
}: GenericEmptyStateProps) => {
  return (
    <div className="h-[calc(100vh-10rem)] w-full overflow-hidden flex items-center justify-center">
      <Empty className="flex flex-col items-center justify-center">
        <EmptyHeader>
          <EmptyMedia variant="default">{icon}</EmptyMedia>
          <EmptyTitle className="font-stashly">{title}</EmptyTitle>
          <EmptyDescription className="font-stashly text-pretty">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">{children}</div>
        </EmptyContent>
      </Empty>
    </div>
  )
}
