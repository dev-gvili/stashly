import { cn } from '@/utils/styles'

interface VectorProps {
  className?: string
}

/** Modular isometric storage tray with animated dashed indigo drop-target slot */
export function EmptyCollectionVector({ className }: VectorProps) {
  return (
    <svg
      viewBox="0 0 168 112"
      fill="none"
      className={cn('h-28 w-42 shrink-0', className)}
      aria-hidden="true"
    >
      {/* Panel frame & alignment ticks */}
      <rect
        x="12"
        y="10"
        width="144"
        height="92"
        rx="10"
        className="fill-card stroke-input"
        strokeWidth="1.5"
      />
      <path
        d="M20 18H25M20 18V23M148 18H143M148 18V23M20 94H25M20 94V89M148 94H143M148 94V89"
        className="stroke-border"
        strokeWidth="1"
      />

      {/* Isometric tray outer walls */}
      <path
        d="M84 26L132 52L84 78L36 52L84 26Z"
        className="fill-muted/40 stroke-foreground/80"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M36 52V64L84 90L132 64V52"
        className="fill-card stroke-foreground/80"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M84 78V90" className="stroke-foreground/80" strokeWidth="1.5" />

      {/* Left inactive bay */}
      <path
        d="M78 39L54 52L66 58.5L90 45.5L78 39Z"
        className="stroke-muted-foreground/60"
        strokeWidth="1.25"
        strokeDasharray="3 2"
      />

      {/* Right animated indigo drop-target slot */}
      <path
        d="M96 48.5L72 61.5L84 68L108 55L96 48.5Z"
        className="animate-stashly-slot fill-primary/20 stroke-primary"
        style={{ animation: 'stashly-pulse-slot 2.8s ease-in-out infinite' }}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    </svg>
  )
}

/** Geometric viewfinder reticle scanning an unpopulated 5x4 index grid */
export function EmptySearchVector({ className }: VectorProps) {
  return (
    <svg
      viewBox="0 0 168 112"
      fill="none"
      className={cn('h-28 w-42 shrink-0', className)}
      aria-hidden="true"
    >
      <rect
        x="12"
        y="10"
        width="144"
        height="92"
        rx="10"
        className="fill-card stroke-input"
        strokeWidth="1.5"
      />

      {/* 5x4 Unpopulated index cells */}
      {[32, 54, 76, 98, 120].map((x) =>
        [24, 41, 58, 75].map((y) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="16"
            height="12"
            rx="2"
            className="fill-muted/30 stroke-border"
            strokeWidth="1"
          />
        ))
      )}

      {/* Outer static corner brackets */}
      <path
        d="M28 32V20H40M140 32V20H128M28 80V92H40M140 80V92H128"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="square"
      />

      {/* Animated scanning inner reticle */}
      <g
        className="animate-stashly-scan"
        style={{ animation: 'stashly-scan-reticle 4.5s ease-in-out infinite' }}
      >
        <path
          d="M68 46V39H75M100 46V39H93M68 66V73H75M100 66V73H93"
          className="stroke-primary"
          strokeWidth="1.75"
          strokeLinecap="square"
        />
        <path
          d="M84 49V63M77 56H91"
          className="stroke-primary"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </g>
    </svg>
  )
}

/** Segmented isometric archive bin with subtle breathing indigo rim */
export function EmptyTrashVector({ className }: VectorProps) {
  return (
    <svg
      viewBox="0 0 168 112"
      fill="none"
      className={cn('h-28 w-42 shrink-0', className)}
      aria-hidden="true"
    >
      <rect
        x="12"
        y="10"
        width="144"
        height="92"
        rx="10"
        className="fill-card stroke-input"
        strokeWidth="1.5"
      />

      {/* Bin body */}
      <path
        d="M58 38L62 82C62.5 85 65 87 68 87L84 93L100 87C103 87 105.5 85 106 82L110 38"
        className="fill-muted/35 stroke-foreground/80"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Vertical structural slats */}
      <path
        d="M70 48L72 78M84 52V84M98 48L96 78"
        className="stroke-muted-foreground/70"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Top rim & animated indigo aperture */}
      <g
        className="animate-stashly-float"
        style={{ animation: 'stashly-float-pip 3.4s ease-in-out infinite' }}
      >
        <path
          d="M84 22L112 35L84 48L56 35L84 22Z"
          className="fill-card stroke-foreground/85"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M84 26L104 35L84 44L64 35L84 26Z"
          className="fill-primary/25 stroke-primary"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
