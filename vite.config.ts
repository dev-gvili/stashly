import { defineConfig, loadEnv, type PluginOption } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { reactRouter } from '@react-router/dev/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgr from 'vite-plugin-svgr'
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
  ] as unknown as PluginOption[],
}))
