import { InjectionToken } from '@angular/core';

/** Settings read from `/config.json` at startup, so one build can point at the mock, a local API or AWS. */
export interface AppConfig {
	apiBaseUrl: string;
	useMockApi: boolean;
	maxApplicants: number;
	termsVersion: string;
	/** Addressfinder's public key for address suggestions. Absent or empty: a plain text field. */
	addressFinderKey?: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export async function loadAppConfig(url = 'config.json'): Promise<AppConfig> {
	const response = await fetch(url, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
	}
	return parseAppConfig(await response.json());
}

export function parseAppConfig(raw: unknown): AppConfig {
	const config = raw as Partial<AppConfig> | null;
	if (
		typeof config?.apiBaseUrl !== 'string' ||
		typeof config.useMockApi !== 'boolean' ||
		!Number.isInteger(config.maxApplicants) ||
		typeof config.termsVersion !== 'string'
	) {
		throw new Error('config.json is missing apiBaseUrl, useMockApi, maxApplicants or termsVersion.');
	}
	if (config.addressFinderKey !== undefined && typeof config.addressFinderKey !== 'string') {
		throw new Error('config.json addressFinderKey must be a string.');
	}
	return {
		apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, ''),
		useMockApi: config.useMockApi,
		maxApplicants: config.maxApplicants!,
		termsVersion: config.termsVersion,
		addressFinderKey: config.addressFinderKey?.trim() || undefined
	};
}
