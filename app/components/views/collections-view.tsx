import React, { useState, useId } from 'react'
import { useFetcher } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/ui/dialog'
import {
  CollectionCard,
  cardVariants,
  type CollectionCardItem,
} from '@/components/core-components/collection-card'
import { CollectionEmptyState } from '@/components/states/collection-empty-state'

interface CollectionsViewProps {
  collections: CollectionCardItem[]
}

function NewCollectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const id = useId()
  const fetcher = useFetcher()
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    fetcher.submit({ intent: 'create_collection', name }, { method: 'post' })
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
        </DialogHeader>
        <form id={id} onSubmit={handleSubmit}>
          <Input
            autoFocus
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button form={id} type="submit" disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CollectionsView({ collections }: CollectionsViewProps) {
  const [newOpen, setNewOpen] = useState(false)

  if (collections.length === 0) {
    return (
      <>
        <CollectionEmptyState
          title="No collections yet"
          description="Create collections to organize your items."
        >
          <Button
            variant="default"
            className="rounded font-stashly"
            onClick={() => setNewOpen(true)}
          >
            Create your first collection
          </Button>
        </CollectionEmptyState>
        <NewCollectionDialog open={newOpen} onOpenChange={setNewOpen} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold font-stashly">Collections</h1>
        <Button
          size="sm"
          variant="default"
          className="font-stashly"
          onClick={() => setNewOpen(true)}
        >
          New collection
        </Button>
      </div>
      <div className="grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
        <AnimatePresence mode="popLayout">
          {collections.map((col) => (
            <motion.div
              key={col.id}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.15 }}
            >
              <CollectionCard collection={col} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <NewCollectionDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
