import { parseAppConfig } from './app-config';

describe('parseAppConfig', () => {
	const valid = {
		apiBaseUrl: 'https://api.example.com/api/',
		useMockApi: false,
		maxApplicants: 4,
		termsVersion: 'v1'
	};

	it('accepts a complete config and trims a trailing slash from the base URL', () => {
		expect(parseAppConfig(valid)).toEqual({
			...valid,
			apiBaseUrl: 'https://api.example.com/api',
			applicationId: 1,
			addressFinderKey: undefined
		});
	});

	it('reads an optional application id, defaulting to 1', () => {
		expect(parseAppConfig({ ...valid, applicationId: 900100 }).applicationId).toBe(900100);
		expect(() => parseAppConfig({ ...valid, applicationId: 0 })).toThrowError(/applicationId/);
		expect(() => parseAppConfig({ ...valid, applicationId: '7' })).toThrowError(/applicationId/);
	});

	it('reads an optional Addressfinder key, treating blank as none', () => {
		expect(parseAppConfig({ ...valid, addressFinderKey: ' KEY ' }).addressFinderKey).toBe('KEY');
		expect(parseAppConfig({ ...valid, addressFinderKey: '' }).addressFinderKey).toBeUndefined();
		expect(() => parseAppConfig({ ...valid, addressFinderKey: 42 })).toThrowError(/addressFinderKey/);
	});

	it('rejects a config with missing or mistyped fields', () => {
		expect(() => parseAppConfig(null)).toThrowError(/missing/);
		expect(() => parseAppConfig({ ...valid, useMockApi: 'yes' })).toThrowError(/missing/);
		expect(() => parseAppConfig({ ...valid, maxApplicants: 2.5 })).toThrowError(/missing/);
	});
});
