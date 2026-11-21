import type { JSX } from 'react'
import type { ItemCategory } from '@/prisma/enums'
import { cn } from '@/utils/styles'

export type { ItemCategory }

interface CategoryVectorProps {
  category: ItemCategory
  className?: string
}

/** scrub-loop: Play wedge stays anchored while timeline progress bar repeats. */
function VideoGlyph() {
  return (
    <>
      <rect
        className="stroke-border fill-card"
        x="26"
        y="22"
        width="68"
        height="40"
        rx="4"
        strokeWidth="1.5"
      />
      {/* Static play wedge */}
      <path
        className="stroke-primary fill-primary"
        fillOpacity="0.35"
        d="M54 31L70 40L54 49V31Z"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Track background */}
      <path
        className="stroke-border"
        d="M32 55H88"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Repeating progress bar fill & playhead pip */}
      <path
        className="stroke-primary motion-safe:animate-stashly-video-progress"
        d="M32 55H88"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="56"
      />
      <circle
        className="fill-primary motion-safe:animate-stashly-video-head"
        cx="32"
        cy="55"
        r="2.5"
      />
    </>
  )
}

/** equalizer-7: 7-bar harmonic waveform scales in staggered phase. */
function AudioGlyph() {
  return (
    <>
      {[
        { x: 36, y1: 37, y2: 47, active: false, delay: '0s' },
        { x: 44, y1: 31, y2: 53, active: true, delay: '0.15s' },
        { x: 52, y1: 27, y2: 57, active: true, delay: '0.3s' },
        { x: 60, y1: 23, y2: 61, active: false, delay: '0.45s' },
        { x: 68, y1: 31, y2: 53, active: false, delay: '0.6s' },
        { x: 76, y1: 35, y2: 49, active: false, delay: '0.75s' },
        { x: 84, y1: 38, y2: 46, active: false, delay: '0.9s' },
      ].map((bar) => (
        <rect
          className={cn(
            'motion-safe:animate-stashly-eq',
            bar.active
              ? 'fill-primary stroke-primary'
              : 'fill-card stroke-muted-foreground'
          )}
          fillOpacity={bar.active ? 0.35 : 1}
          key={bar.x}
          x={bar.x - 1.5}
          y={bar.y1}
          width="3"
          height={bar.y2 - bar.y1}
          rx="1"
          style={{
            transformOrigin: `${bar.x}px 42px`,
            animationDelay: bar.delay,
          }}
          strokeWidth="1.35"
        />
      ))}
    </>
  )
}

/** ridge-draw: Architectural ridge lines sketch progressively as sun rises. */
function ImageGlyph() {
  return (
    <>
      <rect
        className="stroke-border fill-card"
        x="26"
        y="24"
        width="68"
        height="38"
        rx="4"
        strokeWidth="1.5"
      />
      {/* Subtle architectural construction guide lines */}
      <path
        className="stroke-muted-foreground"
        d="M27 56L48 39L70 56M55 56L73 42L93 56"
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Animated concept-drawing twin mountain ridges */}
      <path
        className="stroke-primary motion-safe:animate-stashly-draw-primary"
        d="M27 56L48 39L70 56"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
      />
      <path
        className="stroke-foreground motion-safe:animate-stashly-draw-secondary"
        d="M55 56L73 42L93 56"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="55"
      />
      {/* Rising sun focal node */}
      <circle
        className="stroke-primary fill-primary motion-safe:animate-stashly-sun-rise"
        fillOpacity="0.4"
        cx="77"
        cy="34"
        r="3.75"
        strokeWidth="1.35"
      />
    </>
  )
}

/** fold-scan: Dog-ear corner folds & OCR scan beam sweeps lines. */
function DocumentGlyph() {
  return (
    <>
      <path
        className="stroke-border fill-card"
        d="M40 20H70L80 30V64H40V20Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="stroke-primary fill-primary motion-safe:animate-stashly-dogear"
        fillOpacity="0.4"
        d="M70 20V30H80L70 20Z"
        style={{ transformOrigin: '70px 30px' }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="stroke-muted-foreground"
        d="M47 36H72M47 42H73M47 48H73M47 54H65"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        className="stroke-primary motion-safe:animate-stashly-doc-scan"
        d="M47 36H73"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </>
  )
}

/** cell-shift: Active indigo cell highlight steps across grid. */
function SpreadsheetGlyph() {
  return (
    <>
      <rect
        className="stroke-border fill-card"
        x="30"
        y="22"
        width="60"
        height="40"
        rx="3"
        strokeWidth="1.5"
      />
      <path
        className="stroke-border"
        d="M50 22V62M70 22V62M30 35H90M30 49H90"
        strokeWidth="1.25"
      />
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-cell"
        fillOpacity="0.42"
        x="31"
        y="23"
        width="18"
        height="11"
        strokeWidth="1.25"
      />
    </>
  )
}

/** slide-carousel: Sequential presentation slides cycle across viewport with active indicator pips. */
function PresentationGlyph() {
  return (
    <>
      <defs>
        <clipPath id="stashly-pres-clip">
          <rect x="27" y="21" width="66" height="35" rx="3" />
        </clipPath>
      </defs>
      <rect
        className="stroke-border fill-card"
        x="26"
        y="20"
        width="68"
        height="37"
        rx="4"
        strokeWidth="1.5"
      />
      <g clipPath="url(#stashly-pres-clip)">
        <g className="motion-safe:animate-stashly-carousel-b">
          <rect
            className="stroke-primary fill-primary"
            fillOpacity="0.16"
            x="44"
            y="26"
            width="42"
            height="25"
            rx="3"
            strokeWidth="1.5"
          />
          <path
            className="stroke-foreground"
            d="M52 33H78M52 38.5H73M52 44H66"
            strokeOpacity="0.6"
            strokeWidth="1.35"
            strokeLinecap="square"
          />
        </g>
        <g className="motion-safe:animate-stashly-carousel-a">
          <rect
            className="stroke-primary fill-card"
            x="33"
            y="26"
            width="42"
            height="25"
            rx="3"
            strokeWidth="1.6"
          />
          <rect
            className="fill-primary"
            fillOpacity="0.28"
            x="33"
            y="26"
            width="42"
            height="25"
            rx="3"
          />
          <rect
            className="stroke-primary fill-primary"
            fillOpacity="0.45"
            x="38"
            y="31"
            width="11"
            height="15"
            rx="1.5"
            strokeWidth="1.25"
          />
          <path
            className="stroke-foreground"
            d="M53 33.5H69M53 38.5H66M53 43.5H61"
            strokeOpacity="0.92"
            strokeWidth="1.4"
            strokeLinecap="square"
          />
        </g>
      </g>
      <rect
        className="fill-primary motion-safe:animate-stashly-pip-a"
        x="51"
        y="61"
        width="7"
        height="2.5"
        rx="1"
      />
      <rect
        className="fill-primary motion-safe:animate-stashly-pip-b"
        opacity="0.3"
        x="62"
        y="61"
        width="7"
        height="2.5"
        rx="1"
      />
    </>
  )
}

/** line-sweep: Highlighted line sweeps with active reading focus. */
function TextGlyph() {
  return (
    <>
      <path
        className="stroke-muted-foreground"
        d="M32 25H54M32 32H84M32 39H78M32 46H66M32 53H82M32 60H70"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        className="stroke-primary motion-safe:animate-stashly-slot"
        d="M32 32H84"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
    </>
  )
}

/** stamp-seal: PDF badge & signature seal stamps onto fixed page. */
function PdfGlyph() {
  return (
    <>
      {/* Fixed-layout PDF page sheet */}
      <rect
        className="stroke-border fill-card"
        x="38"
        y="19"
        width="44"
        height="46"
        rx="3"
        strokeWidth="1.5"
      />
      {/* Top-left PDF tag header */}
      <rect
        className="stroke-primary fill-primary"
        fillOpacity="0.28"
        x="43"
        y="24"
        width="21"
        height="9"
        rx="1.5"
        strokeWidth="1.25"
      />
      <text
        className="fill-foreground"
        x="53.5"
        y="30.5"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="bold"
      >
        PDF
      </text>
      {/* Fixed body layout lines */}
      <path
        className="stroke-muted-foreground"
        d="M43 39H76M43 44H76M43 49H62"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      {/* Animated PDF approval / signature seal stamp */}
      <g
        className="motion-safe:animate-stashly-pdf-stamp"
        style={{ transformOrigin: '71px 55px' }}
      >
        <circle
          className="stroke-primary fill-primary"
          fillOpacity="0.35"
          cx="71"
          cy="55"
          r="6.5"
          strokeWidth="1.5"
        />
        <path
          className="stroke-foreground"
          d="M68.5 55L70.3 56.8L73.8 53.3"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>
  )
}

/** strap-lock: Isometric vault parcel strap pulses with seal lock. */
function ArchiveGlyph() {
  return (
    <>
      <path
        className="stroke-border fill-card"
        d="M60 22L84 34V52L60 64L36 52V34L60 22Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="stroke-border"
        d="M36 34L60 46L84 34M60 46V64"
        strokeWidth="1.5"
      />
      <path
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.38"
        d="M48 28L72 40V48L67 51V43L43 31L48 28Z"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </>
  )
}

/** bracket-slide: Angle brackets slide outward from the anchored center slash. */
function CodeGlyph() {
  return (
    <>
      {/* Left angle bracket sliding out from center */}
      <path
        className="stroke-primary fill-primary motion-safe:animate-stashly-bracket-left"
        fillOpacity="0.22"
        d="M46 32L34 42L46 52"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      {/* Right angle bracket sliding out from center */}
      <path
        className="stroke-primary fill-primary motion-safe:animate-stashly-bracket-right"
        fillOpacity="0.22"
        d="M74 32L86 42L74 52"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      {/* Anchored center slash */}
      <path
        className="stroke-foreground"
        d="M64 29L56 55"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </>
  )
}

/** cursor-blink: Terminal prompt underscore blinks in 2-step cadence. */
function ScriptGlyph() {
  return (
    <>
      <path
        className="stroke-primary"
        d="M42 33L54 42L42 51"
        strokeWidth="2.25"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        className="stroke-primary motion-safe:animate-stashly-cursor"
        d="M59 51H76"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
    </>
  )
}

/** bit-flip: Diagonal 01 bit blocks alternate active state. */
function BinariesGlyph() {
  return (
    <>
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.34"
        x="37"
        y="23"
        width="20"
        height="16"
        rx="2"
        strokeWidth="1.25"
      />
      <text
        className="fill-foreground"
        x="47"
        y="34"
        textAnchor="middle"
        fontSize="8"
      >
        01
      </text>
      <rect
        className="stroke-border fill-card"
        x="63"
        y="23"
        width="20"
        height="16"
        rx="2"
        strokeWidth="1.25"
      />
      <text
        className="fill-muted-foreground"
        x="73"
        y="34"
        textAnchor="middle"
        fontSize="8"
      >
        11
      </text>
      <rect
        className="stroke-border fill-card"
        x="37"
        y="45"
        width="20"
        height="16"
        rx="2"
        strokeWidth="1.25"
      />
      <text
        className="fill-muted-foreground"
        x="47"
        y="56"
        textAnchor="middle"
        fontSize="8"
      >
        10
      </text>
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-slot"
        fillOpacity="0.34"
        x="63"
        y="45"
        width="20"
        height="16"
        rx="2"
        style={{ animationDelay: '1.2s' }}
        strokeWidth="1.25"
      />
      <text
        className="fill-foreground"
        x="73"
        y="56"
        textAnchor="middle"
        fontSize="8"
      >
        01
      </text>
    </>
  )
}

/** bezier-nodes: Anchor handles pulse along cubic bezier path. */
function GraphicGlyph() {
  return (
    <>
      <rect
        className="stroke-primary"
        x="38"
        y="26"
        width="44"
        height="32"
        strokeOpacity="0.7"
        strokeWidth="1.25"
      />
      <path
        className="stroke-muted-foreground"
        d="M38 42C38 33 46 26 56 26M82 42C82 51 74 58 64 58"
        strokeWidth="1.5"
      />
      {[
        [35, 23],
        [57, 23],
        [79, 23],
        [35, 39],
        [79, 39],
        [35, 55],
        [57, 55],
        [79, 55],
      ].map(([x, y], idx) => (
        <rect
          className={cn(
            'stroke-card fill-primary',
            (idx === 0 || idx === 7) && 'motion-safe:animate-stashly-float'
          )}
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="6"
          height="6"
          rx="1"
          strokeWidth="1"
        />
      ))}
    </>
  )
}

/** badge-hover: Unclassified token badge hovers inside dashed well. */
function UnknownGlyph() {
  return (
    <>
      <rect
        className="stroke-muted-foreground"
        x="38"
        y="23"
        width="44"
        height="38"
        rx="4"
        strokeWidth="1.25"
        strokeDasharray="3 3"
      />
      <rect
        className="stroke-primary fill-primary motion-safe:animate-stashly-float"
        fillOpacity="0.34"
        x="51"
        y="33"
        width="18"
        height="18"
        rx="4"
        strokeWidth="1.5"
      />
      <text
        className="fill-foreground"
        x="60"
        y="45"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
      >
        ?
      </text>
    </>
  )
}

const GLYPHS: Record<ItemCategory, () => JSX.Element> = {
  video: VideoGlyph,
  audio: AudioGlyph,
  image: ImageGlyph,
  document: DocumentGlyph,
  spreadsheet: SpreadsheetGlyph,
  presentation: PresentationGlyph,
  text: TextGlyph,
  pdf: PdfGlyph,
  archive: ArchiveGlyph,
  code: CodeGlyph,
  script: ScriptGlyph,
  binaries: BinariesGlyph,
  graphic: GraphicGlyph,
  unknown: UnknownGlyph,
}

/**
 * Animated placeholder art for an item with no thumbnail, one drawing per
 * `ItemCategory`. The drawing has no frame or background of its own; the
 * surface behind it comes from whatever holds it. Motion runs only under
 * `prefers-reduced-motion: no-preference` (the `motion-safe:` utilities).
 *
 * @example
 * <ItemCategoryVector category={item.category} />
 */
export function ItemCategoryVector({
  category,
  className,
}: CategoryVectorProps) {
  const Glyph = GLYPHS[category]
  return (
    <svg
      viewBox="0 0 120 84"
      fill="none"
      className={cn('h-21 w-30 shrink-0', className)}
      aria-hidden="true"
    >
      <Glyph />
    </svg>
  )
}
