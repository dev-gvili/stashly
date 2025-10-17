"use client"

import type React from "react"

import { FileText, ImageIcon, Video, File, Zap, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar"

export function StoragePanel() {
  const usedGB = 26.4
  const totalGB = 50
  const availableGB = totalGB - usedGB
  const usedPercentage = (usedGB / totalGB) * 100

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="w-[320px] border-l border-border"
      style={{ "--sidebar-width": "320px" } as React.CSSProperties}
    >
      <SidebarHeader className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Storage</h2>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-6 py-8">
        <div className="space-y-8">
          {/* Storage Usage Circle */}
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48">
              {/* Background circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill="none" stroke="hsl(var(--muted))" strokeWidth="20" />
                {/* Progress circle */}
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="hsl(var(--foreground))"
                  strokeWidth="20"
                  strokeDasharray={`${usedPercentage * 5.03} ${(100 - usedPercentage) * 5.03}`}
                  strokeLinecap="round"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-foreground">{usedGB} GB</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">USED</p>
              </div>
            </div>
            <div className="flex items-center justify-between w-full mt-4 text-xs text-muted-foreground">
              <span>0 GB</span>
              <span>{totalGB} GB</span>
            </div>
            <p className="text-sm text-foreground mt-2">{availableGB.toFixed(1)} GB</p>
            <p className="text-xs text-muted-foreground">Storage Available</p>
            <p className="text-xs text-muted-foreground mt-1">{totalGB} GB</p>
          </div>

          {/* File Type Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <StorageCard icon={FileText} label="Documents" count={960} />
            <StorageCard icon={ImageIcon} label="Images" count={1365} />
            <StorageCard icon={Video} label="Videos" count={67} />
            <StorageCard icon={File} label="Other" count={163} />
          </div>

          {/* Upgrade Plan */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-foreground" />
              <h3 className="text-sm font-medium text-foreground">Upgrade Plan</h3>
            </div>
            <Button variant="outline" className="w-full justify-center gap-2 bg-card hover:bg-accent">
              <ArrowLeftRight className="w-4 h-4" />
              Compare New Plans
            </Button>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}

function StorageCard({ icon: Icon, label, count }: { icon: any; label: string; count: number }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4 rounded-lg bg-card border border-border">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{count} files</p>
      </div>
    </div>
  )
}
