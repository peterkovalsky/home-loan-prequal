import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 4300);
// E2E_CONFIGURATION=local-api runs the same journeys against the real .NET API (Phase 2).
const configuration = process.env['E2E_CONFIGURATION'] ?? 'development';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		baseURL: `http://localhost:${port}`,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npx ng serve --configuration ${configuration} --port ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env['CI'],
		timeout: 120_000
	}
});
