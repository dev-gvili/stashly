"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export function ContributionsActivityCard() {
  const [checked, setChecked] = useState(false)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Contributions &amp; Activity</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Manage your contributions and activity visibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="private-activity"
            checked={checked}
            onCheckedChange={(v) => setChecked(Boolean(v))}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="private-activity" className="text-xs font-semibold text-foreground cursor-pointer">
              Make profile private and hide activity
            </Label>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Enabling this will hide your contributions and activity from your GitHub profile and from social features like followers, stars, feeds, leaderboards and releases.
            </p>
          </div>
        </div>

        <Button size="sm" className="self-start h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-4">
          Save Changes
        </Button>
      </CardContent>
    </Card>
  )
}
