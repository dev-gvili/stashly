import { cn } from '@/utils/styles'

interface VectorProps {
  className?: string
}

export function EmptyCollectionVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Smooth rounded isometric tray deck */}
      <path
        className="stroke-foreground fill-muted"
        d="M80 28Q84 26 88 28L128 50Q132 52 128 54L88 76Q84 78 80 76L40 54Q36 52 40 50Z"
        fillOpacity="0.45"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rounded lower front walls */}
      <path
        className="stroke-foreground fill-card"
        d="M37 53V61Q37 64 40 66L80 88Q84 90 88 88L128 66Q131 64 131 61V53"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rounded center vertical spine */}
      <path
        className="stroke-foreground"
        d="M84 78V89"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Pill-shaped recessed side label slot */}
      <path
        className="stroke-muted-foreground"
        d="M48 63.5L70 75.5Q72 76.5 72 78.5V79.5Q72 81 70 80L48 68Q46 67 46 65V64.5Q46 62.5 48 63.5Z"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Soft rounded secondary bay slot */}
      <path
        className="stroke-muted-foreground"
        d="M75 40.5Q78 39 81 40.5L88 44.3Q90 45.5 88 46.7L69 57Q66 58.5 63 57L56 53.2Q54 52 56 50.8Z"
        strokeOpacity="0.6"
        strokeWidth="1.25"
        strokeDasharray="3 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Animated soft-rounded primary bay slot */}
      <path
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.28"
        d="M93 50Q96 48.5 99 50L106 53.8Q108 55 106 56.2L87 66.5Q84 68 81 66.5L74 62.7Q72 61.5 74 60.3Z"
        strokeWidth="1.75"
        strokeDasharray="3 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function EmptySearchVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {[28, 43, 58, 73].map((y) =>
        [40, 59, 78, 97, 116].map((x) => (
          <rect
            className="stroke-border fill-muted"
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="13"
            height="10"
            rx="1.5"
            fillOpacity="0.4"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        ))
      )}
      <g className="motion-safe:animate-stashly-scan">
        <path
          className="stroke-primary"
          d="M68 42H62V48M100 42H106V48M68 70H62V64M100 70H106V64"
          strokeWidth="2"
          strokeLinecap="square"
        />
        <path
          className="stroke-primary"
          d="M84 50V62M78 56H90"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </g>
    </svg>
  )
}

export function EmptyTrashVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      <path
        className="stroke-foreground fill-muted"
        d="M56 35L64 82L84 91L104 82L112 35"
        fillOpacity="0.4"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="stroke-border"
        d="M84 48V91M70 43L73 86M98 43L95 86"
        strokeWidth="1.25"
      />
      <g className="motion-safe:animate-stashly-float">
        <path
          className="stroke-foreground fill-card"
          d="M84 22L112 35L84 48L56 35L84 22Z"
          strokeOpacity="0.9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          className="stroke-primary fill-primary"
          fillOpacity="0.28"
          d="M84 26L104 35L84 44L64 35L84 26Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
