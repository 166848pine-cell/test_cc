import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 縦積みレイアウト前提のケースはPCでは実行しない
      grepInvert: /@mobileonly/,
    },
    {
      // テスト計画どおり chromium + モバイルビューポート(375x667)で実行する
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
      grep: /@mobile/,
    },
  ],
  // 本番と同じビルド成果物に対してテストする(dev serverだと配信内容がずれることがある)。
  // 既定のビルドは一般公開用でルート計算を持たないため、テストでは有効にした成果物を使う。
  webServer: {
    command:
      'npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
