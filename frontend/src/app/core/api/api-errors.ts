import { HttpErrorResponse } from '@angular/common/http';

export const GENERIC_SAVE_ERROR = 'Something went wrong while saving. Please try again.';
export const NETWORK_ERROR = "We couldn't reach the server. Please check your connection and try again.";
export const CONFLICT_ERROR = 'This application was updated somewhere else. Reload the page to see the latest details.';

type FieldErrors = Record<string, string | string[]>;

interface ErrorBody {
	errors?: FieldErrors;
	detail?: string;
}

/**
 * Turns an API failure into messages for the customer. Understands the mock's
 * `{ errors: { field: message } }`, ASP.NET's `{ errors: { field: [messages] } }`
 * and ProblemDetails `detail`.
 */
export function toErrorMessages(error: unknown, fallback = GENERIC_SAVE_ERROR): string[] {
	if (!(error instanceof HttpErrorResponse)) {
		return [fallback];
	}
	if (error.status === 0) {
		return [NETWORK_ERROR];
	}
	if (error.status === 412) {
		return [CONFLICT_ERROR];
	}

	const body = error.error as ErrorBody | null;
	const fieldMessages = Object.values(body?.errors ?? {}).flat();
	if (fieldMessages.length) {
		return [...new Set(fieldMessages)];
	}
	return body?.detail ? [body.detail] : [fallback];
}
