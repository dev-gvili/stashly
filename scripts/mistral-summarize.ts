#!/usr/bin/env tsx
/**
 * Offline Mistral-7B ONNX summarization script (TypeScript wrapper)
 * Uses microsoft/mistral-7b-instruct-v0.2-ONNX via Python backend
 * 
 * Usage: tsx scripts/mistral-summarize.ts <text_to_summarize>
 *
 * Requires: pip install transformers torch optimum onnxruntime
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface SummaryResult {
  summary?: string
  error?: string
}

/**
 * Summarize text using Mistral-7B ONNX via Python script
 */
async function summarizeWithMistralONNX(text: string): Promise<SummaryResult> {
  try {
    const command = `python scripts/mistral_summarize.py ${JSON.stringify(text)}`

    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 120000, // 2 minute timeout for inference
    })

    return JSON.parse(stdout)
  } catch (err) {
    console.error('ONNX summarization error:', err)
    throw err
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: tsx mistral-summarize.ts <text>')
    process.exit(1)
  }

  const [text] = args

  const result = await summarizeWithMistralONNX(text)

  if (result.error) {
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
