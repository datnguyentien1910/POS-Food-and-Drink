import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// The frontend test suite is the root project. Backend tests live in
// `server/` and run through `server/vitest.config.ts`; without this
// exclusion root `npm test` would discover them and stop being 113/113.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [
        'server/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      ],
    },
  }),
)
