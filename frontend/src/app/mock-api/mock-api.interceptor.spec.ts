import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoanDetails } from '../core/models/loan-details.model';
import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage } from '../core/models/reference-data';
import { MOCK_LATENCY_MS, mockApiInterceptor } from './mock-api.interceptor';
import { mockDb } from './mock-db';
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
		TestBed.configureTestingModule({
			providers: [provideTestAppConfig(), provideHttpClient(withInterceptors([mockApiInterceptor]))]
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
});
