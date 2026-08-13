import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// slidev dev mode fails to resolve relative asset imports (<img src="./figures/...">)
// from the virtual slide modules (slides-zh.md__slidev_N.md); build mode resolves them
// fine. Resolve them against the talk root explicitly so `npm run dev` works.
// The entry is matched loosely because this project has two entries, zh and en.
export default defineConfig({
  plugins: [
    {
      name: 'resolve-relative-assets-from-virtual-slides',
      resolveId(id, importer) {
        if (id.startsWith('./') && importer && importer.includes('.md__slidev'))
          return resolve(__dirname, id)
      },
    },
  ],
})
