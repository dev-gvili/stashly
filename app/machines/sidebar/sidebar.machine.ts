import { setup, assign } from 'xstate'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export const sidebarMachine = setup({
  types: {
    input: {} as { initialState: 'expanded' | 'collapsed'; isMobile?: boolean },
    context: {} as {
      isMobile: boolean
      openMobile: boolean
      initialState: 'expanded' | 'collapsed'
    },
    events: {} as
      | { type: 'TOGGLE' }
      | { type: 'TOGGLE_MOBILE' }
      | { type: 'OPEN' }
      | { type: 'CLOSE' }
      | { type: 'SET_MOBILE'; isMobile: boolean }
      | { type: 'SET_OPEN_MOBILE'; open: boolean },
  },
  actions: {
    setCookie: (_, params: { expanded: boolean }) => {
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${params.expanded}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwJYTAIwIYCcDEAygKIAqA+gLIDyAQgJIAyRA2gAwC6ioADgPaoAXFLwB2XEAA9EAZgAcrAHSyAbNLkBOdQEYALK2nrZAGhABPRACZWFhYdatlAVnVyA7FueuAvl5Op02PgkVADiIUyUtIwsHOJ8gsJiSJIyyjoKHoY6shbqrLK66ibmCFqsrgo6efq5yi6OrureviD+mLiEpGRUAApEAHKR9ExsnMnxKEKi4lII0o7KCmk6qq6sjvrSWk7FiFoWPn5o7TgKKCKTeKNx-JOJM3vKixYWC8oWqhZyrLq7c642WTSZSuApaIGOD7NI4BXBnC4CK5aMY8W5TJKgWbbZ6vJ4faRfeS-MyIRzgyo6LRbRyUsmU6GtY6BBRgCTcLAidAQPDBMIjWLjNH3ZKzGlaJQGZT2HRWWQ6LZ-NLiqmsHRk-TKXRpQ6M2GnVnszmQPAAYQYVGI10FCWmItJjmklRpaQdBO0Bj+VXFrHUC2BVIdWi0OrazIAxrwADaRrDcWDG3nhGIokATdEPBBiiXqKWq2XyrR-LNlAGUsovBbBlqhuER6Ox+Pc3oDK2om0YlKZynZ3My-IFovaDLguVSupWKk+FoiXjoeDJGs4G7tjMAWkLJIQFlkjkqax9sjy8lckpDTLh50my7utsxiB0rj+0lcFQ+QPk6m3KheyjPepZbIcly17pnaCAgruTiqjoMpqhYWiuMoRYIbY2SQjByiyGslJ-icCh1jGcaQCBwp3nM24KA6Vgnq4ehONIKyei4Cj6JWtGuo4kK-lOQA */
  id: 'sidebar',
  context: ({ input }) => ({
    isMobile: input?.isMobile ?? false,
    openMobile: false,
    initialState: input?.initialState,
  }),
  initial: 'init',
  states: {
    init: {
      always: [
        {
          target: 'expanded',
          guard: ({ context }) => context.initialState === 'expanded',
        },
        { target: 'collapsed' },
      ],
    },
    expanded: {
      on: {
        TOGGLE: 'collapsed',
        CLOSE: 'collapsed',
      },
      entry: {
        type: 'setCookie',
        params: { expanded: true },
      },
    },
    collapsed: {
      on: {
        TOGGLE: 'expanded',
        OPEN: 'expanded',
      },
      entry: {
        type: 'setCookie',
        params: { expanded: false },
      },
    },
  },
  on: {
    SET_MOBILE: {
      actions: assign({
        isMobile: ({ event }) => event.isMobile,
      }),
    },
    TOGGLE_MOBILE: {
      actions: assign({
        openMobile: ({ context }) => !context.openMobile,
      }),
    },
    SET_OPEN_MOBILE: {
      actions: assign({
        openMobile: ({ event }) => event.open,
      }),
    },
  },
})
