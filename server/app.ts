import 'react-router'
import '@/services/vinktar'
import { createRequestHandler } from '@react-router/express'
import { vinktarErrors, vinktarRequest } from '@vinktarhq/node/express'
import express from 'express'
import { ensureSizeRollup } from '@/services/size-rollup'

export const app = express()

// Apply size deltas a stopped process left pending (a crash or a deploy)
// without waiting for the next upload to start the loop.
ensureSizeRollup()

// First: one Vinktar scope per request, adopting the browser visit's device
// and session headers, so server events and errors join that visit.
app.use(vinktarRequest())

app.use(
  createRequestHandler({
    build: () => import('virtual:react-router/server-build'),
  })
)

// Last: reports an error the handler passes on, then hands it to Express.
app.use(vinktarErrors())
