import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AddIcon, CheckIcon, CopyIcon } from '@/components/icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  Label,
  Separator,
} from '@/components/ui'

const initialMembers = [
  { email: 'alex@example.com', role: 'Editor' },
  { email: 'sam@example.com', role: 'Viewer' },
]

export function InviteTeamCard() {
  const [members, setMembers] = useState(initialMembers)
  const [copied, setCopied] = useState(false)

  const addMember = () => {
    setMembers((prev) => [...prev, { email: '', role: 'Viewer' }])
  }

  const handleCopy = () => {
    navigator.clipboard.writeText('https://app.co/invite/x8f2k')
    setCopied(true)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Invite Team
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Add members to your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {members?.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              defaultValue={m.email}
              placeholder="colleague@example.com"
              className="h-8 text-xs bg-secondary border-border text-foreground flex-1"
            />
            <Select defaultValue={m.role}>
              <SelectTrigger className="h-8 text-xs w-28 bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Editor">Editor</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addMember}
          className="self-start"
        >
          <AddIcon />
          Add another
        </Button>
        <Separator />
        <div>
          <Label className="text-sm text-muted-foreground mb-2 font-stashly">
            Or share invite link
          </Label>
          <InputGroup>
            <InputGroupInput
              readOnly
              value="https://app.co/invite/x8f2k"
              className="font-stashly"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Copy"
                title="Copy"
                size="icon-xs"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <Button className="w-full">Send Invites</Button>
      </CardContent>
    </Card>
  )
}
