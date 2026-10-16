import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideTestAppConfig } from '../../testing/test-app-config';
import { LoanDetails } from '../core/models/loan-details.model';
import { MOCK_LATENCY_MS, mockApiInterceptor } from './mock-api.interceptor';
import { mockDb } from './mock-db';

/** The mock follows the API's rules: POST creates, only the token opens, drafts, and saves clear drafts. */
describe('mock applications and drafts API', () => {
	let http: HttpClient;

	function call<T>(request: () => ReturnType<HttpClient['get']>): { body?: T; status?: number } {
		const result: { body?: T; status?: number } = {};
		request().subscribe({
			next: (body) => (result.body = body as T),
			error: (error: HttpErrorResponse) => (result.status = error.status)
		});
		tick(MOCK_LATENCY_MS);
		return result;
	}

	const withToken = (token: string) => ({ headers: new HttpHeaders({ 'X-Application-Token': token }) });

	function start(): { id: number; token: string } {
		const created = call<{ id: number; resumeToken: string }>(() => http.post('/api/applications', null)).body!;
		return { id: created.id, token: created.resumeToken };
	}

	beforeEach(() => {
		mockDb.clear();
		TestBed.configureTestingModule({
			providers: [provideTestAppConfig(), provideHttpClient(withInterceptors([mockApiInterceptor]))]
		});
		http = TestBed.inject(HttpClient);
	});

	afterEach(() => mockDb.clear());

	it('creates applications with their own ids and tokens', fakeAsync(() => {
		const first = start();
		const second = start();

		expect(second.id).toBe(first.id + 1);
		expect(second.token).not.toBe(first.token);
	}));

	it('opens an application only with its own token', fakeAsync(() => {
		const mine = start();
		const theirs = start();
		const drafts = (id: number, token: string) =>
			call(() => http.get(`/api/applications/${id}/drafts`, withToken(token)));

		expect(drafts(mine.id, mine.token).body).toEqual({});
		expect(drafts(mine.id, theirs.token).status).toBe(404);
		expect(call(() => http.get(`/api/applications/${mine.id}/loan-details`)).status).toBe(404);
	}));

	it('keeps a draft as sent, and drops it when the step is saved for real', fakeAsync(() => {
		const { id, token } = start();
		call(() => http.put(`/api/applications/${id}/drafts/loan-details`, { purpose: 1006 }, withToken(token)));
		call(() => http.put(`/api/applications/${id}/drafts/about-you`, { applicants: [] }, withToken(token)));

		const before = call<Record<string, { data: unknown }>>(() =>
			http.get(`/api/applications/${id}/drafts`, withToken(token))
		).body!;
		expect(before['loan-details'].data).toEqual({ purpose: 1006 });

		const details = { loanAmount: 500000, numberOfDependants: 0 } as LoanDetails;
		call(() => http.put(`/api/applications/${id}/loan-details`, details, withToken(token)));
		const after = call<Record<string, unknown>>(() =>
			http.get(`/api/applications/${id}/drafts`, withToken(token))
		).body!;

		expect(Object.keys(after)).toEqual(['about-you']);
	}));

	it('rejects a draft that is not an object, or for an unknown step', fakeAsync(() => {
		const { id, token } = start();

		expect(call(() => http.put(`/api/applications/${id}/drafts/loan-details`, [1], withToken(token))).status).toBe(
			400
		);
		expect(call(() => http.put(`/api/applications/${id}/drafts/income`, {}, withToken(token))).status).toBe(404);
	}));
});
