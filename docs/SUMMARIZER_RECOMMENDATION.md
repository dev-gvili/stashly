Summarizer recommendation
------------------------

Short recommendation

- Default model: `facebook/bart-large-cnn` — higher-quality default; use this as the server default (accepts higher latency and chunking).
- Higher-quality option: `facebook/bart-large-cnn` — produces slightly more fluent/concise summaries but is slower and may hit provider tokenization/length errors on very long inputs. Use when quality matters and you can chunk inputs.
- Long-context option: LED / LongT5 variants (e.g., `allenai/led-base-16384`, `google/long-t5`) — choose these only if your configured inference providers host them; they handle very long documents more directly.

Integration notes

- The repo now exposes a simple server endpoint:

  POST /api/summarize

  JSON body: { text: string, model?: string, chunkSize?: number, overlap?: number }

  Response: { ok: true, finalSummary, chunkSummaries, modelUsed }

- Default behavior and parameters are controlled by environment variables:
  - `HF_TOKEN` — required (Hugging Face inference access token)
  - `SUMMARIZER_MODEL` — default summarization model (defaults to `sshleifer/distilbart-cnn-12-6`)
  - `SUMMARIZER_CHUNK_SIZE` — chunk size (chars) for long inputs (default 4000)
  - `SUMMARIZER_OVERLAP` — chunk overlap (chars) for long inputs (default 200)

Quick curl example

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"Long transcript text..."}'
```

Recommendation summary

- Use `sshleifer/distilbart-cnn-12-6` as the app default for transcript summarization (fast, reliable). If you need higher quality and can accept higher latency and chunking, switch to `facebook/bart-large-cnn` by setting `SUMMARIZER_MODEL`.
