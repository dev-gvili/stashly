import * as React from 'react';
import { IconUpload } from '../options/option-a/layout';

export function DropZoneOverlay({ visible }: { visible: boolean; }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/50 animate-fade-in z-50">
      <div className="text-center">
        <IconUpload className="w-12 h-12 mx-auto mb-3 text-accent" />
        <div className="text-xl font-bold">Drop Files</div>
        <div className="text-xs font-mono text-muted-foreground mt-1">Release to upload</div>
      </div>
    </div>
  );
}
