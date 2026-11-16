import type { ItemCategory } from '@/prisma/enums'
import { cn } from '@/utils/styles'

export type { ItemCategory }

interface CategoryFallbackProps {
  category: ItemCategory
  className?: string
}

/**
 * Animated placeholder art for an item with no thumbnail, one drawing per
 * `ItemCategory`. The drawing has no frame or background of its own; the
 * surface behind it comes from whatever holds it.
 *
 * @example
 * <ItemCategoryVector category={item.category} />
 */
export function ItemCategoryVector({
  category,
  className,
}: CategoryFallbackProps) {
  return (
    <svg
      viewBox="0 0 120 84"
      fill="none"
      className={cn('h-21 w-30 shrink-0', className)}
      aria-hidden="true"
    >
      {category === 'video' && (
        <>
          <rect
            x="28"
            y="22"
            width="64"
            height="40"
            rx="4"
            className="fill-card stroke-input"
            strokeWidth="1.5"
          />
          <path
            d="M55 34L70 42L55 50V34Z"
            className="animate-stashly-float fill-primary/25 stroke-primary"
            style={{ animation: 'stashly-float-pip 2.8s ease-in-out infinite' }}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </>
      )}

      {category === 'audio' && (
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
              key={bar.x}
              x={bar.x - 1.5}
              y={bar.y1}
              width="3"
              height={bar.y2 - bar.y1}
              rx="1"
              style={{
                transformOrigin: `${bar.x}px 42px`,
                animation: `stashly-equalizer 1.8s ease-in-out ${bar.delay} infinite`,
              }}
              className={cn(
                'animate-stashly-eq',
                bar.active
                  ? 'fill-primary/35 stroke-primary'
                  : 'fill-card stroke-muted-foreground'
              )}
              strokeWidth="1.25"
            />
          ))}
        </>
      )}

      {category === 'image' && (
        <>
          <rect
            x="26"
            y="24"
            width="64"
            height="38"
            rx="4"
            className="fill-card stroke-input"
            strokeWidth="1.5"
          />
          <path
            d="M27 56L45 41L59 51L71 43L89 56"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle
            cx="75"
            cy="34"
            r="3.5"
            className="fill-primary/25 stroke-primary"
            strokeWidth="1.25"
          />
          <circle
            cx="90"
            cy="24"
            r="5"
            style={{ animation: 'stashly-float-pip 2.6s ease-in-out infinite' }}
            className="animate-stashly-float fill-primary stroke-card"
            strokeWidth="1.5"
          />
        </>
      )}

      {category === 'document' && (
        <>
          <path
            d="M40 20H70L80 30V64H40V20Z"
            className="fill-card stroke-input"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M70 20V30H80L70 20Z"
            className="fill-primary/30 stroke-primary"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M47 36H72M47 42H73M47 48H73M47 54H65"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </>
      )}

      {category === 'spreadsheet' && (
        <>
          <rect
            x="30"
            y="22"
            width="60"
            height="40"
            rx="3"
            className="fill-card stroke-input"
            strokeWidth="1.5"
          />
          <path
            d="M50 22V62M70 22V62M30 35H90M30 49H90"
            className="stroke-input"
            strokeWidth="1.25"
          />
          <rect
            x="51"
            y="23"
            width="18"
            height="11"
            style={{
              animation: 'stashly-pulse-slot 2.4s ease-in-out infinite',
            }}
            className="animate-stashly-slot fill-primary/35 stroke-primary"
            strokeWidth="1"
          />
        </>
      )}

      {category === 'presentation' && (
        <>
          <rect
            x="28"
            y="24"
            width="64"
            height="36"
            rx="4"
            className="fill-card stroke-input"
            strokeWidth="1.5"
          />
          <rect
            x="38"
            y="31"
            width="28"
            height="22"
            rx="2"
            style={{ animation: 'stashly-float-pip 3s ease-in-out infinite' }}
            className="animate-stashly-float fill-primary/30 stroke-primary"
            strokeWidth="1.5"
          />
          <rect
            x="56"
            y="36"
            width="24"
            height="14"
            rx="1.5"
            className="fill-primary/15 stroke-primary/60"
            strokeWidth="1"
          />
        </>
      )}

      {category === 'text' && (
        <>
          <path
            d="M32 25H54M32 32H84M32 39H78M32 46H66M32 53H82M32 60H70"
            className="stroke-muted-foreground"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <path
            d="M32 32H84"
            style={{
              animation: 'stashly-pulse-slot 2.2s ease-in-out infinite',
            }}
            className="animate-stashly-slot stroke-primary"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </>
      )}

      {category === 'pdf' && (
        <>
          <rect
            x="38"
            y="20"
            width="44"
            height="44"
            rx="3"
            className="fill-card stroke-input"
            strokeWidth="1.5"
          />
          <path d="M43 20V64" className="stroke-input" strokeWidth="1.25" />
          <rect
            x="47"
            y="25"
            width="30"
            height="7"
            rx="1.5"
            className="fill-primary/30 stroke-primary"
            strokeWidth="1.25"
          />
        </>
      )}

      {category === 'archive' && (
        <>
          <path
            d="M60 22L84 34V52L60 64L36 52V34L60 22Z"
            className="fill-card stroke-input"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M36 34L60 46L84 34M60 46V64"
            className="stroke-input"
            strokeWidth="1.5"
          />
          <path
            d="M48 28L72 40V48L67 51V43L43 31L48 28Z"
            style={{
              animation: 'stashly-pulse-slot 2.6s ease-in-out infinite',
            }}
            className="animate-stashly-slot fill-primary/35 stroke-primary"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </>
      )}

      {category === 'code' && (
        <>
          <path
            d="M46 32L34 42L46 52M74 32L86 42L74 52"
            className="fill-primary/20 stroke-primary"
            strokeWidth="1.75"
            strokeLinecap="square"
            strokeLinejoin="round"
          />
          <path
            d="M64 29L56 55"
            style={{ animation: 'stashly-float-pip 2.8s ease-in-out infinite' }}
            className="animate-stashly-float stroke-foreground"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </>
      )}

      {category === 'script' && (
        <>
          <path
            d="M42 33L54 42L42 51"
            className="stroke-primary"
            strokeWidth="2.25"
            strokeLinecap="square"
            strokeLinejoin="round"
          />
          <path
            d="M59 51H76"
            style={{
              animation: 'stashly-blink-cursor 1.2s steps(2, start) infinite',
            }}
            className="animate-stashly-cursor stroke-primary"
            strokeWidth="2.25"
            strokeLinecap="square"
          />
        </>
      )}

      {category === 'binaries' && (
        <>
          <rect
            x="37"
            y="23"
            width="20"
            height="16"
            rx="2"
            style={{
              animation: 'stashly-pulse-slot 2.4s ease-in-out infinite',
            }}
            className="animate-stashly-slot fill-primary/30 stroke-primary"
            strokeWidth="1.25"
          />
          <rect
            x="63"
            y="23"
            width="20"
            height="16"
            rx="2"
            className="fill-card stroke-input"
            strokeWidth="1.25"
          />
          <rect
            x="37"
            y="45"
            width="20"
            height="16"
            rx="2"
            className="fill-card stroke-input"
            strokeWidth="1.25"
          />
          <rect
            x="63"
            y="45"
            width="20"
            height="16"
            rx="2"
            style={{
              animation: 'stashly-pulse-slot 2.4s ease-in-out 1.2s infinite',
            }}
            className="animate-stashly-slot fill-primary/30 stroke-primary"
            strokeWidth="1.25"
          />
        </>
      )}

      {category === 'graphic' && (
        <>
          <rect
            x="38"
            y="26"
            width="44"
            height="32"
            className="stroke-primary/70"
            strokeWidth="1.25"
          />
          <path
            d="M38 42C38 33 46 26 56 26M82 42C82 51 74 58 64 58"
            className="stroke-muted-foreground"
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
          ].map(([x, y], idx) => {
            const floats = idx === 0 || idx === 7
            return (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="6"
                height="6"
                rx="1"
                style={
                  floats
                    ? {
                        animation:
                          'stashly-float-pip 2.4s ease-in-out infinite',
                      }
                    : undefined
                }
                className={cn(
                  'fill-primary stroke-card',
                  floats && 'animate-stashly-float'
                )}
                strokeWidth="1"
              />
            )
          })}
        </>
      )}

      {category === 'unknown' && (
        <>
          <rect
            x="38"
            y="23"
            width="44"
            height="38"
            rx="4"
            className="stroke-muted-foreground"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
          <rect
            x="51"
            y="33"
            width="18"
            height="18"
            rx="4"
            style={{ animation: 'stashly-float-pip 2.8s ease-in-out infinite' }}
            className="animate-stashly-float fill-primary/30 stroke-primary"
            strokeWidth="1.5"
          />
          <circle cx="60" cy="42" r="2" className="fill-primary" />
        </>
      )}
    </svg>
  )
}
