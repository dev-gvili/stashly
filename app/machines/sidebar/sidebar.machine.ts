import { setup, assign } from 'xstate'

const SIDEBAR_COOKIE_NAME = 'stashly-sidebar'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function cookieNameForId(id: string) {
  return `${SIDEBAR_COOKIE_NAME}-${id}`
}

function parseCookieValue(value: string | null) {
  if (value === null) return null
  const v = String(value).toLowerCase()
  if (v === '1' || v === 'true' || v === 'on' || v === 'expanded') return true
  if (v === '0' || v === 'false' || v === 'off' || v === 'collapsed')
    return false
  return null
}

function readSidebarCookie(id: string) {
  if (typeof document === 'undefined') return null
  const name = cookieNameForId(id)
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(encodeURIComponent(name) + '='))
  if (!cookie) return null
  const raw = cookie.split('=').slice(1).join('=')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const sidebarMachine = setup({
  types: {
    context: {} as {
      id: string
      isMobile: boolean
      openMobile: boolean
      initialState?: 'expanded' | 'collapsed'
      collapsible: 'offcanvas' | 'none' | 'icon'
      persist: boolean
    },
    events: {} as
      | { type: 'TOGGLE' }
      | { type: 'CLOSE' }
      | { type: 'OPEN' }
      | { type: 'SET_OPEN'; open: boolean }
      | { type: 'SET_MOBILE'; isMobile: boolean }
      | { type: 'TOGGLE_MOBILE' }
      | { type: 'SET_OPEN_MOBILE'; open: boolean }
      | { type: 'OPEN_MOBILE' }
      | { type: 'CLOSE_MOBILE'  }
      | { type: 'SET_ID'; id: string }
      | { type: 'SET_COLLAPSIBLE'; collapsible: 'offcanvas' | 'none' | 'icon' }
      | { type: 'RESTORE' }
      | { type: 'PERSIST'; persist: boolean },
  },
  actions: {
    // Persist a per-id cookie like `stashly-sidebar-<id>` = true|false
    setCookie: (context: any, params: { expanded: boolean }) => {
      try {
        if (typeof document === 'undefined') return
        const id = (context as any).id ?? 'default'
        const name = cookieNameForId(id)
        const val = params.expanded ? 'true' : 'false'
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      } catch (e) {}
    },

    // Optionally POST to /api/sidebar to set server cookie. Uses sendBeacon when available.
    maybePersistToServer: (context: any, params: { expanded: boolean }) => {
      try {
        if (!(context as any).persist) return
        const id = (context as any).id
        const data = new URLSearchParams()
        data.append('id', id)
        data.append('state', String(params.expanded))

        // Use sendBeacon when possible (works during unload); otherwise do a fire-and-forget fetch
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([data.toString()], {
            type: 'application/x-www-form-urlencoded',
          })
          navigator.sendBeacon('/api/sidebar', blob)
          return
        }

        if (typeof fetch !== 'undefined') {
          fetch('/api/sidebar', {
            method: 'POST',
            body: data,
            credentials: 'same-origin',
          }).catch(() => {})
        }
      } catch (e) {}
    },

    // Toggle mobile open only when isMobile
    toggleMobileIfNeeded: assign({
      openMobile: ({ isMobile, openMobile }: any) =>
        isMobile ? !openMobile : openMobile,
    }),

    setIsMobile: assign({ isMobile: (_: any, event: any) => event.isMobile }),
    setOpenMobile: assign({ openMobile: (_: any, event: any) => event.open }),
    setId: assign({ id: (_: any, event: any) => event.id }),
    setCollapsible: assign({
      collapsible: (_: any, event: any) => event.collapsible,
    }),
    // Convenience actions that hard-code expanded/collapsed params
    setCookieExpanded: (context: any) => {
      try {
        if (typeof document === 'undefined') return
        const id = (context as any).id ?? 'default'
        const name = cookieNameForId(id)
        document.cookie = `${encodeURIComponent(name)}=true; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      } catch (e) {}
    },

    maybePersistToServerExpanded: (context: any) => {
      try {
        if (!(context as any).persist) return
        const id = (context as any).id
        const data = new URLSearchParams()
        data.append('id', id)
        data.append('state', 'true')
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([data.toString()], {
            type: 'application/x-www-form-urlencoded',
          })
          navigator.sendBeacon('/api/sidebar', blob)
          return
        }
        if (typeof fetch !== 'undefined') {
          fetch('/api/sidebar', {
            method: 'POST',
            body: data,
            credentials: 'same-origin',
          }).catch(() => {})
        }
      } catch (e) {}
    },

    setCookieCollapsed: (context: any) => {
      try {
        if (typeof document === 'undefined') return
        const id = (context as any).id ?? 'default'
        const name = cookieNameForId(id)
        document.cookie = `${encodeURIComponent(name)}=false; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      } catch (e) {}
    },

    maybePersistToServerCollapsed: (context: any) => {
      try {
        if (!(context as any).persist) return
        const id = (context as any).id
        const data = new URLSearchParams()
        data.append('id', id)
        data.append('state', 'false')
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([data.toString()], {
            type: 'application/x-www-form-urlencoded',
          })
          navigator.sendBeacon('/api/sidebar', blob)
          return
        }
        if (typeof fetch !== 'undefined') {
          fetch('/api/sidebar', {
            method: 'POST',
            body: data,
            credentials: 'same-origin',
          }).catch(() => {})
        }
      } catch (e) {}
    },

    noop: () => {},
  },
  guards: {
    shouldStartExpanded: (context: any, _event: any) => {
      // 1) If initialState explicitly provided, respect that value
      if (context.initialState) return context.initialState === 'expanded'

      // 2) Try to read cookie for this id
      const raw = readSidebarCookie(context.id)
      const parsed = parseCookieValue(raw)
      if (parsed !== null) return parsed

      // 3) Fallback to expanded (matches provider defaultOpen=true)
      return true
    },

    // Collapsible 'none' prevents collapsing
    canCollapse: (context: any, _event: any) => context.collapsible !== 'none',
  },
}).createMachine({
  id: 'sidebar',
  context: ({ input }: any) => ({
    id: input?.id ?? 'default',
    isMobile: input?.isMobile ?? false,
    openMobile: false,
    initialState: input?.initialState,
    collapsible: input?.collapsible ?? 'offcanvas',
    persist: input?.persist ?? false,
  }),
  initial: 'init',
  states: {
    init: {
      always: [
        { target: 'expanded', cond: 'shouldStartExpanded' },
        { target: 'collapsed' },
      ],
    },

    expanded: {
      on: {
        // Always toggle the desktop open/closed state; only toggle mobile flag when on mobile
        TOGGLE: [
          {
            cond: 'canCollapse',
            target: 'collapsed',
            actions: ['toggleMobileIfNeeded'],
          },
          { actions: 'noop' },
        ],
        CLOSE: { target: 'collapsed' },
        SET_OPEN: {
          cond: (_: any, e: any) => e.open === false,
          target: 'collapsed',
        },
      },
      entry: ['setCookieExpanded', 'maybePersistToServerExpanded'],
    },

    collapsed: {
      on: {
        TOGGLE: { target: 'expanded', actions: ['toggleMobileIfNeeded'] },
        OPEN: { target: 'expanded' },
        SET_OPEN: {
          cond: (_: any, e: any) => e.open === true,
          target: 'expanded',
        },
      },
      entry: ['setCookieCollapsed', 'maybePersistToServerCollapsed'],
    },
  },

  on: {
    SET_MOBILE: { actions: 'setIsMobile' },
    TOGGLE_MOBILE: { actions: 'toggleMobileIfNeeded' },
    SET_OPEN_MOBILE: { actions: 'setOpenMobile' },
    OPEN_MOBILE: { actions: assign({ openMobile: () => true }) },
    CLOSE_MOBILE: { actions: assign({ openMobile: () => false }) },
    SET_ID: { actions: 'setId' },
    SET_COLLAPSIBLE: { actions: 'setCollapsible' },
    RESTORE: { actions: 'noop' },
    PERSIST: { actions: assign({ persist: (_, e: any) => e.persist ?? true }) },
  },
})

export default sidebarMachine
