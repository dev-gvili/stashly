import { defineConfig, loadEnv, type PluginOption } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { reactRouter } from '@react-router/dev/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgr from 'vite-plugin-svgr'
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

function copyDirRecursive(src: string, dest: string) {
  const entries = readdirSync(src)
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const stat = statSync(srcPath)
    
    if (stat.isDirectory()) {
      mkdirSync(destPath, { recursive: true })
      copyDirRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function copyPdfjsAssets() {
  const publicDir = resolve('public')
  const pdfjsDist = resolve('node_modules/pdfjs-dist')
  
  // Copy cmaps
  const cmapsSrc = join(pdfjsDist, 'cmaps')
  const cmapsDest = join(publicDir, 'pdfjs-cmaps')
  try {
    mkdirSync(cmapsDest, { recursive: true })
    copyDirRecursive(cmapsSrc, cmapsDest)
    console.log('✓ Copied PDF.js CMaps to public directory')
  } catch (err) {
    console.warn('Failed to copy PDF.js cmaps:', err)
  }
  
  // Copy standard fonts
  const fontsSrc = join(pdfjsDist, 'standard_fonts')
  const fontsDest = join(publicDir, 'pdfjs-standard-fonts')
  try {
    mkdirSync(fontsDest, { recursive: true })
    copyDirRecursive(fontsSrc, fontsDest)
    console.log('✓ Copied PDF.js standard fonts to public directory')
  } catch (err) {
    console.warn('Failed to copy PDF.js standard fonts:', err)
  }
}

export default defineConfig(({ isSsrBuild, mode }) => ({
  define: {
    env: JSON.stringify(loadEnv(mode, process.cwd(), '')),
  },
  server: {
    cors: true,
    allowedHosts: [
      '*',
      // '604feeed9b06.ngrok-free.app',
      // 'stashly.onrender.com',
      'localhost:3000',
    ],
    hmr: {
      port: Number(process.env.VITE_HMR_PORT || process.env.HMR_PORT || 24678),
    },
  },
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: './server/app.ts',
        }
      : undefined,
  },
  optimizeDeps: {
    exclude: [
      '@huggingface/transformers',
      '@huggingface/transformers-next4.0.1',
      'onnxruntime-web',
    ],
  },
  plugins: [
    svgr(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    // Copy PDF.js assets to public directory
    {
      name: 'copy-pdfjs-assets',
      configureServer() {
        // Copy assets during dev server startup
        copyPdfjsAssets()
      },
      buildStart() {
        // Copy assets during build
        copyPdfjsAssets()
      }
    }
  ] as unknown as PluginOption[],
}))
