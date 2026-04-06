import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@wangliang139/klinecharts-pro': path.join(repoRoot, 'src/index.ts'),
    },
    dedupe: ['solid-js'],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
})
