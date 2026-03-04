import React, { Fragment, useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/styles'
import { ItemCard } from '@/components/stash/item-card'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import type { Prisma } from '@/prisma/client'
import { FilesEmptyState } from '../states/files-empty-state'
import type { SuggestedItemsResult } from '../../utils/item-actions.server'
import { ListLayout } from './list-view'

export interface SuggestionsViewProps {
  suggestedFolders: Prisma.ItemGetPayload<{
    include: {
      favorites: {
        select: {
          id: true
          favoritedBy: {
            select: {
              id: true
              name: true
              displayName: true
              image: true
            }
          }
        }
      }
      file: true
      folder: true
      thumbnails: {
        select: {
          height: true
          width: true
          url: true
          view: true
          size: true
          id: true
        }
      }
    }
  }>[]
  suggestedFiles: Prisma.ItemGetPayload<{
    include: {
      favorites: {
        select: {
          id: true
          favoritedBy: {
            select: {
              id: true
              name: true
              displayName: true
              image: true
            }
          }
        }
      }
      file: true
      folder: true
      thumbnails: {
        select: {
          height: true
          width: true
          url: true
          view: true
          size: true
          id: true
        }
      }
    }
  }>[]
  className?: string
}

/**
 * SuggestionsView Component
 *
 * Displays a split-page view with two sections:
 * - Top: Grid of suggested folders (max 6)
 * - Bottom: Grid of suggested files (max 50)
 *
 * Items are displayed in a responsive grid layout with animations.
 */
export const SuggestionsView = React.forwardRef<
  HTMLDivElement,
  SuggestedItemsResult & { className?: string; key: string }
>(({ suggestedFolders, suggestedFiles, className }, ref) => {
  const id = useId()

  const hasFolders = suggestedFolders.length > 0
  const hasFiles = suggestedFiles.length > 0

  return (
    <div key={id} className={cn('flex flex-col gap-4', className)}>
      {/* Suggested Folders Section */}
      {hasFolders && (
        <section>
          <h2 className="text-lg">Suggested Folders</h2>
          <ListLayout items={suggestedFolders} />
         
          <GridLayout>
            {suggestedFolders.map((folder) => (
              <motion.div
                key={folder.id}
                variants={itemVariants}
                transition={{ duration: 0.5 }}
              >
                <ItemCard {...folder}>
                  <ItemCard.Header>
                    <ItemCard.Checkbox
                      name="selectedItems"
                      value={folder.id}
                      data-slot="item-checkbox"
                    />
                    <ItemCard.Actions
                      data-slot="item-actions"
                      className="z-10 hover:cursor-pointer font-stashly max-w-max place-self-end"
                    />
                  </ItemCard.Header>
                  <ItemCard.Content>
                    <ItemCard.Thumbnail />
                    <ItemCard.Name />
                  </ItemCard.Content>
                  <ItemCard.Footer>
                    <ItemCard.Size />
                    <ItemCard.Count />
                  </ItemCard.Footer>
                </ItemCard>
              </motion.div>
            ))}
          </GridLayout>
        </section>
      )}

      {/* Suggested Files Section */}
      {hasFiles && (
        <section>
          <h2 className="text-lg">Suggested Files</h2>
          <ListLayout items={suggestedFiles} />

          <GridLayout>
            {suggestedFiles.map((file) => (
              <motion.div
                key={file.id}
                variants={itemVariants}
                transition={{ duration: 0.5 }}
              >
                <ItemCard {...file}>
                  <ItemCard.Header>
                    <ItemCard.Checkbox
                      name="selectedItems"
                      value={file.id}
                      data-slot="item-checkbox"
                    />
                    <ItemCard.Actions
                      data-slot="item-actions"
                      className="z-10 hover:cursor-pointer font-stashly max-w-max place-self-end"
                    />
                  </ItemCard.Header>
                  <ItemCard.Content>
                    <ItemCard.Thumbnail />
                    <ItemCard.Name />
                  </ItemCard.Content>
                  <ItemCard.Footer>
                    <ItemCard.Size />
                  </ItemCard.Footer>
                </ItemCard>
              </motion.div>
            ))}
          </GridLayout>
        </section>
      )}

      {/* Empty State */}
      {!hasFolders && !hasFiles && <FilesEmptyState />}
    </div>
  )
})

SuggestionsView.displayName = 'SuggestionsView'

/**
 * SuggestionsGridLayout Component
 *
 * Responsive grid layout component specifically for suggestions.
 * Uses the same responsive breakpoints as the main GridLayout.
 */
const SuggestionsGridLayout = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2 auto-rows-min rounded',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

SuggestionsGridLayout.displayName = 'SuggestionsGridLayout'
