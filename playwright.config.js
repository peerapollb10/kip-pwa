// Mobile-viewport UI checks. Screenshots land in e2e/screenshots/ for manual review.
// Runs against the Vite dev server with placeholder Supabase env — Guest Mode needs no backend.
// Set E2E_BASE_URL to test a deployed Vercel URL instead.
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx vite --port 5173 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        env: {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'e2e-placeholder-anon-key',
        },
      },
});
