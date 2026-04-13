import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"

const shortcuts = [
  { label: "Search", keys: ["⌘", "K"] },
  { label: "Quick Actions", keys: ["⌘", "J"] },
  { label: "New File", keys: ["⌘", "N"] },
  { label: "Save", keys: ["⌘", "S"] },
  { label: "Toggle Sidebar", keys: ["⌘", "B"] },
]

export function ShortcutsCard() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Shortcuts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {shortcuts.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <span className="text-xs text-foreground">{s.label}</span>
            <div className="flex items-center gap-1">
              {s.keys.map((k, j) => (
                <Kbd key={j} className="text-[11px] px-1.5 py-0.5 bg-secondary border-border text-muted-foreground">
                  {k}
                </Kbd>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
