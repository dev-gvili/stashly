// Folder-with-tab silhouettes rendered as SVG paths.

/** Tab on the LEFT (Variant B): tab top-left, body fills below, notch on the right of the tab. */
export function folderPathLeft(W: number, H: number, tabT: number, tabR: number, bodyT: number, r = 14, f = 15, R = 24): string {
  return [
    `M 0 ${tabT + r}`, `Q 0 ${tabT} ${r} ${tabT}`,
    `L ${tabR - r} ${tabT}`, `Q ${tabR} ${tabT} ${tabR} ${tabT + r}`,
    `L ${tabR} ${bodyT - f}`, `Q ${tabR} ${bodyT} ${tabR + f} ${bodyT}`,
    `L ${W - R} ${bodyT}`, `Q ${W} ${bodyT} ${W} ${bodyT + R}`,
    `L ${W} ${H}`, `L 0 ${H}`, 'Z',
  ].join(' ')
}

/** Tab on the RIGHT (Variant A / A2): raised tab holds the cover, concave notch top-left. */
export function folderPathRight(W: number, H: number, tabL: number, bodyT: number, r = 16, f = 14, R = 20): string {
  return [
    `M 0 ${bodyT + R}`, `Q 0 ${bodyT} ${R} ${bodyT}`,
    `L ${tabL - f} ${bodyT}`, `Q ${tabL} ${bodyT} ${tabL} ${bodyT - f}`,
    `L ${tabL} ${r}`, `Q ${tabL} 0 ${tabL + r} 0`,
    `L ${W} 0`, `L ${W} ${H}`, `L 0 ${H}`, 'Z',
  ].join(' ')
}
