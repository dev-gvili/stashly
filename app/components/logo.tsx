import type { SVGProps } from 'react'

/** The cube mark: the frame takes `currentColor`, the inner cube the primary colour. */
export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 280 318">
    <path
      fill="currentColor"
      d="M8 81L140 5L272 81L244 97L140 37L36 97ZM56 105L140 57L224 105L197.6 120.2L140 87L82.4 120.2ZM5 89L32 104.6L32 226.6L111 272.2L111 222L133 234.7L133 312.9L5 239ZM51 117L75 130.9L75 201L98 214.3L98 242.1L51 215ZM229 117L205 130.9L205 156L229 142.1ZM275 89L248 104.6L248 132L275 116.4ZM147 164L187 140.9L209 168L275 131L275 239L147 312.9Z"
    />
    <path className="fill-primary" d="M141 106L102 129L141 152L180 129ZM93 141L135 165.2L135 216L93 191.8Z" />
  </svg>
)
