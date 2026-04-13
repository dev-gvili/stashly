"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils"


const timeSlots = ["9:00 AM", "10:30 AM", "11:00 AM", "1:30 PM"]

export function BookAppointmentCard() {
  const [selected, setSelected] = useState("9:00 AM")

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Book Appointment</CardTitle>
        <CardDescription className="text-sm">Dr. Sarah Chen &middot; Cardiology</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Available on March 18, 2026</p>
          <div className="flex flex-wrap gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelected(slot)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                  selected === slot
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-foreground border-border hover:bg-muted"
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Note box */}
        <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">New patient?</p>
          <p className="text-xs text-muted-foreground">Please arrive 15 minutes early.</p>
        </div>

        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
          Book Appointment
        </Button>
      </CardContent>
    </Card>
  )
}
