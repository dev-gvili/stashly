# Upload UI Components

This folder contains the UI components that interact with the Upload machines and the Upload actor manager. The design uses React components, XState actors, and `useSelector` for subscribing to state changes.

Key components and hooks:

- `Upload` — Container that initializes the upload actor configuration via `upload.send({ type: 'upload.config', config })`.
- `DropArea` — Drop zone that accepts files and dispatches `upload.add` events.
- `Trigger` — File input trigger that dispatches local `upload.add` events when files are selected.
- `FileList` — Renders file list using `useFiles()` or `useUploadFiles()` hooks.
- `File item subcomponents` — Small presentational components used by `FileList` to display name, size, status, progress indicator.
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
- `app/machines/upload/file.machine.ts`
- `app/components/upload` (component folder)

Potential improvements:

- Example stories or storybook integration can help illustrate state transitions and UI states.
- Add clearer docs on the expected format for `Config` and `User` passed to `Upload`.
