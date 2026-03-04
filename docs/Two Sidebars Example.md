Title: Two sidebars with a single provider — examples

This document provides several small examples showing how to use the new
multi-sidebar support in `SidebarProvider` (the provider holds per-sidebar
state keyed by id). Components like `SidebarTrigger` and `SidebarRail` can
target a sidebar using the `sidebarId` prop, and will automatically resolve
the id from their closest `Sidebar` scope if used inside a sidebar.

1. Minimal — two independent sidebars

```
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export default function Page() {
  return (
    <SidebarProvider>
      <Sidebar id="left" side="left">
        <SidebarContent>Left content</SidebarContent>
      </Sidebar>

      <Sidebar id="right" side="right" width="24rem">
        {/* per-sidebar width on right sidebar */}
        <SidebarContent>Right content</SidebarContent>
      </Sidebar>

      <div className="controls">
        <SidebarTrigger sidebarId="left">Toggle left</SidebarTrigger>
        <SidebarTrigger sidebarId="right">Toggle right</SidebarTrigger>
      </div>
    </SidebarProvider>
  )
}
```

2. Triggers inside a Sidebar (implicit scoping)

```
<SidebarProvider>
  <Sidebar id="left" side="left" width="18rem">
    <SidebarContent>
      <SidebarTrigger /> {/* toggles "left" by scope */}
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
```

3. Mixed — scoped triggers plus external trigging

This pattern is useful when the UI shows global controls and inline controls.

```
<SidebarProvider>
  <Sidebar id="left" side="left">
    <SidebarContent>Left content</SidebarContent>
  </Sidebar>

  <Sidebar id="right" side="right">
    <SidebarContent>
      <SidebarTrigger /> {/* triggers the right sidebar */}
    </SidebarContent>
  </Sidebar>

  <div className="global-controls">
    <SidebarTrigger sidebarId="left">Open left</SidebarTrigger>
    <SidebarTrigger sidebarId="right">Open right</SidebarTrigger>
  </div>
</SidebarProvider>
```

4. Using SidebarRail

`SidebarRail` also accepts `sidebarId` and can be placed beside a sidebar or
used from anywhere to target a specific id.

```
<SidebarProvider>
  <Sidebar id="left" side="left">...</Sidebar>
  <SidebarRail sidebarId="left" />
</SidebarProvider>
```

Notes & tips

- Backwards compatibility: any existing code that used a single provider with
  no id continues to work — `default` is the implicit id.
- Persistence: provider writes cookies per-id (e.g. `sidebar_state_left`) to
  preserve the open state across page loads. For full SSR consistency you can
  read those cookies and hydrate the provider's initial state in your loader
  (or server-side render function) if desired.

If you'd like, I can add a small example page in `app/routes` or a Playwright
e2e test that opens both sidebars and verifies they toggle independently.
