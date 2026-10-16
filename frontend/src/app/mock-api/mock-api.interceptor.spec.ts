import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoanDetails } from '../core/models/loan-details.model';
import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage } from '../core/models/reference-data';
import { MOCK_LATENCY_MS, mockApiInterceptor } from './mock-api.interceptor';
import { mockDb } from './mock-db';
import { applicationTokenInterceptor } from '../core/session/application-token.interceptor';
import { TEST_TOKEN, provideTestSession } from '../../testing/test-session';
import { provideTestAppConfig } from '../../testing/test-app-config';

describe('mockApiInterceptor', () => {
	let http: HttpClient;

	const details: LoanDetails = {
		applicationId: 1,
		purpose: LendingPurpose.Refinance,
		propertyUsage: PropertyUsage.OwnerOccupied,
		numberOfApplicants: NumberOfApplicants.Single,
		isSameHousehold: null,
		numberOfDependants: 0,
		loanAmount: 500000,
		deposit: null,
		estimatedPropertyValue: 900000,
		isAddressKnown: false,
		address: null,
		state: AuState.QLD
	};

	beforeEach(() => {
		mockDb.clear();
		// Application 1 exists and the test session holds its token, as after POST /api/applications.
		mockDb.set('applications/1', { token: TEST_TOKEN });
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig(),
				...provideTestSession(1).providers,
				provideHttpClient(withInterceptors([applicationTokenInterceptor, mockApiInterceptor]))
			]
		});
		http = TestBed.inject(HttpClient);
	});

	afterEach(() => mockDb.clear());

	it('persists loan details between requests', fakeAsync(() => {
		let loaded: LoanDetails | undefined;

		http.put('/api/applications/1/loan-details', details).subscribe();
		tick(MOCK_LATENCY_MS);
		http.get<LoanDetails>('/api/applications/1/loan-details').subscribe((result) => (loaded = result));
		tick(MOCK_LATENCY_MS);

		expect(loaded).toEqual(details);
	}));

	it('returns validation errors as a 400', fakeAsync(() => {
		let error: HttpErrorResponse | undefined;

		http.put('/api/applications/1/loan-details', { ...details, loanAmount: 0 }).subscribe({
			error: (e: HttpErrorResponse) => (error = e)
		});
		tick(MOCK_LATENCY_MS);

		expect(error?.status).toBe(400);
		expect(error?.error.errors.loanAmount).toBeDefined();
	}));

	it('returns 404 for an endpoint that has no mock yet', fakeAsync(() => {
		let error: HttpErrorResponse | undefined;

		http.get('/api/applications/1/income').subscribe({ error: (e: HttpErrorResponse) => (error = e) });

		expect(error?.status).toBe(404);
	}));

	it('rejects a stale save with 412 and a missing If-Match with 428', fakeAsync(() => {
		const statuses: number[] = [];
		const record = { error: (e: HttpErrorResponse) => statuses.push(e.status) };

		http.put('/api/applications/1/loan-details', details).subscribe();
		tick(MOCK_LATENCY_MS);
		http.put('/api/applications/1/loan-details', details).subscribe(record);
		tick(MOCK_LATENCY_MS);
		http.put('/api/applications/1/loan-details', details, { headers: { 'If-Match': '"0"' } }).subscribe(record);
		tick(MOCK_LATENCY_MS);

		expect(statuses).toEqual([428, 412]);
	}));

	it('returns a new ETag after each save', fakeAsync(() => {
		const etags: (string | null)[] = [];

		http.put('/api/applications/1/loan-details', details, { observe: 'response' }).subscribe((r) =>
			etags.push(r.headers.get('ETag'))
		);
		tick(MOCK_LATENCY_MS);
		http.put('/api/applications/1/loan-details', details, {
			observe: 'response',
			headers: { 'If-Match': '"1"' }
		}).subscribe((r) => etags.push(r.headers.get('ETag')));
		tick(MOCK_LATENCY_MS);

		expect(etags).toEqual(['"1"', '"2"']);
	}));

	it('passes through requests to other origins, even when their path starts with /api', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig(),
				...provideTestSession(1).providers,
				provideHttpClient(withInterceptors([applicationTokenInterceptor, mockApiInterceptor])),
				provideHttpClientTesting()
			]
		});
		const client = TestBed.inject(HttpClient);
		const backend = TestBed.inject(HttpTestingController);

		client.get('https://api.addressfinder.io/api/au/address/autocomplete/').subscribe();

		backend.expectOne('https://api.addressfinder.io/api/au/address/autocomplete/').flush({});
		backend.verify();
	});
});
