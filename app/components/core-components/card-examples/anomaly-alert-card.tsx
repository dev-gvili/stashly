import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AnomalyAlertCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center gap-4 pt-8 pb-7 px-6">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold text-foreground text-base">
            Get alerted for anomalies
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Automatically monitor your projects for anomalies and get notified.
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full font-medium text-sm">
          Upgrade to Observability Plus
        </Button>
      </CardContent>
    </Card>
  )
}
