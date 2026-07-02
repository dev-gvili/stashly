import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { createServer } from 'node:http'

// Short-circuit the type-checking of the built output.
const BUILD_PATH = './build/server/index.js'
const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '80')

const app = express()

app.disable('x-powered-by')

// Share one HTTP server for both the app and Vite's HMR WebSocket. Serving HMR
// over the same port the page is served from means the HMR client connects to
// the page's own host/port (works through tunnels like ngrok on 443 and plain
// localhost alike) instead of a separate port a tunnel can't forward.
const httpServer = createServer(app)

if (DEVELOPMENT) {
  const viteDevServer = await import('vite').then((vite) =>
    vite.createServer({
      server: { middlewareMode: true, ws: { server: httpServer } },
    })
  )
  app.use(viteDevServer.middlewares)
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule('./server/app.ts')
      return await source.app(req, res, next)
    } catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error)
      }
      next(error)
    }
  })
} else {
  // Compress responses in production only. In dev, Vite serves hundreds of
  // uncached module/data responses per navigation; brotli-compressing each one
  // is CPU-heavy and slows first load, post-navigation data, and HMR reloads
  // (and leaks `drain` listeners on BrotliCompress under concurrent streams).
  app.use(compression())
  app.use(
    '/assets',
    express.static('build/client/assets', { immutable: true, maxAge: '1y' })
  )
  app.use(morgan('tiny'))
  app.use(express.static('build/client', { maxAge: '1h' }))
  app.use(await import(BUILD_PATH).then((mod) => mod.app))
}

httpServer.listen(PORT, () => console.log("Stashly App Started :)"))
