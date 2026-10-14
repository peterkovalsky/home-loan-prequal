import { HttpErrorResponse } from '@angular/common/http';
import { CONFLICT_ERROR, GENERIC_SAVE_ERROR, NETWORK_ERROR, toErrorMessages } from './api-errors';

describe('toErrorMessages', () => {
	const httpError = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

	it('lists field messages in the mock format', () => {
		expect(toErrorMessages(httpError(400, { errors: { a: 'A is wrong.', b: 'B is wrong.' } }))).toEqual([
			'A is wrong.',
			'B is wrong.'
		]);
	});

	it('flattens ASP.NET validation arrays and removes duplicates', () => {
		const error = httpError(400, { errors: { a: ['A is wrong.', 'Also wrong.'], b: ['A is wrong.'] } });

		expect(toErrorMessages(error)).toEqual(['A is wrong.', 'Also wrong.']);
	});

	it('uses the ProblemDetails detail when there are no field errors', () => {
		expect(toErrorMessages(httpError(409, { title: 'Conflict', detail: 'Save loan details first.' }))).toEqual([
			'Save loan details first.'
		]);
	});

	it('explains network failures and concurrent edits', () => {
		expect(toErrorMessages(httpError(0))).toEqual([NETWORK_ERROR]);
		expect(toErrorMessages(httpError(412))).toEqual([CONFLICT_ERROR]);
	});

	it('falls back to a generic or supplied message', () => {
		expect(toErrorMessages(httpError(500))).toEqual([GENERIC_SAVE_ERROR]);
		expect(toErrorMessages(new Error('boom'), 'Could not load.')).toEqual(['Could not load.']);
	});
});
