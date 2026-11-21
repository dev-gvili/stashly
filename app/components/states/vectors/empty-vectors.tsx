import { Fragment } from 'react'
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

export function NoCollectionsVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Base isometric grid footprint */}
      <path
        className="stroke-border"
        d="M84 24L130 49L84 74L38 49L84 24Z"
        strokeWidth="1.25"
        strokeDasharray="2 3"
      />

      {/* Left ghosted collection folder block */}
      <g opacity="0.55">
        <path
          className="stroke-muted-foreground fill-muted"
          d="M66 37L82 45.5L64 55L48 46.5L66 37Z"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          className="stroke-muted-foreground fill-card"
          d="M48 46.5V56.5L64 65L82 55.5V45.5"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>

      {/* Bottom ghosted collection folder block */}
      <g opacity="0.55">
        <path
          className="stroke-muted-foreground fill-muted"
          d="M86 48L102 56.5L84 66L68 57.5L86 48Z"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          className="stroke-muted-foreground fill-card"
          d="M68 57.5V67.5L84 76L102 66.5V56.5"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>

      {/* Elevated animated primary collection blueprint slot */}
      <g className="motion-safe:animate-stashly-float">
        <path
          className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
          fillOpacity="0.28"
          d="M98 31L116 40.5L98 50L80 40.5L98 31Z"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinejoin="round"
        />
        <path
          className="stroke-primary fill-primary"
          fillOpacity="0.14"
          d="M80 40.5V50.5L98 60L116 50.5V40.5"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinejoin="round"
        />
        {/* Plus glyph centered on top face */}
        <path
          className="stroke-foreground"
          d="M98 36.5V44.5M91.5 40.5H104.5"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

// ============================================================================
// 2. PLACEHOLDERS & SYSTEM FALLBACK VECTORS
// ============================================================================

export function EmptyFolderVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Back folder tab & shell with smooth rounded corners */}
      <path
        className="stroke-foreground fill-muted"
        d="M42 36Q42 30 48 30H70Q74 30 77 34L81 38H120Q126 38 126 44V78Q126 84 120 84H48Q42 84 42 78V36Z"
        fillOpacity="0.4"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Front folder flap */}
      <path
        className="stroke-foreground fill-card"
        d="M38 48Q38 42 44 42H124Q130 42 130 48L126 78Q125 84 119 84H49Q43 84 42 78L38 48Z"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Animated floating drop-file card slot */}
      <g className="motion-safe:animate-stashly-float">
        <rect
          className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
          fillOpacity="0.25"
          x="67"
          y="22"
          width="34"
          height="28"
          rx="6"
          strokeWidth="1.6"
          strokeDasharray="3.5 2.5"
        />
        <path
          className="stroke-foreground"
          d="M84 41V31M80 35L84 31L88 35"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

export function EmptyGalleryImagesVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Back tilted rounded polaroid frame */}
      <rect
        className="stroke-border fill-muted"
        x="42"
        y="26"
        width="54"
        height="46"
        rx="8"
        transform="rotate(-7 42 26)"
        fillOpacity="0.5"
        strokeWidth="1.35"
      />
      {/* Front rounded gallery frame */}
      <rect
        className="stroke-foreground fill-card"
        x="56"
        y="24"
        width="64"
        height="54"
        rx="9"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      {/* Inner dashed photo aperture */}
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.16"
        x="63"
        y="31"
        width="50"
        height="34"
        rx="5"
        strokeWidth="1.4"
        strokeDasharray="3 2.5"
      />
      {/* Smooth curved horizon hill & sun */}
      <path
        className="stroke-primary"
        d="M65 61Q76 47 87 56Q96 49 111 61"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle
        className="stroke-primary fill-primary motion-safe:animate-stashly-sun-rise"
        fillOpacity="0.45"
        cx="99"
        cy="41"
        r="4"
        strokeWidth="1.3"
      />
    </svg>
  )
}

export function EmptyGalleryVideosVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Rounded widescreen cinema frame */}
      <rect
        className="stroke-foreground fill-card"
        x="38"
        y="24"
        width="92"
        height="54"
        rx="10"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      {/* Top & bottom sprocket pills */}
      {[48, 66, 84, 102, 114].map((x) => (
        <Fragment key={x}>
          <rect
            className="fill-muted-foreground"
            opacity="0.45"
            x={x}
            y="29"
            width="6"
            height="3"
            rx="1.5"
          />
          <rect
            className="fill-muted-foreground"
            opacity="0.45"
            x={x}
            y="70"
            width="6"
            height="3"
            rx="1.5"
          />
        </Fragment>
      ))}
      {/* Dashed play aperture ring */}
      <circle
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.2"
        cx="84"
        cy="51"
        r="14"
        strokeWidth="1.5"
        strokeDasharray="3.5 2.5"
      />
      {/* Rounded play wedge */}
      <path
        className="stroke-primary fill-primary"
        fillOpacity="0.45"
        d="M81 45.5L90.5 51L81 56.5V45.5Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FilteredEmptyVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Dimmed background stash card stack */}
      <rect
        className="stroke-border fill-muted"
        fillOpacity="0.45"
        x="48"
        y="24"
        width="64"
        height="42"
        rx="10"
        strokeWidth="1.4"
      />
      <rect
        className="stroke-foreground fill-card"
        x="42"
        y="32"
        width="64"
        height="42"
        rx="10"
        strokeOpacity="0.65"
        strokeWidth="1.4"
        strokeDasharray="3.5 2.5"
      />
      {/* Rounded placeholder content lines inside muted card */}
      <path
        className="stroke-muted-foreground"
        d="M53 45H79M53 53H71"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Floating rounded filter pill badge with zero-result dot */}
      <g className="motion-safe:animate-stashly-float">
        <rect
          className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
          fillOpacity="0.24"
          x="74"
          y="54"
          width="54"
          height="28"
          rx="14"
          strokeWidth="1.6"
        />
        {/* Filter funnel bars (all round-capped) */}
        <path
          className="stroke-foreground"
          d="M86 64H98M88.5 68H95.5M91 72H93"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Zero-match indicator ring */}
        <circle
          className="stroke-primary fill-card"
          cx="112"
          cy="68"
          r="5"
          strokeWidth="1.5"
        />
        <path
          className="stroke-primary"
          d="M110 70L114 66"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

export function ItemPanelsEmptyVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Back timeline / versions capsule */}
      <rect
        className="stroke-border fill-muted"
        x="42"
        y="24"
        width="64"
        height="46"
        rx="10"
        fillOpacity="0.5"
        strokeWidth="1.4"
      />
      {/* Front comment & access drawer card */}
      <rect
        className="stroke-foreground fill-card"
        x="56"
        y="34"
        width="70"
        height="50"
        rx="10"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      {/* Two avatar / node circles + rounded message bars */}
      <circle
        className="stroke-primary fill-primary"
        fillOpacity="0.3"
        cx="70"
        cy="49"
        r="5"
        strokeWidth="1.35"
      />
      <path
        className="stroke-muted-foreground"
        d="M80 47H113M80 52H102"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Animated dashed invite / comment slot */}
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.18"
        x="65"
        y="62"
        width="52"
        height="14"
        rx="7"
        strokeWidth="1.4"
        strokeDasharray="3 2.5"
      />
      <path
        className="stroke-foreground"
        d="M91 66.5V71.5M88.5 69H93.5"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function WorkspaceEmptyVector({ className }: VectorProps) {
  return (
    <svg
      className={cn('h-28 w-42 shrink-0', className)}
      viewBox="0 0 168 112"

      fill="none"
      aria-hidden="true"
    >
      {/* Outer rounded workspace hub ring */}
      <rect
        className="stroke-foreground fill-card"
        x="42"
        y="22"
        width="84"
        height="66"
        rx="14"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      {/* Left member node */}
      <circle
        className="stroke-muted-foreground fill-muted"
        cx="62"
        cy="46"
        r="7"
        strokeWidth="1.4"
      />
      {/* Right member node */}
      <circle
        className="stroke-muted-foreground fill-muted"
        cx="106"
        cy="46"
        r="7"
        strokeWidth="1.4"
      />
      {/* Rounded connector arc */}
      <path
        className="stroke-border"
        d="M69 46H99"
        strokeWidth="1.5"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />
      {/* Center active workspace hub badge */}
      <circle
        className="stroke-primary fill-primary motion-safe:animate-stashly-pulse"
        fillOpacity="0.28"
        cx="84"
        cy="46"
        r="10"
        style={{ transformOrigin: '84px 46px' }}
        strokeWidth="1.6"
      />
      <path
        className="stroke-foreground"
        d="M84 42V50M80 46H88"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Bottom shared vault capsule bar */}
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.16"
        x="56"
        y="66"
        width="56"
        height="12"
        rx="6"
        strokeWidth="1.35"
        strokeDasharray="3 2"
      />
    </svg>
  )
}

// ============================================================================
// 3. ALL 14 PRISMA ITEMCATEGORY VECTORS
// ============================================================================
