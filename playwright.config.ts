import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — testes E2E rodam contra o `vite preview` (build de produção)
 * para garantir que o que vai pro ar funciona, não apenas o dev server.
 *
 * Pra rodar:
 *   npm run build && npm run e2e        (build + roda)
 *   npm run e2e:ui                       (UI interativa)
 *   npx playwright test --headed         (vê o browser)
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // mobile pra validar swipe-to-dismiss e responsividade
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  // Sobe o build E2E + preview automaticamente. O build E2E (`--mode test`)
  // usa `.env.test` com Supabase fake — getSession falha graciosamente e
  // route guards funcionam normal pra testes públicos.
  webServer: {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
