import { copyFile, mkdir } from 'node:fs/promises'

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await copyFile(new URL('../sites/worker.js', import.meta.url), new URL('../dist/server/index.js', import.meta.url))
// Cloudflare Pages SPA fallback: a `_worker.js` at the output root is picked
// up automatically and routes unknown paths to index.html via env.ASSETS.
await copyFile(new URL('../sites/worker.js', import.meta.url), new URL('../dist/_worker.js', import.meta.url))
