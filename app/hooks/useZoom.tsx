import * as React from 'react';

/**
 * Provides pan-and-zoom state and event handlers for a media element.
 *
 * Scale is clamped to [1, 5]. Translation is reset to (0, 0) whenever scale
 * returns to 1 so the element re-centers automatically.
 *
 * Apply `scale` and `tx`/`ty` as a CSS transform, then spread the returned
 * event handlers onto the container element:
 *
 * @example
 * ```tsx
 * function ImageViewer({ src }: { src: string }) {
 *   const zoom = useZoom();
 *   return (
 *     <div
 *       style={{ overflow: 'hidden', cursor: zoom.scale > 1 ? 'grab' : 'default' }}
 *       onWheel={zoom.onWheel}
 *       onMouseDown={zoom.onMouseDown}
 *       onMouseMove={zoom.onMouseMove}
 *       onMouseUp={zoom.onMouseUp}
 *     >
 *       <img
 *         src={src}
 *         style={{
 *           transform: `scale(${zoom.scale}) translate(${zoom.tx}px, ${zoom.ty}px)`,
 *           transformOrigin: 'center',
 *         }}
 *       />
 *       <button onClick={zoom.zoomIn}>+</button>
 *       <button onClick={zoom.zoomOut}>−</button>
 *       <button onClick={zoom.reset}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * // Zoom controls in a media toolbar — `zoomIn`/`zoomOut` step by 0.5
 * const zoom = useZoom();
 * <Toolbar>
 *   <IconButton icon={ZoomOut} onClick={zoom.zoomOut} disabled={zoom.scale === 1} />
 *   <span>{Math.round(zoom.scale * 100)}%</span>
 *   <IconButton icon={ZoomIn} onClick={zoom.zoomIn} disabled={zoom.scale === 5} />
 * </Toolbar>
 *
 * @example
 * // Reset the view whenever the previewed file changes
 * const zoom = useZoom();
 * React.useEffect(() => zoom.reset(), [fileId]);
 */
export function useZoom() {
  const [scale, setScale] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  const drag = React.useRef<{ x: number; y: number; } | null>(null);

  const reset = React.useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const zoomTo = React.useCallback((next: number) => {
    const s = Math.min(5, Math.max(1, next));
    setScale(s);
    if (s === 1) {
      setTx(0);
      setTy(0);
    }
  }, []);

  return {
    scale,
    tx,
    ty,
    reset,
    zoomIn: () => zoomTo(scale + 0.5),
    zoomOut: () => zoomTo(scale - 0.5),
    onWheel: (e: React.WheelEvent) => {
      e.preventDefault();
      zoomTo(scale - e.deltaY * 0.01);
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (scale === 1) return;
      drag.current = { x: e.clientX - tx, y: e.clientY - ty };
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!drag.current) return;
      setTx(e.clientX - drag.current.x);
      setTy(e.clientY - drag.current.y);
    },
    onMouseUp: () => {
      drag.current = null;
    },
  };
}
