import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/accordion'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'

const faqs = [
  {
    id: 'security',
    question: 'How secure is my financial data with Ledger?',
    answer:
      'We use bank-level AES-256 encryption, SOC 2 Type II certified infrastructure, and never store your credentials. All connections use read-only access tokens. We are a SEC registered investment advisor.',
  },
  {
    id: 'connect',
    question: 'How do I connect my bank or investment accounts?',
    answer:
      'Navigate to Settings > Connected Accounts and follow the secure linking flow powered by Plaid.',
  },
  {
    id: 'export',
    question: 'Can I export my data for tax purposes?',
    answer:
      'Yes, you can export transaction history, capital gains reports, and 1099 forms from the Reports section.',
  },
]

export function FaqCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <Accordion type="single" collapsible defaultValue="security">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Button variant="outline" className="w-full">
          Contact Support
        </Button>
      </CardContent>
    </Card>
  )
}
