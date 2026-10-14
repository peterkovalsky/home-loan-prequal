import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { ApplicantsService } from '../api/applicants.service';
import { LoanDetailsService } from '../api/loan-details.service';
import { ApplicantsResponse, SaveApplicantsRequest } from '../models/applicant.model';
import { LoanDetails } from '../models/loan-details.model';
import { NumberOfApplicants } from '../models/reference-data';
import { ApplicationStore } from './application.store';

describe('ApplicationStore', () => {
	let store: ApplicationStore;
	let loanDetailsService: jasmine.SpyObj<LoanDetailsService>;
	let applicantsService: jasmine.SpyObj<ApplicantsService>;

	const details = (numberOfApplicants: NumberOfApplicants) =>
		({ applicationId: 1, numberOfApplicants }) as LoanDetails;

	beforeEach(() => {
		loanDetailsService = jasmine.createSpyObj<LoanDetailsService>('LoanDetailsService', ['get', 'save']);
		applicantsService = jasmine.createSpyObj<ApplicantsService>('ApplicantsService', ['get', 'save']);
		TestBed.configureTestingModule({
			providers: [
				provideTestAppConfig({ maxApplicants: 4 }),
				{ provide: LoanDetailsService, useValue: loanDetailsService },
				{ provide: ApplicantsService, useValue: applicantsService }
			]
		});
		store = TestBed.inject(ApplicationStore);
	});

	it('loads loan details once and works out the applicant count from them', () => {
		loanDetailsService.get.and.returnValue(of(details(NumberOfApplicants.More)));

		store.ensureLoanDetails().subscribe();
		store.ensureLoanDetails().subscribe();

		expect(loanDetailsService.get).toHaveBeenCalledTimes(1);
		expect(store.requiredApplicantCount()).toEqual({ min: 3, max: 4 });
	});

	it('has no applicant count until loan details are saved', () => {
		loanDetailsService.get.and.returnValue(of(null));
		store.ensureLoanDetails().subscribe();

		expect(store.requiredApplicantCount()).toBeNull();
	});

	it('updates the cache when loan details are saved', () => {
		loanDetailsService.save.and.callFake((saved) => of(saved));

		store.saveLoanDetails(details(NumberOfApplicants.Couple)).subscribe();

		expect(store.loanDetails()?.numberOfApplicants).toBe(NumberOfApplicants.Couple);
		expect(store.requiredApplicantCount()).toEqual({ min: 2, max: 2 });
	});

	it('clears the About you draft once the applicants are saved', () => {
		const saved = { applicationId: 1, applicants: [] } as unknown as ApplicantsResponse;
		applicantsService.save.and.returnValue(of(saved));
		store.saveApplicantsDraft({ applicants: [], termsAccepted: true });

		store.saveApplicants({} as SaveApplicantsRequest).subscribe();

		expect(store.applicantsDraft()).toBeNull();
		expect(store.applicants()).toBe(saved);
		expect(applicantsService.save).toHaveBeenCalledWith(1, {} as SaveApplicantsRequest);
	});
});
