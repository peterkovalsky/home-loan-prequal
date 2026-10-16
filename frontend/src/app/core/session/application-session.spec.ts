import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { ApplicationSession, SESSION_STORAGE_KEY } from './application-session';
import { applicationTokenInterceptor } from './application-token.interceptor';

describe('ApplicationSession', () => {
	let backend: HttpTestingController;

	function create(): ApplicationSession {
		return TestBed.inject(ApplicationSession);
	}

	beforeEach(() => {
		localStorage.removeItem(SESSION_STORAGE_KEY);
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig({ apiBaseUrl: '/api' }),
				provideHttpClient(withInterceptors([applicationTokenInterceptor])),
				provideHttpClientTesting()
			]
		});
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		backend.verify();
		localStorage.removeItem(SESSION_STORAGE_KEY);
	});

	it('creates one application however many callers ask at once, and remembers it', () => {
		const session = create();
		const ids: number[] = [];

		session.ensure().subscribe((id) => ids.push(id));
		session.ensure().subscribe((id) => ids.push(id));
		const request = backend.expectOne({ method: 'POST', url: '/api/applications' });
		expect(request.request.headers.has('X-Application-Token')).withContext('nothing to send yet').toBeFalse();
		request.flush({ id: 1000001, resumeToken: 'secret' });
		session.ensure().subscribe((id) => ids.push(id));

		expect(ids).toEqual([1000001, 1000001, 1000001]);
		expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!)).toEqual({ id: 1000001, token: 'secret' });
	});

	it('picks up the application stored by an earlier visit, without asking the server', () => {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: 42, token: 'kept' }));

		const session = create();

		expect(session.current()).toEqual({ id: 42, token: 'kept' });
		session.ensure().subscribe((id) => expect(id).toBe(42));
	});

	it('ignores a damaged stored value instead of failing to start', () => {
		localStorage.setItem(SESSION_STORAGE_KEY, '{not json');

		expect(create().current()).toBeNull();
	});

	it('forgets the application on this device', () => {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: 42, token: 'kept' }));
		const session = create();

		session.forget();

		expect(session.current()).toBeNull();
		expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
	});

	it('creates a new application after a failed attempt, rather than caching the failure', () => {
		const session = create();
		let failed = false;

		session.ensure().subscribe({ error: () => (failed = true) });
		backend.expectOne('/api/applications').flush(null, { status: 503, statusText: 'Unavailable' });
		session.ensure().subscribe();
		backend.expectOne('/api/applications').flush({ id: 5, resumeToken: 't' });

		expect(failed).toBeTrue();
		expect(session.applicationId()).toBe(5);
	});
});

describe('applicationTokenInterceptor', () => {
	let http: HttpClient;
	let backend: HttpTestingController;

	beforeEach(() => {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: 9, token: 'secret' }));
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig({ apiBaseUrl: 'https://api.example.com/api' }),
				provideHttpClient(withInterceptors([applicationTokenInterceptor])),
				provideHttpClientTesting()
			]
		});
		http = TestBed.inject(HttpClient);
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => localStorage.removeItem(SESSION_STORAGE_KEY));

	it('sends the token to our API', () => {
		http.get('https://api.example.com/api/applications/9/drafts').subscribe();

		expect(backend.expectOne(() => true).request.headers.get('X-Application-Token')).toBe('secret');
	});

	it('never sends it anywhere else, even to a path that looks like ours', () => {
		http.get('https://api.addressfinder.io/api/au/address/autocomplete/').subscribe();
		http.get('https://evil.example/api/applications/9/drafts').subscribe();

		backend.match(() => true).forEach((r) => expect(r.request.headers.has('X-Application-Token')).toBeFalse());
	});
});
