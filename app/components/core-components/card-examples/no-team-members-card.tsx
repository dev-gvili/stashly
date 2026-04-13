import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const avatars = [
  { src: "https://github.com/shadcn.png", fallback: "SC" },
  { src: "https://github.com/leerob.png", fallback: "LR" },
  { src: "https://github.com/nicholasgasior.png", fallback: "NG" },
]

export function NoTeamMembersCard() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-4 py-8 px-6 text-center">
        <div className="flex items-center -space-x-2">
          {avatars.map((a, i) => (
            <Avatar key={i} className="w-9 h-9 border-2 border-card ring-0">
              <AvatarImage src={a.src} alt={a.fallback} />
              <AvatarFallback className="bg-secondary text-xs">{a.fallback}</AvatarFallback>
            </Avatar>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">No Team Members</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[200px]">
            Invite your team to collaborate on this project.
          </p>
        </div>

        <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-4">
          Invite Members
        </Button>
      </CardContent>
    </Card>
  )
}
