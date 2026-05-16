import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SquareDashedMousePointer } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui'
import { CopyIcon, DoubleCheckIcon } from '@/components/icons'

export function CodespacesCard() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('https://github.com/shadcn-ui/ui.git')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="border-input bg-card rounded-md">
      <CardHeader className="p-0">
        <Tabs defaultValue="local" className="font-stashly!">
          <TabsList className="w-full rounded-none border-b border-input bg-card h-10 px-4 justify-start gap-2">
            <TabsTrigger
              value="codespaces"
              className="text-xs h-8 rounded-md data-[state=active]:bg-secondary! data-[state=active]:text-secondary-foreground! text-muted-foreground!"
            >
              Codespaces
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="text-xs h-8 rounded-sm data-[state=active]:bg-secondary! data-[state=active]:text-secondary-foreground! text-muted-foreground!"
            >
              Local
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="mt-0 p-4 flex flex-col gap-3 ">
            <Tabs defaultValue="https" className="w-full">
              <TabsList className="bg-secondary! border-input! rounded-md w-max p-1">
                <TabsTrigger value="https">HTTPS</TabsTrigger>
                <TabsTrigger
                  value="ssh"
                  className="text-xs h-7  data-[state=active]:bg-card! data-[state=active]:text-foreground text-muted-foreground rounded-sm"
                >
                  SSH
                </TabsTrigger>
                <TabsTrigger value="cli">GitHub CLI</TabsTrigger>
              </TabsList>
              <TabsContent value="https" className="mt-3">
                <InputGroup className='border-muted'>
                  <InputGroupInput
                    readOnly
                    value="https://github.com/shadcn-ui/ui.git"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      variant="outline"
                      onClick={handleCopy}
                    >
                      {copied ? <DoubleCheckIcon /> : <CopyIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-muted-foreground mt-2">
                  Clone using the web URL.
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <button className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors py-1">
                <SquareDashedMousePointer className="w-3.5 h-3.5 text-muted-foreground" />
                Open with GitHub Desktop
              </button>
              <button className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors py-1">
                <CopyIcon className="w-3.5 h-3.5 text-muted-foreground" />
                Download ZIP
              </button>
            </div>
          </TabsContent>

          <TabsContent
            value="codespaces"
            className="mt-0 p-4 flex flex-col items-center gap-3 py-8"
          >
            <SquareDashedMousePointer className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                No codespaces
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                {
                  "You don't have any codespaces with this repository checked out"
                }
              </p>
            </div>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7"
            >
              Create Codespace
            </Button>
            <a
              href="#"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Learn more about codespaces
            </a>
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  )
}
