import 'react-router'
import { createRequestHandler } from '@react-router/express'
import express from 'express'

declare module 'react-router' {
  interface AppLoadContext {}
}

export const app = express()

app.use(
  createRequestHandler({
    build: () => import('virtual:react-router/server-build'),

    // use to pass custom data / functions via route context
    // getLoadContext() {
    // },
  })
)
