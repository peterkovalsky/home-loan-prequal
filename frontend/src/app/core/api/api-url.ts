/**
 * True when `url` points at our API (same origin and under the base path). Third-party APIs, such
 * as Addressfinder whose path also starts with `/api/`, are not ours: no mock, no token.
 */
export function isApiUrl(url: string, apiBaseUrl: string): boolean {
	const api = new URL(apiBaseUrl, 'http://localhost');
	const target = new URL(url, 'http://localhost');
	return target.origin === api.origin && target.pathname.startsWith(api.pathname);
}
