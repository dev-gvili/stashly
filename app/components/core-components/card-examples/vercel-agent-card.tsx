import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CircleCheck } from "lucide-react"

const features = [
  {
    bold: "Code reviews",
    rest: " with full codebase context to catch ",
    highlight: "hard-to-find",
    end: " bugs.",
  },
  {
    bold: "Code suggestions",
    rest: " validated in sandboxes before you merge.",
    highlight: "",
    end: "",
  },
  {
    bold: "Root-cause analysis",
    rest: " for production issues with deployment context.",
    highlight: "",
    end: "",
    badge: "Requires Observability Plus",
  },
]

export function VercelAgentCard() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground leading-snug">
          Ship faster &amp; safer with Vercel Agent
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
          Your use is subject to Vercel&apos;s Public Beta Agreement and AI Product Terms.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <CircleCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{f.bold}</span>
              {f.rest}
              {f.highlight && <span className="font-semibold text-foreground">{f.highlight}</span>}
              {f.end}
              {f.badge && (
                <div className="mt-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {f.badge}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground mt-1">
          Pro teams get $100 in Vercel Agent trial credit for 2 weeks after activation.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-8 text-xs border-border bg-transparent text-foreground hover:bg-secondary">
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex-1">
            Enable with $100 credits
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
