import { Cover } from './cover'
import { folderPathRight } from './folder-shape'
import { useLift } from './use-lift'
import type { FolderCardProps } from './types'

const MUT = '#8a8a82'
const INK = '#141414'
const MONO = "'JetBrains Mono', ui-monospace, monospace"

/**
 * Variant A — Poster. 16:9 light card. Raised folder tab on the RIGHT holds
 * the cover image; concave notch top-left; text column on the left.
 */
export function FolderCardPoster({ folder, onOpen }: FolderCardProps) {
  const [hover, lift] = useLift()
  const W = 480, H = 270, tabL = 246, bodyT = 40
  return (
    <button
      onClick={() => onOpen?.(folder)}
      {...lift}
      style={{
        all: 'unset', cursor: 'pointer', display: 'block', width: '100%', aspectRatio: '16/9', position: 'relative',
        boxShadow: hover ? '0 22px 50px -20px rgba(20,20,20,.4)' : '0 10px 30px -18px rgba(20,20,20,.3)',
        transform: hover ? 'translateY(-3px)' : 'none', borderRadius: 24,
        transition: 'transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <path d={folderPathRight(W, H, tabL, bodyT)} fill="#ffffff" />
        </svg>
        <div style={{ position: 'absolute', left: `${((tabL + 18) / W) * 100}%`, top: '4.5%', right: '2.7%', bottom: '4.5%', borderRadius: 16, overflow: 'hidden' }}>
          <Cover folder={folder} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: '3.8%', width: `${((tabL - 46) / W) * 100}%`, top: `${(bodyT / H) * 100}%`, bottom: '8%', display: 'flex', flexDirection: 'column', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: INK }}>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: MUT }}>{folder.kind}</span>
        </div>
        <h3 style={{ margin: 0, fontSize: 26, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-.02em', color: INK, textWrap: 'balance' }}>{folder.name}</h3>
        <p style={{ margin: '10px 0 0', fontFamily: MONO, fontSize: 11, lineHeight: 1.55, color: MUT }}>
          {folder.childCount.toLocaleString()} items · {folder.inclusiveSize}
        </p>
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUT }}>updated {folder.updatedAt}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Open →</span>
        </div>
      </div>
    </button>
  )
}
