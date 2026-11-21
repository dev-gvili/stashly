import { cn } from '@/utils/styles'

interface VectorProps {
  className?: string
}

export function MediaHorizonFallbackVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('size-28 shrink-0', className)}
      viewBox="0 0 120 120"

      fill="none"
      aria-hidden="true"
    >
      <rect
        className="stroke-border fill-card"
        x="12"
        y="12"
        width="96"
        height="96"
        rx="16"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-foreground fill-muted"
        fillOpacity="0.45"
        x="18"
        y="18"
        width="84"
        height="84"
        rx="12"
        strokeOpacity="0.8"
        strokeWidth="1.5"
      />
      <path
        className="stroke-border"
        d="M60 18V102M18 60H102M21 21L99 99M99 21L21 99"
        strokeOpacity="0.65"
        strokeWidth="1"
      />
      <circle
        className="stroke-border"
        cx="60"
        cy="60"
        r="34"
        strokeOpacity="0.7"
        strokeWidth="1"
      />
      <circle
        className="stroke-border"
        cx="60"
        cy="60"
        r="22"
        strokeOpacity="0.8"
        strokeWidth="1"
      />
      <g
        className="motion-safe:animate-stashly-arc"
        style={{ transformOrigin: '60px 60px' }}
      >
        <path
          className="stroke-primary fill-primary"
          fillOpacity="0.35"
          d="M72 44A20 20 0 0 1 80 60H71A11 11 0 0 0 66 51L72 44Z"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <circle
          className="stroke-card fill-primary"
          cx="73"
          cy="43"
          r="3.5"
          strokeWidth="1.25"
        />
      </g>
      <path
        className="stroke-foreground fill-card"
        d="M49 60A11 11 0 0 1 71 60"
        strokeWidth="1.5"
      />
      <path
        className="stroke-foreground"
        d="M60 44V46M49 49L51 51M71 49L69 51M44 60H46M74 60H76"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        className="stroke-foreground"
        d="M34 60H86M52 67H68"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IndexingPipelineVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-34 shrink-0', className)}
      viewBox="0 0 144 120"

      fill="none"
      aria-hidden="true"
    >
      <path
        className="stroke-foreground"
        d="M54 22V32H40V40M40 50V60M28 60H36M44 60H66M78 60H90M102 60H112M72 34V54M72 66V76M72 86V98M84 82H96V96"
        strokeOpacity="0.75"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        className="stroke-muted-foreground motion-safe:animate-stashly-flow"
        d="M60 22H88V44M88 44H116V56M78 44H60M44 60H54M24 66V80M100 98H114"
        strokeWidth="1.25"
        strokeDasharray="2 3"
      />
      <rect
        className="stroke-foreground fill-card"
        x="49"
        y="14"
        width="10"
        height="10"
        rx="1.5"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-foreground fill-card"
        x="35"
        y="34"
        width="10"
        height="10"
        rx="1.5"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-foreground fill-card"
        x="19"
        y="55"
        width="10"
        height="10"
        rx="1.5"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-foreground fill-card"
        x="67"
        y="96"
        width="10"
        height="10"
        rx="1.5"
        strokeWidth="1.5"
      />
      <rect
        className="stroke-foreground fill-card"
        x="79"
        y="77"
        width="10"
        height="10"
        rx="1.5"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="88"
        cy="22"
        r="3"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="88"
        cy="44"
        r="3"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="24"
        cy="83"
        r="3"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="116"
        cy="60"
        r="5"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="96"
        cy="98"
        r="5"
        strokeWidth="1.5"
      />
      <circle
        className="stroke-foreground fill-card"
        cx="117"
        cy="98"
        r="3"
        strokeWidth="1.5"
      />
      <path
        className="stroke-border fill-muted"
        d="M72 39L77 44L72 49L67 44L72 39Z"
        strokeWidth="1.25"
      />
      <path
        className="stroke-border fill-muted"
        d="M40 55L45 60L40 65L35 60L40 55Z"
        strokeWidth="1.25"
      />
      <path
        className="stroke-border fill-muted"
        d="M96 55L101 60L96 65L91 60L96 55Z"
        strokeWidth="1.25"
      />
      <path
        className="stroke-border fill-muted"
        d="M72 76L77 81L72 86L67 81L72 76Z"
        strokeWidth="1.25"
      />
      <path
        className="stroke-border fill-muted"
        d="M108 77L113 82L108 87L103 82L108 77Z"
        strokeWidth="1.25"
      />
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-pulse"
        x="66"
        y="54"
        width="12"
        height="12"
        rx="2"
        style={{ transformOrigin: '72px 60px' }}
        strokeWidth="1.5"
      />
    </svg>
  )
}
