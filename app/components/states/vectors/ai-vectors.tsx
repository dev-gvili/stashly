import { cn } from '@/utils/styles'

/**
 * Animated vectors for the in-browser AI pipelines (Whisper transcription,
 * PDF OCR, image captions), drawn on a 144×96 canvas: a source on the left,
 * a dashed stream, and the extracted result on the right. Colours come from
 * the theme classes and every animation is `motion-safe:`, so reduced motion
 * shows the still frame. Size them with `className`.
 *
 * Layout shared by all four: the left object starts at x=20 (a whole-vector
 * translate where its drawing starts elsewhere) and an 18-unit gap, holding a
 * centred 12-unit stream, separates it from the result on the right.
 */
interface AiVectorProps {
  className?: string
}

const SVG_CLASS = 'h-24 w-36 shrink-0'

/** Static AI spark badge on the result card's top-right corner. */
function SparkBadge({
  x,
  y,
  size,
  spark,
}: {
  x: number
  y: number
  size: number
  spark: string
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size > 16 ? 5 : 4}
        className="fill-card stroke-primary"
        strokeWidth="1.4"
      />
      <path
        d={spark}
        className="fill-primary stroke-primary"
        fillOpacity="0.38"
        strokeWidth={size > 16 ? 1.15 : 1.1}
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Dashed stream from the source to the result. */
function Stream({ d }: { d: string }) {
  return (
    <path
      d={d}
      className="stroke-primary motion-safe:animate-stashly-flow"
      strokeWidth="1.5"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
  )
}

const EQ_BARS = [
  { x: 32.4, y1: 38, y2: 58, active: false, delay: '0s' },
  { x: 39.4, y1: 31, y2: 65, active: true, delay: '0.18s' },
  { x: 46.4, y1: 26, y2: 70, active: true, delay: '0.36s' },
  { x: 53.4, y1: 33, y2: 63, active: false, delay: '0.54s' },
]

/** Audio equalizer streaming into a transcript card. */
export function AiAudioTranscriptionVector({ className }: AiVectorProps) {
  return (
    <svg
      viewBox="0 0 144 96"
      fill="none"
      aria-hidden
      className={cn(SVG_CLASS, className)}
    >
      <g transform="translate(-12.4 0)">
        {EQ_BARS.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={bar.y1}
            width="3.6"
            height={bar.y2 - bar.y1}
            rx="1.8"
            className={cn(
              'motion-safe:animate-stashly-eq',
              bar.active ? 'fill-primary' : 'fill-foreground'
            )}
            fillOpacity={bar.active ? 0.9 : 0.78}
            style={{
              transformOrigin: `${bar.x + 1.8}px 48px`,
              animationDelay: bar.delay,
            }}
          />
        ))}
        <Stream d="M60 48H72" />
        <rect
          x="75"
          y="25"
          width="46"
          height="46"
          rx="8"
          className="fill-card stroke-foreground"
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
        <path
          d="M83 36H112M83 43H108M83 50H113M83 57H99"
          className="stroke-muted-foreground"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M83 50H113"
          className="stroke-primary motion-safe:animate-stashly-slot"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
        <SparkBadge
          x={111}
          y={16}
          size={18}
          spark="M120 20L121.6 23.4L125 25L121.6 26.6L120 30L118.4 26.6L115 25L118.4 23.4L120 20Z"
        />
      </g>
    </svg>
  )
}

/** Film clip streaming into a time-coded transcript. */
export function AiVideoTranscriptionVector({ className }: AiVectorProps) {
  return (
    <svg
      viewBox="0 0 144 96"
      fill="none"
      aria-hidden
      className={cn(SVG_CLASS, className)}
    >
      <rect
        x="20"
        y="27"
        width="40"
        height="42"
        rx="7"
        className="fill-card stroke-foreground"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      <path
        d="M27 31.5H31M38 31.5H42M49 31.5H53M27 64.5H31M38 64.5H42M49 64.5H53"
        className="stroke-muted-foreground"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M37 42.5L46 48L37 53.5V42.5Z"
        className="fill-primary stroke-primary motion-safe:animate-stashly-pulse"
        fillOpacity="0.35"
        strokeWidth="1.4"
        strokeLinejoin="round"
        style={{ transformOrigin: '41px 48px' }}
      />
      <Stream d="M63 48H75" />
      <rect
        x="78"
        y="24"
        width="44"
        height="48"
        rx="8"
        className="fill-card stroke-foreground"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      <rect
        x="84"
        y="33"
        width="8"
        height="4"
        rx="1.5"
        className="fill-primary"
      />
      <path
        d="M95 35H115"
        className="stroke-foreground"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="83"
        y="43"
        width="34"
        height="10"
        rx="3"
        className="fill-primary stroke-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.2"
        strokeWidth="1.2"
      />
      <path
        d="M87 48H113"
        className="stroke-primary"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="84"
        y="59"
        width="8"
        height="4"
        rx="1.5"
        className="fill-muted-foreground"
        fillOpacity="0.65"
      />
      <path
        d="M95 61H110"
        className="stroke-muted-foreground"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <SparkBadge
        x={111}
        y={16}
        size={16}
        spark="M119 19.5L120.4 22.6L123.5 24L120.4 25.4L119 28.5L117.6 25.4L114.5 24L117.6 22.6L119 19.5Z"
      />
    </svg>
  )
}

/** Scanned page under a laser pass, streaming into recognised text. */
export function AiOcrVector({ className }: AiVectorProps) {
  return (
    <svg
      viewBox="0 0 144 96"
      fill="none"
      aria-hidden
      className={cn(SVG_CLASS, className)}
    >
      <g transform="translate(-2 0)">
        <rect
          x="22"
          y="25"
          width="38"
          height="46"
          rx="6"
          className="fill-card stroke-foreground"
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
        <rect
          x="28"
          y="32"
          width="26"
          height="13"
          rx="2.5"
          className="fill-muted stroke-muted-foreground"
          strokeOpacity="0.65"
          strokeWidth="1.1"
        />
        <path
          d="M28 51H52M28 57H48M28 63H43"
          className="stroke-muted-foreground"
          strokeOpacity="0.65"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <g className="motion-safe:animate-stashly-doc-scan">
          <path
            d="M19 32H63"
            className="stroke-primary"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </g>
        <Stream d="M63 48H75" />
        <rect
          x="78"
          y="25"
          width="44"
          height="46"
          rx="7"
          className="fill-card stroke-foreground"
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
        <rect
          x="84"
          y="33"
          width="16"
          height="11"
          rx="2.5"
          className="fill-primary stroke-primary motion-safe:animate-stashly-slot"
          fillOpacity="0.22"
          strokeWidth="1.25"
        />
        <path
          d="M88 41L92 35.5L96 41M89.5 39.2H94.5"
          className="stroke-primary"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M104 36H115M104 41H113M85 51H115M85 57H111M85 63H103"
          className="stroke-foreground"
          strokeOpacity="0.82"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <SparkBadge
          x={112}
          y={16}
          size={16}
          spark="M120 19.5L121.4 22.6L124.5 24L121.4 25.4L120 28.5L118.6 25.4L115.5 24L118.6 22.6L120 19.5Z"
        />
      </g>
    </svg>
  )
}

/** Image under a focus reticle, streaming into a stack of caption tokens. */
export function AiImageCaptionVector({ className }: AiVectorProps) {
  return (
    <svg
      viewBox="0 0 144 96"
      fill="none"
      aria-hidden
      className={cn(SVG_CLASS, className)}
    >
      <g transform="translate(-10 0)">
        <rect
          x="30"
          y="27"
          width="44"
          height="42"
          rx="7"
          className="fill-card stroke-foreground"
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
        <path
          d="M35 61L46.5 49L56 57.5L62.5 51.5L69 61"
          className="stroke-muted-foreground"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="61"
          cy="36.5"
          r="3"
          className="fill-primary stroke-primary motion-safe:animate-stashly-sun-rise"
          fillOpacity="0.4"
          strokeWidth="1.35"
        />
        {/* The project's reticle drift (keyframes stashly-scan-reticle). */}
        <g className="motion-safe:animate-stashly-scan">
          <path
            d="M39 40V36H43M56 40V36H52M39 52V56H43M56 52V56H52"
            className="stroke-primary"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <Stream d="M77 48H89" />
        <g>
          <rect
            x="92"
            y="25"
            width="30"
            height="14"
            rx="4"
            className="fill-primary stroke-primary"
            fillOpacity="0.2"
            strokeWidth="1.4"
          />
          <path
            d="M100 28.5L101 30.8L103.3 31.8L101 32.8L100 35.1L99 32.8L96.7 31.8L99 30.8L100 28.5Z"
            className="fill-primary"
          />
          <path
            d="M106.5 31.8H116.5"
            className="stroke-foreground"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="92"
            y="43"
            width="26"
            height="12"
            rx="4"
            className="fill-card stroke-foreground"
            strokeOpacity="0.8"
            strokeWidth="1.4"
          />
          <path
            d="M97.5 49H112.5"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="92"
            y="59"
            width="22"
            height="12"
            rx="4"
            className="fill-card stroke-muted-foreground"
            strokeOpacity="0.7"
            strokeWidth="1.35"
          />
          <path
            d="M97.5 65H108.5"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  )
}
