"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"

export function PreferencesCard() {
  const [publicStats, setPublicStats] = useState(true)
  const [emailNotifs, setEmailNotifs] = useState(true)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold text-foreground">Preferences</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Manage your account settings and notifications.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground shrink-0 -mt-1 -mr-1">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-foreground">Default Currency</Label>
          <Select defaultValue="usd">
            <SelectTrigger className="bg-muted border-border text-foreground h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD — United States Dollar</SelectItem>
              <SelectItem value="eur">EUR — Euro</SelectItem>
              <SelectItem value="gbp">GBP — British Pound</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-foreground">Public Statistics</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Allow others to see your total stream count and listening activity
            </p>
          </div>
          <Switch
            checked={publicStats}
            onCheckedChange={setPublicStats}
            className="shrink-0 mt-0.5 data-[state=checked]:bg-primary"
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-foreground">Email Notifications</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Monthly royalty reports and distribution updates
            </p>
          </div>
          <Switch
            checked={emailNotifs}
            onCheckedChange={setEmailNotifs}
            className="shrink-0 mt-0.5 data-[state=checked]:bg-primary"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-muted">
            Reset
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1">
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
