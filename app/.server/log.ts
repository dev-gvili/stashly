import { randomUUID } from 'node:crypto'
import type { MiddlewareFunction } from 'react-router'
import {
  addBreadcrumb,
  captureException,
  captureMessage,
  scope,
} from '@/services/vinktar'

/**
 * The server's logger. Each line goes to three places:
 *
 * 1. **stdout**, as one JSON object per line, with every field. This is the
 *    complete stream, which Fly's log shipping keeps. In development it prints
 *    as readable text instead.
 * 2. **A Vinktar breadcrumb** on the current request's scope, so an error
 *    captured later in the same request carries the lines that led to it.
 * 3. **A Vinktar issue**, for `warn` and `error` only: an `error` field that is
 *    an `Error` is captured as that exception (its own stack), anything else
 *    as a message.
 *
 * Write the message as fixed text and put identifiers in `fields`, so lines
 * group and search well. Fields in {@link PRIVATE_FIELDS} reach stdout only:
 * S3 keys and file names are user content, which never leaves for Vinktar.
 *
 * @example
 * log.error('S3 objects left behind', { bucket, count: failed.length, error })
 */
export const log = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

/** Field names kept out of everything sent to Vinktar. */
export const PRIVATE_FIELDS = new Set([
  'key',
  'keys',
  'bucket',
  'name',
  'path',
  'email',
  'query',
  'where',
])

/** The scope tag that ties a request's log lines to its Vinktar events. */
const REQUEST_ID_TAG = 'request_id'

/**
 * Tags the request's Vinktar scope with a request id: Fly's `Fly-Request-Id`
 * when the proxy sent one, otherwise a fresh one. Every log line and every
 * error from the request then carries it, so a Vinktar issue leads to its
 * lines in the Fly logs and back.
 */
export const requestIdMiddleware: MiddlewareFunction<Response> = async (
  { request },
  next
) => {
  scope().setTag(
    REQUEST_ID_TAG,
    request.headers.get('fly-request-id') ?? randomUUID().slice(0, 8)
  )
  return next()
}

/**
 * One line as stdout gets it: level, time, message, the request id when there
 * is one, then the fields. An `Error` becomes its name, message and stack,
 * which `JSON.stringify` would otherwise write as `{}`.
 */
export function formatLine(
  level: LogLevel,
  message: string,
  fields: LogFields = {},
  requestId?: string,
  time = new Date()
): string {
  return JSON.stringify({
    level,
    time: time.toISOString(),
    msg: message,
    ...(requestId ? { request_id: requestId } : {}),
    ...serialize(fields),
  })
}

/** `fields` without the private ones and with errors flattened, for Vinktar. */
export function publicFields(fields: LogFields = {}): LogFields {
  return serialize(
    Object.fromEntries(
      Object.entries(fields).filter(([key]) => !PRIVATE_FIELDS.has(key))
    )
  )
}

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  const requestId = scope().tags[REQUEST_ID_TAG]

  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(formatLine(level, message, fields, requestId) + '\n')
  } else {
    const print = level === 'debug' ? console.debug : console[level]
    print(`[${level}] ${message}`, Object.keys(fields).length ? fields : '')
  }

  const context = publicFields(fields)
  addBreadcrumb({
    category: 'log',
    message,
    level: level === 'warn' ? 'warning' : level,
    data: context,
  })

  if (level === 'warn' || level === 'error') {
    const hint = { level: level === 'warn' ? 'warning' : 'error', context } as const
    if (fields.error instanceof Error) captureException(fields.error, hint)
    else captureMessage(message, hint)
  }
}

function serialize(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
    ])
  )
}
