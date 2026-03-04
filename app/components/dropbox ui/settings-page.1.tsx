import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function SettingsPage() {
  return (
    <div className="flex-1 overflow-auto bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-4">
        <h1 className="text-lg font-medium text-foreground">Dropbox Profile</h1>
      </div>

      {/* Content */}
      <div className="px-8 py-8 space-y-12">
        {/* Profile Section */}
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            {/* Profile Photo */}
            <div className="relative">
              <Avatar className="w-24 h-24 rounded-2xl">
                <AvatarImage src="https://vercel.com/api/www/avatar/3f60bbb9b510e856df46cace99afbc22355fc3a1" />
                <AvatarFallback className="bg-muted text-2xl rounded-2xl">
                  AM
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-7 px-3 text-xs bg-card border border-border hover:bg-accent"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit Photo
              </Button>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <ProfileField label="Name" value="Alexander Mikolaenko" />
              <ProfileField label="Email" value="mikolaenko2014@gmail.com" />
              <ProfileField label="Date Format" value="DD/MM/YYYY" />
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Security Checkup:
                  </p>
                  <p className="text-sm text-foreground mt-1">Never Finished</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Start Checkup
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="space-y-6">
          <h2 className="text-base font-medium text-foreground">Preferences</h2>
          <div className="space-y-4">
            <PreferenceToggle
              label="Automatic Time Zone"
              value="GMT +02:00"
              defaultChecked
            />
            <PreferenceToggle
              label="Early Releases"
              value="Get included on early releases"
            />
            <PreferenceToggle
              label="People Info"
              value="See info about people who view my files"
              defaultChecked
            />
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm text-muted-foreground">
                  Manually Added Contacts
                </p>
                <p className="text-sm text-foreground mt-1">34 contacts</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            <PreferenceToggle
              label="Smart Sync"
              value="Smart Sync update for Mac"
            />
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="space-y-4">
          <h2 className="text-base font-medium text-foreground">
            Delete Account
          </h2>
        </div>
      </div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border">
      <div>
        <p className="text-sm text-muted-foreground">{label}:</p>
        <p className="text-sm text-foreground mt-1">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
      >
        Edit
      </Button>
    </div>
  )
}

function PreferenceToggle({
  label,
  value,
  defaultChecked = false,
}: {
  label: string
  value: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground mt-1">{value}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}
