import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { FakeSession, TEST_TOKEN } from '../../../testing/test-session';
import { ApplicantsService } from '../api/applicants.service';
import { DraftsService } from '../api/drafts.service';
import { LoanDetailsService } from '../api/loan-details.service';
import { ApplicantsResponse, SaveApplicantsRequest } from '../models/applicant.model';
import { LoanDetails } from '../models/loan-details.model';
import { NumberOfApplicants } from '../models/reference-data';
import { ApplicationSession } from '../session/application-session';
import { ApplicationStore } from './application.store';

describe('ApplicationStore', () => {
	let store: ApplicationStore;
	let session: FakeSession;
	let loanDetailsService: jasmine.SpyObj<LoanDetailsService>;
	let applicantsService: jasmine.SpyObj<ApplicantsService>;
	let draftsService: jasmine.SpyObj<DraftsService>;

	const details = (numberOfApplicants: NumberOfApplicants) =>
		({ applicationId: 1, numberOfApplicants }) as LoanDetails;

	beforeEach(() => {
		session = new FakeSession();
		loanDetailsService = jasmine.createSpyObj<LoanDetailsService>('LoanDetailsService', ['get', 'save']);
		applicantsService = jasmine.createSpyObj<ApplicantsService>('ApplicantsService', ['get', 'save']);
		draftsService = jasmine.createSpyObj<DraftsService>('DraftsService', ['getAll', 'save', 'saveOnExit']);
		draftsService.save.and.returnValue(of(undefined));
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig({ maxApplicants: 4 }),
				{ provide: ApplicationSession, useValue: session },
				{ provide: LoanDetailsService, useValue: loanDetailsService },
				{ provide: ApplicantsService, useValue: applicantsService },
				{ provide: DraftsService, useValue: draftsService }
			]
		});
		store = TestBed.inject(ApplicationStore);
	});

	it('asks the server for nothing before the customer has started', () => {
		let loaded: LoanDetails | null | undefined;

		store.ensureLoanDetails().subscribe((d) => (loaded = d));
		store.ensureDrafts().subscribe();

		expect(loaded).toBeNull();
		expect(loanDetailsService.get).not.toHaveBeenCalled();
		expect(draftsService.getAll).not.toHaveBeenCalled();
	});

	it('loads loan details once and works out the applicant count from them', () => {
		session.resume(1);
		loanDetailsService.get.and.returnValue(of(details(NumberOfApplicants.More)));

		store.ensureLoanDetails().subscribe();
		store.ensureLoanDetails().subscribe();

		expect(loanDetailsService.get).toHaveBeenCalledOnceWith(1);
		expect(store.requiredApplicantCount()).toEqual({ min: 3, max: 4 });
	});

	it('has no applicant count until loan details are saved', () => {
		session.resume(1);
		loanDetailsService.get.and.returnValue(of(null));
		store.ensureLoanDetails().subscribe();

		expect(store.requiredApplicantCount()).toBeNull();
	});

	it('creates the application on the first save and saves under its id', () => {
		loanDetailsService.save.and.callFake((saved) => of(saved));

		store.saveLoanDetails({ numberOfApplicants: NumberOfApplicants.Couple } as LoanDetails).subscribe();

		expect(session.ensure).toHaveBeenCalled();
		expect(loanDetailsService.save).toHaveBeenCalledWith(jasmine.objectContaining({ applicationId: 7 }));
		expect(store.requiredApplicantCount()).toEqual({ min: 2, max: 2 });
	});

	it('keeps a draft here at once and on the server, creating the application if needed', () => {
		store.saveDraft('loan-details', { purpose: 1006 }).subscribe();

		expect(store.draft('loan-details')).toEqual({ purpose: 1006 });
		expect(draftsService.save).toHaveBeenCalledOnceWith(7, 'loan-details', { purpose: 1006 });
	});

	it('restores the server draft, and prefers what was typed in this tab since', () => {
		session.resume(1);
		draftsService.getAll.and.returnValue(of({ 'about-you': { data: { from: 'server' }, updatedAt: 'x' } }));
		store.ensureDrafts().subscribe();
		expect(store.draft('about-you')).toEqual({ from: 'server' });

		store.saveDraft('about-you', { from: 'here' }).subscribe();

		expect(store.draft('about-you')).toEqual({ from: 'here' });
		expect(store.draft('loan-details')).toBeNull();
	});

	it('forgets an application the server no longer knows (expired or deleted)', () => {
		session.resume(1);
		draftsService.getAll.and.returnValue(of(null));

		store.ensureDrafts().subscribe();

		expect(session.forget).toHaveBeenCalled();
		expect(store.applicationId()).toBeNull();
	});

	it('drops the step draft once the step is saved for real, keeping the other step', () => {
		session.resume(1);
		draftsService.getAll.and.returnValue(
			of({
				'loan-details': { data: { a: 1 }, updatedAt: 'x' },
				'about-you': { data: { b: 2 }, updatedAt: 'x' }
			})
		);
		store.ensureDrafts().subscribe();
		store.saveDraft('loan-details', { a: 2 }).subscribe();
		loanDetailsService.save.and.callFake((saved) => of(saved));

		store.saveLoanDetails(details(NumberOfApplicants.Single)).subscribe();

		expect(store.draft('loan-details')).toBeNull();
		expect(store.draft('about-you')).toEqual({ b: 2 });
	});

	it('clears the About you draft once the applicants are saved', () => {
		session.resume(1);
		const saved = { applicationId: 1, applicants: [] } as unknown as ApplicantsResponse;
		applicantsService.save.and.returnValue(of(saved));
		store.saveDraft('about-you', { applicants: [], termsAccepted: true }).subscribe();

		store.saveApplicants({} as SaveApplicantsRequest).subscribe();

		expect(store.applicantsDraft()).toBeNull();
		expect(store.applicants()).toBe(saved);
		expect(applicantsService.save).toHaveBeenCalledWith(1, {} as SaveApplicantsRequest);
	});

	it('sends the exit save only when there is an application to save it to', () => {
		store.saveDraftOnExit('loan-details', { a: 1 });
		expect(draftsService.saveOnExit).not.toHaveBeenCalled();

		session.resume(3);
		store.saveDraftOnExit('loan-details', { a: 2 });
		expect(draftsService.saveOnExit).toHaveBeenCalledOnceWith({ id: 3, token: TEST_TOKEN }, 'loan-details', {
			a: 2
		});
	});

	it('starts over with nothing: no application, no data, no drafts', () => {
		session.resume(1);
		loanDetailsService.get.and.returnValue(of(details(NumberOfApplicants.Couple)));
		store.ensureLoanDetails().subscribe();
		store.saveDraft('about-you', { b: 1 }).subscribe();

		store.startOver();

		expect(session.forget).toHaveBeenCalled();
		expect(store.loanDetails()).toBeNull();
		expect(store.draft('about-you')).toBeNull();
	});

	describe('completedSteps', () => {
		const applicants = (count: number, termsVersion = 'test-terms') =>
			({
				applicationId: 1,
				applicants: new Array(count).fill({}),
				consent: { termsVersion }
			}) as ApplicantsResponse;

		function load(numberOfApplicants: NumberOfApplicants | null, saved: ApplicantsResponse | null): void {
			session.resume(1);
			loanDetailsService.get.and.returnValue(of(numberOfApplicants ? details(numberOfApplicants) : null));
			applicantsService.get.and.returnValue(of(saved));
			store.ensureLoanDetails().subscribe();
			store.ensureApplicants().subscribe();
		}

		it('is empty before anything is saved', () => {
			load(null, null);
			expect([...store.completedSteps()]).toEqual([]);
		});

		it('includes both steps when the saved applicants fit the loan details', () => {
			load(NumberOfApplicants.Couple, applicants(2));
			expect([...store.completedSteps()]).toEqual(['/loan-details', '/about-you']);
		});

		it('drops About you when the applicant count no longer matches', () => {
			load(NumberOfApplicants.Single, applicants(2));
			expect(store.completedSteps().has('/about-you')).toBeFalse();
		});

		it('drops About you when the saved consent is for older terms', () => {
			load(NumberOfApplicants.Couple, applicants(2, 'older-terms'));
			expect(store.completedSteps().has('/about-you')).toBeFalse();
		});
	});
});
