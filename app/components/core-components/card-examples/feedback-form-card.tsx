"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function FeedbackFormCard() {
  const [topic, setTopic] = useState("")
  const [feedback, setFeedback] = useState("")

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5 pb-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic" className="text-sm font-medium">
            Topic
          </Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger id="topic" className="w-full">
              <SelectValue placeholder="Select a topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="docs">Documentation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feedback" className="text-sm font-medium">
            Feedback
          </Label>
          <Textarea
            id="feedback"
            placeholder="Your feedback helps us improve..."
            className="resize-none min-h-[110px] text-sm"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
          Submit
        </Button>
      </CardContent>
    </Card>
  )
}
