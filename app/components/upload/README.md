# Upload UI Components

This folder contains the UI components that interact with the Upload machines and the Upload actor manager. The design uses React components, XState actors, and `useSelector` for subscribing to state changes.

Key components and hooks:

- `Upload` — Container that initializes the upload actor configuration via `upload.send({ type: 'upload.config', config })`.
- `DropArea` — Drop zone that accepts files and dispatches `upload.add` events.
- `Trigger` — File input trigger that dispatches local `upload.add` events when files are selected.
- `FileList` — Renders the file list from `useUploadFileIds()`. Memoized and windowed: only the rows in view plus 4 either side are mounted (56 px pitch, spacers for the rest), and rows have no layout animation. Keep it that way: mounting every row of a 650-file upload, with framer-motion's `layout` on each, saturated the main thread for the whole upload (tech-debt item 52).
- `File item subcomponents` — Small memoized presentational components used by `FileList` to display name, size, status, progress indicator.
- `Panel` — A floating uploading panel used to show active uploads and provide quick actions.

Hooks provided:

- `useUploadConfig()` — returns current config and a `setConfig` function.
- `useUploadProgress(id)` — subscribe to progress for a single file.
- `useUploadStatus(id)` — subscribe to status for a single file.
- `useFiles()` and `useUploadFiles()` — return arrays of mediaFiles

Best practices:

- Keep UI components presentational and keep orchestration inside the upload actor (machine). Send events (e.g., `upload.add`, `upload.abort`) from UI actions.
- For testing, mock the XState upload actor or spy on `upload.send` to assert UI triggers correct events.

Files to explore:

- `app/components/upload/index.tsx`
- `app/machines/upload/upload.machine.ts`
- `app/machines/reviset/file.machine.ts` — the active per-file actor (`upload.machine.ts` imports it from here; the `upload/file.machine.ts` sibling is unused)
- `app/components/upload` (component folder)

Potential improvements:

- Example stories or storybook integration can help illustrate state transitions and UI states.
- Add clearer docs on the expected format for `Config` and `User` passed to `Upload`.
