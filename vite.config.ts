import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Serves api/chat.ts during local development, the same handler Vercel runs in production.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const mod = (await server.ssrLoadModule('/api/chat.ts')) as { handleChat: (r: Request) => Promise<Response> }
        const request = new Request(`http://localhost${req.url ?? ''}`, {
          method: req.method,
          headers: { 'content-type': String(req.headers['content-type'] ?? 'application/json') },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        })
        const response = await mod.handleChat(request)
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        if (!response.body) return res.end()
        const reader = response.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: {
    // three.js is split into its own lazy chunk (~150 kB gzip); that is expected.
    chunkSizeWarningLimit: 700,
  },
})
