import { HttpRequest } from '@angular/common/http';
import { mockDb } from './mock-db';

export interface MockResult {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}

export const ok = (body: unknown, headers?: Record<string, string>): MockResult => ({ status: 200, body, headers });
export const badRequest = (errors: Record<string, string>): MockResult => ({ status: 400, body: { errors } });
export const problem = (status: number, title: string, detail: string): MockResult => ({
	status,
	body: { status, title, detail }
});

const versionKey = (key: string) => `${key}#version`;

function etagFor(key: string): string | null {
	const version = mockDb.get<number>(versionKey(key));
	return version ? `"${version}"` : null;
}

/** GET a single-document resource with its ETag, or 404 when nothing has been saved (as the API does). */
export function readResource(key: string): MockResult {
	const value = mockDb.get(key);
	if (value === null) {
		return problem(404, 'Not found', 'Nothing has been saved yet.');
	}
	const etag = etagFor(key);
	return ok(value, etag ? { ETag: etag } : undefined);
}

/**
 * Optimistic concurrency, as the real API does it: once a resource exists, a PUT must
 * send `If-Match` with the current ETag (428 if missing, 412 if stale).
 */
export function checkPrecondition(req: HttpRequest<unknown>, key: string): MockResult | null {
	const current = etagFor(key);
	if (!current) {
		return null;
	}
	const ifMatch = req.headers.get('If-Match');
	if (!ifMatch) {
		return problem(428, 'Precondition required', 'Send If-Match with the ETag from your last read.');
	}
	return ifMatch === current
		? null
		: problem(412, 'Precondition failed', 'This resource was changed by someone else. Reload and try again.');
}

/** Saves a resource, bumps its version and returns the saved body with the new ETag. */
export function writeResource(key: string, value: unknown): MockResult {
	mockDb.set(key, value);
	const version = (mockDb.get<number>(versionKey(key)) ?? 0) + 1;
	mockDb.set(versionKey(key), version);
	return ok(value, { ETag: `"${version}"` });
}
