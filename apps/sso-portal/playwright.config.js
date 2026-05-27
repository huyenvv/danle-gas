const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile',  use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev:sso',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    cwd: '/Users/vanhuyen.vu/Documents/Vuhu/Projects/Appscripts',
  },
})
