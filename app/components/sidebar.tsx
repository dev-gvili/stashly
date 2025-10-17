import { Home, File, Video, ImageIcon, Clock, Settings, MoreHorizontal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Sidebar() {
  return (
    <div className="w-[72px] bg-[#0f0f0f] border-r border-[#2a2a2a] flex flex-col items-center py-6">
      {/* Dropbox Logo */}
      <div className="mb-8">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6L16 11L8 16L0 11L8 6Z" fill="white" />
          <path d="M24 6L16 11L24 16L32 11L24 6Z" fill="white" />
          <path d="M8 20L16 25L8 30L0 25L8 20Z" fill="white" />
          <path d="M24 20L16 25L24 30L32 25L24 20Z" fill="white" />
          <path d="M16 11L8 16L16 21L24 16L16 11Z" fill="white" opacity="0.6" />
        </svg>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col items-center gap-6">
        <NavItem icon={Home} label="HOME" />
        <NavItem icon={File} label="ALL FILES" />
        <NavItem icon={Video} label="VIDEOS" />
        <NavItem icon={ImageIcon} label="PHOTOS" />
        <NavItem icon={Clock} label="RECENT" active />
        <div className="flex-1" />
        <NavItem icon={Settings} label="SETTINGS" />
      </nav>

      {/* More Options */}
      <button className="mt-4 mb-4 p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
        <MoreHorizontal className="w-5 h-5 text-gray-400" />
      </button>

      {/* User Avatar */}
      <Avatar className="w-8 h-8">
        <AvatarImage src="/placeholder.svg?height=32&width=32" />
        <AvatarFallback className="bg-white text-black text-xs">U</AvatarFallback>
      </Avatar>
    </div>
  )
}

function NavItem({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) {
  return (
    <button
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
        active ? "bg-[#2a2a2a] text-white" : "text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-medium tracking-wide">{label}</span>
    </button>
  )
}
