import { render } from '@react-email/render'
import React, { type JSX } from 'react'

export type Awaitable<T> = T | PromiseLike<T>

export type Success<TData = unknown> = {
  ok: true
  data: TData
  status: number
}

export type Failur = {
  ok: false
  error: Error
  status: number
}

export type TemplateParams<T extends React.ElementType> =
  React.ComponentPropsWithoutRef<T>

/**
 * Client configuration object for using 3th party email service.
 */
export interface ClientConfig {
  /**
   * The email service endpoint that we use for sending the email
   */
  url: Required<string>
  /**
   * The access / api token you get from your email service, this token will be used when sending emails.
   */
  token: Required<string>
}

export interface SendFunctionArgs {
  /**
   * Customer / Customers email address
   */
  to: Required<string | string[]>
  /**
   * The sender email address <Usually your company email>
   */
  from: Required<string>
  /**
   * Email subject, what the email is all about
   * this is what going to show as preview in the client message list
   */
  subject: Required<string>
  /**
   * Email body you can send string or JSX.Element
   * If you send JSX.Element under the hood we parse as HTML string
   */
  content?: string | JSX.Element
}

/**
 * Simple client for sending emails, using 3th party email services rest enapoint
 */
export interface EmailClient {
  (config: ClientConfig): {
    /**
     * Send email function
     */
    send<TData = unknown>(
      args: SendFunctionArgs
    ): Awaitable<Success<TData> | Failur>
  }
}

export const createEmailClient: EmailClient = (config) => ({
  async send<TData>(args: SendFunctionArgs) {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        ...args,
        html: parseContent(args.content),
      }),
    })
    if (response.ok) {
      const data: TData = await response.json()
      return { ok: true, data, status: response.status }
    }
    const data = await response.json()
    return { ok: false, error: data, status: response.status }
  },
})

export function parseContent(content: SendFunctionArgs['content']) {
  return content && typeof content !== 'string'
    ? render(content, { pretty: true })
    : content
}

export const email = createEmailClient({
  url: process.env.EMAIL_SERVICE_URL!,
  token: process.env.EMAIL_SERVICE_TOKEN!,
})
