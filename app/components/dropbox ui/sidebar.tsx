"use client"

import type React from "react"

import { Home, File, Video, ImageIcon, Clock, Settings, MoreHorizontal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

type SidebarProps = {
  activeView: "files" | "videos" | "settings"
  onViewChange: (view: "files" | "videos" | "settings") => void
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <SidebarRoot
      collapsible="none"
      className="w-[72px] border-r border-border h-screen"
      style={{ "--sidebar-width": "72px" } as React.CSSProperties}
    >
      <SidebarHeader className="items-center py-6 px-0">
        {/* Dropbox Logo */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6L16 11L8 16L0 11L8 6Z" fill="white" />
          <path d="M24 6L16 11L24 16L32 11L24 6Z" fill="white" />
          <path d="M8 20L16 25L8 30L0 25L8 20Z" fill="white" />
          <path d="M24 20L16 25L24 30L32 25L24 20Z" fill="white" />
          <path d="M16 11L8 16L16 21L24 16L16 11Z" fill="white" opacity="0.6" />
        </svg>
      </SidebarHeader>

      <SidebarContent className="px-0">
        {/* Navigation Icons */}
        <SidebarMenu className="gap-6 items-center">
          <SidebarMenuItem>
            <NavItem icon={Home} label="HOME" onClick={() => onViewChange("files")} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavItem
              icon={File}
              label="ALL FILES"
              active={activeView === "files"}
              onClick={() => onViewChange("files")}
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavItem
              icon={Video}
              label="VIDEOS"
              active={activeView === "videos"}
              onClick={() => onViewChange("videos")}
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavItem icon={ImageIcon} label="PHOTOS" onClick={() => onViewChange("files")} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavItem icon={Clock} label="RECENT" onClick={() => onViewChange("files")} />
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex-1" />

        <SidebarMenu className="items-center">
          <SidebarMenuItem>
            <NavItem
              icon={Settings}
              label="SETTINGS"
              active={activeView === "settings"}
              onClick={() => onViewChange("settings")}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="items-center px-0 pb-6">
        {/* More Options */}
        <Button variant="ghost" size="icon" className="mb-4 hover:bg-accent">
          <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* User Avatar */}
        <Avatar className="w-8 h-8">
          <AvatarImage src="https://vercel.com/api/www/avatar/3f60bbb9b510e856df46cace99afbc22355fc3a1" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">U</AvatarFallback>
        </Avatar>
      </SidebarFooter>
    </SidebarRoot>
  )
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <SidebarMenuButton
      isActive={active}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 h-auto py-2 px-2 w-full ${
        active ? "bg-accent/50 text-foreground " : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-medium tracking-wide">{label}</span>
    </SidebarMenuButton>
  )
}
