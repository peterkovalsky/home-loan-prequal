import { parseAppConfig } from './app-config';

describe('parseAppConfig', () => {
	const valid = { apiBaseUrl: 'https://api.example.com/api/', useMockApi: false, maxApplicants: 4, termsVersion: 'v1' };

	it('accepts a complete config and trims a trailing slash from the base URL', () => {
		expect(parseAppConfig(valid)).toEqual({ ...valid, apiBaseUrl: 'https://api.example.com/api' });
	});

	it('rejects a config with missing or mistyped fields', () => {
		expect(() => parseAppConfig(null)).toThrowError(/missing/);
		expect(() => parseAppConfig({ ...valid, useMockApi: 'yes' })).toThrowError(/missing/);
		expect(() => parseAppConfig({ ...valid, maxApplicants: 2.5 })).toThrowError(/missing/);
	});
});
