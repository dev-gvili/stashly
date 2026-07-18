import type { FolderCardData } from './types'

/** Cover image with gradient fallback. Fills its positioned parent. */
export function Cover({ folder }: { folder: FolderCardData }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: folder.fallback }}>
      {folder.cover && (
        <img
          src={folder.cover}
          alt=""
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
    </div>
  )
}
