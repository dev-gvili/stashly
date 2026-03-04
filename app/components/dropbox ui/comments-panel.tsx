import { Reply, Paperclip, Upload, FileText } from 'lucide-react'
import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'

type Comment = {
  id: string
  user: {
    initial: string
    name: string
  }
  timestamp: string
  text: string
}

type CommentsPanelProps = {
  fileName: string
  onShowPreview?: () => void
}

const comments: Comment[] = [
  {
    id: '1',
    user: { initial: 'M', name: "Miss O'Bannon" },
    timestamp: '2 days ago',
    text: "Hey everyone! We need to polish this stuff as soon as possible. There are a lot of things that needs to be reworked, rewritten and etc. When you'll finish these improvements, call Sam Jones and send him this document, so she could overview it and approve.",
  },
  {
    id: '2',
    user: { initial: 'G', name: 'George Williamson' },
    timestamp: '39 min ago',
    text: 'Take a closer look at this chapter, I think we need to rewrite that...',
  },
  {
    id: '3',
    user: { initial: 'G', name: 'George Williamson' },
    timestamp: '22 min ago',
    text: 'Also check out the spelling!!!',
  },
  {
    id: '4',
    user: { initial: 'A', name: 'Alexander Mikoleienko' },
    timestamp: '32 min ago',
    text: 'Already did that, as well as the spelling, check the updates and please give a feedback asoon as possible.',
  },
  {
    id: '5',
    user: { initial: 'G', name: 'George Williamson' },
    timestamp: '04 min ago',
    text: 'Great work Alexander! Congrats!!!',
  },
]

export function CommentsPanel({ fileName, onShowPreview }: CommentsPanelProps) {
  const [commentText, setCommentText] = useState('')

  return (
    <Sidebar
      className="sticky top-0 bottom-0 hidden h-svh lg:flex w-[320px] bg-background border-l border-border"
      side="right"
    >
      {/* Header */}
      <SidebarHeader className="h-[72px] border-b border-border flex flex-row items-center px-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border border-muted-foreground rounded" />
          <h2 className="text-foreground text-sm font-medium">Comments</h2>
        </div>
        {onShowPreview && (
          <button
            onClick={onShowPreview}
            className="ml-auto p-2 hover:bg-accent rounded transition-colors"
            title="Show file preview"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </SidebarHeader>

      {/* Comments List */}
      <SidebarContent className="p-6">
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center text-foreground text-sm font-medium flex-shrink-0">
                  {comment.user.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {comment.user.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {comment.timestamp}
                      </p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded">
                      <Reply className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {comment.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SidebarContent>

      {/* Comment Input */}
      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <button className="p-2 hover:bg-accent rounded transition-colors">
            <Reply className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2 hover:bg-accent rounded transition-colors">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2 hover:bg-accent rounded transition-colors">
            <Upload className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="ml-auto p-2 hover:bg-accent rounded transition-colors">
            <div className="w-4 h-4 border border-muted-foreground rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-muted-foreground rounded-full" />
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your comment"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none"
          />
          <button className="px-4 py-1.5 bg-muted hover:bg-accent text-foreground text-sm rounded transition-colors">
            Send
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
