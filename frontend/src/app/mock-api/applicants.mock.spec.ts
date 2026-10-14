import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideTestAppConfig } from '../../testing/test-app-config';
import { ApplicantsResponse, SaveApplicantsRequest } from '../core/models/applicant.model';
import { LoanDetails } from '../core/models/loan-details.model';
import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage, Title } from '../core/models/reference-data';
import { toIsoDate } from '../shared/validation/applicant-rules';
import { MOCK_LATENCY_MS, mockApiInterceptor } from './mock-api.interceptor';
import { mockDb } from './mock-db';

describe('mock applicants API', () => {
	const url = '/api/applications/1/applicants';
	let http: HttpClient;

	const loanDetails = (numberOfApplicants: NumberOfApplicants): LoanDetails => ({
		applicationId: 1,
		purpose: LendingPurpose.Refinance,
		propertyUsage: PropertyUsage.OwnerOccupied,
		numberOfApplicants,
		isSameHousehold: numberOfApplicants === NumberOfApplicants.Single ? null : true,
		numberOfDependants: 0,
		loanAmount: 500000,
		deposit: null,
		estimatedPropertyValue: 900000,
		isAddressKnown: false,
		address: null,
		state: AuState.QLD
	});

	const applicant = (overrides: object = {}) => ({
		title: Title.Mr,
		firstName: ' Alex ',
		lastName: 'Taylor',
		email: 'alex.taylor@example.com',
		mobile: '0412 345 678',
		dateOfBirth: '1988-03-14',
		...overrides
	});

	const request = (applicants: object[], termsVersion = 'test-terms'): SaveApplicantsRequest =>
		({ applicants, consent: { accepted: true, termsVersion } }) as SaveApplicantsRequest;

	function put(body: unknown): { saved?: ApplicantsResponse; error?: HttpErrorResponse } {
		const result: { saved?: ApplicantsResponse; error?: HttpErrorResponse } = {};
		http.put<ApplicantsResponse>(url, body).subscribe({
			next: (value) => (result.saved = value),
			error: (error: HttpErrorResponse) => (result.error = error)
		});
		tick(MOCK_LATENCY_MS);
		return result;
	}

	beforeEach(() => {
		mockDb.clear();
		TestBed.configureTestingModule({
			providers: [provideTestAppConfig(), provideHttpClient(withInterceptors([mockApiInterceptor]))]
		});
		http = TestBed.inject(HttpClient);
	});

	afterEach(() => mockDb.clear());

	it('returns null before anything is saved', fakeAsync(() => {
		let loaded: unknown = 'unset';
		http.get(url).subscribe((value) => (loaded = value));
		tick(MOCK_LATENCY_MS);

		expect(loaded).toBeNull();
	}));

	it('needs loan details first', fakeAsync(() => {
		const { error } = put(request([applicant()]));

		expect(error?.status).toBe(409);
	}));

	it('saves normalised applicants and returns them on GET', fakeAsync(() => {
		mockDb.set('applications/1/loan-details', loanDetails(NumberOfApplicants.Couple));

		const { saved } = put(request([applicant(), applicant({ title: Title.Ms, firstName: 'Jordan', email: '' })]));
		let loaded: ApplicantsResponse | null = null;
		http.get<ApplicantsResponse>(url).subscribe((value) => (loaded = value));
		tick(MOCK_LATENCY_MS);

		expect(saved?.applicants.map((a) => [a.ordinal, a.firstName, a.mobile, a.email])).toEqual([
			[1, 'Alex', '0412345678', 'alex.taylor@example.com'],
			[2, 'Jordan', '0412345678', null]
		]);
		expect(saved?.consent.termsVersion).toBe('test-terms');
		expect(loaded as ApplicantsResponse | null).toEqual(saved!);
	}));

	it('requires as many applicants as the loan details say', fakeAsync(() => {
		mockDb.set('applications/1/loan-details', loanDetails(NumberOfApplicants.More));

		expect(put(request([applicant(), applicant()])).error?.error.errors.applicants).toContain('between 3 and 4');
		expect(put(request(Array.from({ length: 5 }, () => applicant()))).error?.status).toBe(400);
		expect(put(request(Array.from({ length: 4 }, () => applicant()))).saved).toBeDefined();
	}));

	it('validates every field and names the applicant', fakeAsync(() => {
		mockDb.set('applications/1/loan-details', loanDetails(NumberOfApplicants.Couple));
		const tenYearsAgo = new Date();
		tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

		const { error } = put(
			request([
				applicant({ email: null }),
				applicant({ title: 9, firstName: ' ', mobile: '0212345678', dateOfBirth: toIsoDate(tenYearsAgo) })
			])
		);

		expect(error?.status).toBe(400);
		expect(error?.error.errors).toEqual({
			'applicants[0].email': 'Applicant 1: enter a valid email address.',
			'applicants[1].title': 'Applicant 2: choose a title.',
			'applicants[1].firstName': 'Applicant 2: enter a first name (up to 50 characters).',
			'applicants[1].mobile': 'Applicant 2: enter a valid Australian mobile number.',
			'applicants[1].dateOfBirth': 'Applicant 2: every applicant must be 18 or older.'
		});
	}));

	it('requires agreement to the current terms', fakeAsync(() => {
		mockDb.set('applications/1/loan-details', loanDetails(NumberOfApplicants.Single));

		const notAccepted = put({
			applicants: [applicant()],
			consent: { accepted: false, termsVersion: 'test-terms' }
		});
		const oldTerms = put(request([applicant()], 'old-terms'));

		expect(notAccepted.error?.error.errors.consent).toContain('must agree');
		expect(oldTerms.error?.error.errors.consent).toContain('latest');
	}));

	it('keeps the original consent time when the same terms are agreed again', fakeAsync(() => {
		mockDb.set('applications/1/loan-details', loanDetails(NumberOfApplicants.Single));
		const first = put(request([applicant()])).saved!;

		let second: ApplicantsResponse | undefined;
		http.put<ApplicantsResponse>(url, request([applicant({ firstName: 'Sam' })]), {
			headers: { 'If-Match': '"1"' }
		}).subscribe((value) => (second = value));
		tick(MOCK_LATENCY_MS);

		expect(second?.applicants[0].firstName).toBe('Sam');
		expect(second?.consent.acceptedAt).toBe(first.consent.acceptedAt);
	}));
});
