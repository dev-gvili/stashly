"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const tabs = ["General", "Billing", "Goals"]

const faqs = [
  {
    question: "How secure is my financial data with Ledger?",
    answer:
      "We use bank-level AES-256 encryption, SOC 2 Type II certified infrastructure, and never store your credentials. The connection uses read-only access tokens. We are a SEC registered investment advisor.",
  },
  {
    question: "How do I connect my bank or investment accounts?",
    answer:
      "Navigate to Settings → Connected Accounts and click 'Add Account'. We support over 12,000 institutions via Plaid. Your credentials are never stored on our servers.",
  },
  {
    question: "Can I export my data for tax purposes?",
    answer:
      "Yes. Go to Reports → Tax Export to download a CSV or PDF of your transactions, gains, and losses for any fiscal year. We support TurboTax and H&R Block formats.",
  },
]

export function FaqAccordionCard() {
  const [activeTab, setActiveTab] = useState("General")

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Accordion */}
        <div className="p-4">
          <Accordion type="single" collapsible defaultValue="item-0">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border"
              >
                <AccordionTrigger className="text-sm text-foreground text-left hover:no-underline py-3">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Button
            variant="outline"
            className="w-full mt-3 border-border text-foreground hover:bg-muted text-sm"
          >
            Contact Support
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
