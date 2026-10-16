import { Provider } from '@angular/core';
import { APP_CONFIG, AppConfig } from '../app/core/config/app-config';

export const TEST_APP_CONFIG: AppConfig = {
	apiBaseUrl: '/api',
	useMockApi: true,
	maxApplicants: 4,
	termsVersion: 'test-terms',
	applicationId: 1
};

export function provideTestAppConfig(overrides: Partial<AppConfig> = {}): Provider {
	return { provide: APP_CONFIG, useValue: { ...TEST_APP_CONFIG, ...overrides } };
}
