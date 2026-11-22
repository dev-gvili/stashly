/**
 * The AI & privacy switches as this tab knows them: whether each in-browser
 * pipeline may run on new uploads. Seeded from the layout loader on load and
 * updated by Settings → AI & privacy when a switch saves, so the indexing
 * queue reads it synchronously when it decides what to queue.
 *
 * Only `index` gates a pipeline today (scanned-PDF OCR in
 * `indexing-queue.machine.ts`). Uploads run no Whisper or captioning yet, so
 * `transcribe` and `caption` are stored for when they do.
 */
export interface AiGates {
  transcribe: boolean
  caption: boolean
  index: boolean
}

let gates: AiGates = { transcribe: true, caption: true, index: true }

export function getAiGates(): Readonly<AiGates> {
  return gates
}

export function setAiGates(next: Partial<AiGates>): void {
  gates = { ...gates, ...next }
}
