import { cn } from '@/utils/styles'

interface VectorProps {
  className?: string
}

export function VaultKeycardDisconnectedVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-34 shrink-0', className)}
      viewBox="0 0 144 120"

      fill="none"
      aria-hidden="true"
    >
      <path
        className="stroke-muted-foreground motion-safe:animate-stashly-flow"
        d="M36 44L26 56V70M16 64H32M88 30H98V42M88 92H98V80"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <rect
        className="stroke-foreground fill-card"
        x="38"
        y="24"
        width="48"
        height="72"
        rx="6"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      <path
        className="stroke-foreground"
        d="M46 24V96"
        strokeOpacity="0.75"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-border fill-muted"
        fillOpacity="0.5"
        x="52"
        y="32"
        width="26"
        height="56"
        rx="3"
        strokeWidth="1.25"
      />
      <rect
        className="fill-primary motion-safe:animate-stashly-blink"
        x="80"
        y="32"
        width="2.5"
        height="6"
        rx="1"
      />
      {/* Unseated keycard hovering beside slot */}
      <g className="motion-safe:animate-stashly-keycard">
        <rect
          className="stroke-foreground fill-card"
          x="66"
          y="46"
          width="54"
          height="34"
          rx="4"
          strokeWidth="1.5"
        />
        <rect
          className="fill-muted-foreground"
          x="66.75"
          y="68"
          width="52.5"
          height="5"
          fillOpacity="0.4"
        />
        <path
          className="stroke-primary fill-primary"
          fillOpacity="0.4"
          d="M113 46.75H116C117.795 46.75 119.25 48.2051 119.25 50V76C119.25 77.7949 117.795 79.25 116 79.25H113V46.75Z"
          strokeWidth="1.25"
        />
      </g>
    </svg>
  )
}

export function NotFound404Vector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-34 shrink-0', className)}
      viewBox="0 0 144 120"

      fill="none"
      aria-hidden="true"
    >
      <path
        className="stroke-border"
        d="M18 46H126M18 74H126M54 18V102M90 18V102"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {/* 4 - [Missing Sector] - 4 */}
      <path
        className="stroke-foreground"
        d="M39 48V64H49M46 48V72"
        strokeOpacity="0.85"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        className="stroke-foreground"
        d="M95 48V64H105M102 48V72"
        strokeOpacity="0.85"
        strokeWidth="2"
        strokeLinecap="square"
      />
      {/* Animated unindexed center sector */}
      <g className="motion-safe:animate-stashly-slot">
        <rect
          className="stroke-primary fill-primary"
          fillOpacity="0.22"
          x="59"
          y="46"
          width="26"
          height="28"
          rx="4"
          strokeWidth="1.75"
          strokeDasharray="3 2"
        />
        <path
          className="stroke-primary"
          d="M67 55L77 65M77 55L67 65"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

export function ServerError500Vector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-34 shrink-0', className)}
      viewBox="0 0 144 120"

      fill="none"
      aria-hidden="true"
    >
      {/* Top healthy blade */}
      <rect
        className="stroke-border fill-card"
        x="26"
        y="22"
        width="92"
        height="20"
        rx="4"
        strokeWidth="1.5"
      />
      <path
        className="stroke-muted-foreground"
        d="M34 32H64"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <circle className="fill-primary" cx="106" cy="32" r="2.5" />

      {/* Middle faulted blade with horizontal jitter */}
      <g className="motion-safe:animate-stashly-fault-jitter">
        <rect
          className="stroke-primary fill-primary"
          fillOpacity="0.18"
          x="26"
          y="50"
          width="92"
          height="20"
          rx="4"
          strokeWidth="1.75"
        />
        <path
          className="stroke-primary"
          d="M34 60H52L56 55L61 65L65 60H76"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          className="fill-primary motion-safe:animate-stashly-blink"
          cx="106"
          cy="60"
          r="3"
        />
      </g>

      {/* Bottom standby blade */}
      <rect
        className="stroke-border fill-card"
        x="26"
        y="78"
        width="92"
        height="20"
        rx="4"
        strokeWidth="1.5"
      />
      <path
        className="stroke-muted-foreground"
        d="M34 88H64"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <circle
        className="fill-muted-foreground"
        opacity="0.45"
        cx="106"
        cy="88"
        r="2.5"
      />
    </svg>
  )
}

export function Forbidden403Vector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-34 shrink-0', className)}
      viewBox="0 0 144 120"

      fill="none"
      aria-hidden="true"
    >
      {/* Outer soft concentric clearance halo */}
      <circle
        className="stroke-border fill-muted"
        fillOpacity="0.35"
        cx="72"
        cy="60"
        r="34"
        strokeWidth="1.25"
        strokeDasharray="4 4"
      />

      {/* Smooth rounded-pill vault shield body */}
      <path
        className="stroke-foreground fill-card"
        d="M72 30C84 30 94 35 94 45V61C94 75 84 85 72 90C60 85 50 75 50 61V45C50 35 60 30 72 30Z"
        strokeOpacity="0.82"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated expanding & breathing clearance boundary ring */}
      <circle
        className="stroke-primary fill-primary motion-safe:animate-stashly-pulse"
        fillOpacity="0.16"
        cx="72"
        cy="59"
        r="16"
        style={{ transformOrigin: '72px 59px' }}
        strokeWidth="1.5"
      />

      {/* Smooth rounded capsule keyhole / clearance core */}
      <rect
        className="stroke-primary fill-primary"
        fillOpacity="0.3"
        x="66"
        y="49"
        width="12"
        height="20"
        rx="6"
        strokeWidth="1.5"
      />

      {/* Rounded diagonal restriction bar */}
      <path
        className="stroke-primary"
        d="M61 70L83 48"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ============================================================================
// 2B. MISSING APP ROUTE & PANEL EMPTY-STATE VECTORS (SMOOTH ROUNDED GEOMETRY)
// ============================================================================
