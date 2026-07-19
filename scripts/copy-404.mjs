import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// GitHub Pages serves 404.html for any unknown path. Since this app uses
// BrowserRouter with real paths (e.g. /admin/roster/:id), a deep link or
// refresh on those paths would otherwise 404 instead of reaching the SPA.
// Serving the same index.html as the 404 page lets BrowserRouter take over
// once it loads.
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'))
