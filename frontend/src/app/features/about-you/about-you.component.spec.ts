import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { provideTestSession } from '../../../testing/test-session';
import { CONFLICT_ERROR } from '../../core/api/api-errors';
import { ApplicantsService } from '../../core/api/applicants.service';
import { DraftsService } from '../../core/api/drafts.service';
import { LoanDetailsService } from '../../core/api/loan-details.service';
import { ApplicantsResponse } from '../../core/models/applicant.model';
import { LoanDetails } from '../../core/models/loan-details.model';
import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage, Title } from '../../core/models/reference-data';
import { ApplicationStore } from '../../core/state/application.store';
import { CLOCK } from '../../core/time/clock';
import { AboutYouComponent } from './about-you.component';

describe('AboutYouComponent', () => {
	let fixture: ComponentFixture<AboutYouComponent>;
	let component: AboutYouComponent;
	let loanDetailsService: jasmine.SpyObj<LoanDetailsService>;
	let applicantsService: jasmine.SpyObj<ApplicantsService>;
	let navigate: jasmine.Spy;

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

	const savedApplicants = (termsVersion = 'test-terms'): ApplicantsResponse => ({
		applicationId: 1,
		applicants: [
			{
				id: 101,
				ordinal: 1,
				title: Title.Mr,
				firstName: 'Alex',
				lastName: 'Taylor',
				email: 'alex@example.com',
				mobile: '0412345678',
				dateOfBirth: '1988-03-14'
			},
			{
				id: 102,
				ordinal: 2,
				title: Title.Ms,
				firstName: 'Jordan',
				lastName: 'Taylor',
				email: null,
				mobile: '0498765432',
				dateOfBirth: '1990-07-02'
			}
		],
		consent: { termsVersion, acceptedAt: '2026-10-01T00:00:00Z' }
	});

	const validApplicant = {
		title: Title.Dr,
		firstName: '  Sam ',
		lastName: 'Lee',
		email: ' sam@example.com ',
		mobile: '+61 412 345 678',
		dateOfBirth: '1990-01-01'
	};

	function create(numberOfApplicants = NumberOfApplicants.Single, saved: ApplicantsResponse | null = null): void {
		loanDetailsService.get.and.returnValue(of(loanDetails(numberOfApplicants)));
		applicantsService.get.and.returnValue(of(saved));
		fixture = TestBed.createComponent(AboutYouComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	/** Leave the step and come back, as Back/Continue on Loan details would. */
	function revisit(): void {
		fixture.destroy();
		fixture = TestBed.createComponent(AboutYouComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	const emailRequired = (index: number) => {
		const email = component.applicants.at(index).controls.email;
		email.setValue('');
		return email.hasError('required');
	};

	beforeEach(() => {
		loanDetailsService = jasmine.createSpyObj<LoanDetailsService>('LoanDetailsService', ['get', 'save']);
		applicantsService = jasmine.createSpyObj<ApplicantsService>('ApplicantsService', ['get', 'save']);
		TestBed.configureTestingModule({
			imports: [AboutYouComponent],
			providers: [
				...provideTestSession().providers,
				provideRouter([]),
				provideTestAppConfig({ maxApplicants: 4 }),
				{ provide: CLOCK, useValue: () => new Date(2026, 9, 14) },
				{ provide: LoanDetailsService, useValue: loanDetailsService },
				{ provide: ApplicantsService, useValue: applicantsService }
			]
		});
		navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
	});

	[
		[NumberOfApplicants.Single, 1],
		[NumberOfApplicants.Couple, 2],
		[NumberOfApplicants.More, 3]
	].forEach(([answer, sections]) =>
		it(`starts with ${sections} section(s) for answer ${answer}`, () => {
			create(answer);

			expect(component.applicants.length).toBe(sections);
			expect(fixture.nativeElement.querySelectorAll('section.applicant').length).toBe(sections);
		})
	);

	it('lets "more than two" add up to the configured maximum and remove down to three', () => {
		create(NumberOfApplicants.More);

		component.addApplicant();
		component.addApplicant();
		expect(component.applicants.length).toBe(4);
		expect(component.canAddApplicant).toBeFalse();

		component.removeApplicant(1);
		expect(component.applicants.length).toBe(3);
		expect(component.canRemoveApplicant(1)).toBeFalse();
	});

	it('never offers to remove the primary applicant or the required ones', () => {
		create(NumberOfApplicants.Couple);

		expect(component.canAddApplicant).toBeFalse();
		expect(component.canRemoveApplicant(0)).toBeFalse();
		expect(component.canRemoveApplicant(1)).toBeFalse();
	});

	it('requires an email only for the primary applicant', () => {
		create(NumberOfApplicants.Couple);

		expect(emailRequired(0)).toBeTrue();
		expect(emailRequired(1)).toBeFalse();

		component.applicants.at(1).controls.email.setValue('not-an-email');
		expect(component.applicants.at(1).controls.email.hasError('emailAddress')).toBeTrue();
	});

	it('loads saved applicants and their consent to the current terms', () => {
		create(NumberOfApplicants.Couple, savedApplicants());

		expect(component.applicants.at(1).controls.firstName.value).toBe('Jordan');
		expect(component.applicants.at(1).controls.email.value).toBe('');
		expect(component.form.controls.termsAccepted.value).toBeTrue();
	});

	it('asks for agreement again when the terms have changed since', () => {
		create(NumberOfApplicants.Couple, savedApplicants('older-terms'));

		expect(component.form.controls.termsAccepted.value).toBeFalse();
	});

	it('does not save without agreement to the terms', () => {
		create();
		component.applicants.at(0).setValue(validApplicant);

		component.submit();

		expect(applicantsService.save).not.toHaveBeenCalled();
		expect(component.form.controls.termsAccepted.touched).toBeTrue();
	});

	it('ticks the checkbox when the customer agrees in the terms dialog', () => {
		create();

		component.agreeToTerms();

		expect(component.form.controls.termsAccepted.value).toBeTrue();
	});

	it('flags an applicant under 18 with a clear message', () => {
		create();
		const dob = component.applicants.at(0).controls.dateOfBirth;

		dob.setValue('2008-10-15');

		expect(component.dateOfBirthMessage(dob)).toBe('Every applicant must be 18 or older.');
	});

	it('restores the About you draft kept on the server, over the saved applicants', () => {
		const drafts = TestBed.inject(DraftsService) as jasmine.SpyObj<DraftsService>;
		drafts.getAll.and.returnValue(
			of({
				'about-you': {
					data: {
						applicants: [{ ...savedApplicants().applicants[0], firstName: 'Alexandra' }],
						termsAccepted: false
					},
					updatedAt: 'x'
				}
			})
		);

		create(NumberOfApplicants.Couple, savedApplicants());

		expect(component.applicants.at(0).controls.firstName.value).toBe('Alexandra');
		expect(component.applicants.length).withContext('still sized to the loan details').toBe(2);
		expect(component.form.controls.termsAccepted.value).toBeFalse();
	});

	it('keeps unsaved input when the customer goes back and returns', () => {
		create(NumberOfApplicants.Couple);
		component.applicants.at(0).controls.firstName.setValue('Alex');
		component.applicants.at(0).markAsDirty();

		component.back();
		expect(navigate).toHaveBeenCalledWith('/loan-details');
		revisit();

		expect(component.applicants.at(0).controls.firstName.value).toBe('Alex');
	});

	it('keeps an applicant hidden by a smaller count, ready if the count goes back up', () => {
		const store = TestBed.inject(ApplicationStore);
		loanDetailsService.save.and.callFake((details) => of(details));
		create(NumberOfApplicants.Couple, savedApplicants());
		component.applicants.at(1).controls.firstName.setValue('Jordy');
		component.form.markAsDirty();

		store.saveLoanDetails(loanDetails(NumberOfApplicants.Single)).subscribe();
		revisit();
		expect(component.applicants.length).toBe(1);
		component.applicants.at(0).controls.lastName.setValue('Smith');
		component.form.markAsDirty();

		store.saveLoanDetails(loanDetails(NumberOfApplicants.Couple)).subscribe();
		revisit();
		expect(component.applicants.length).toBe(2);
		expect(component.applicants.at(0).controls.lastName.value).toBe('Smith');
		expect(component.applicants.at(1).controls.firstName.value).toBe('Jordy');
	});

	it('only submits the applicants the loan details call for', () => {
		const store = TestBed.inject(ApplicationStore);
		loanDetailsService.save.and.callFake((details) => of(details));
		applicantsService.save.and.returnValue(of(savedApplicants()));
		create(NumberOfApplicants.Couple, savedApplicants());
		store.saveLoanDetails(loanDetails(NumberOfApplicants.Single)).subscribe();
		revisit();

		component.submit();

		expect(applicantsService.save.calls.mostRecent().args[1].applicants.map((a) => a.firstName)).toEqual(['Alex']);
	});

	it('sends trimmed, normalised details and the terms version, then shows the application as submitted', () => {
		create();
		applicantsService.save.and.returnValue(of(savedApplicants()));
		component.applicants.at(0).setValue(validApplicant);
		component.form.controls.termsAccepted.setValue(true);

		component.submit();

		expect(applicantsService.save).toHaveBeenCalledOnceWith(1, {
			applicants: [
				{
					title: Title.Dr,
					firstName: 'Sam',
					lastName: 'Lee',
					email: 'sam@example.com',
					mobile: '0412345678',
					dateOfBirth: '1990-01-01'
				}
			],
			consent: { accepted: true, termsVersion: 'test-terms' }
		});
		expect(navigate)
			.withContext('the last step: saving it submits the application')
			.toHaveBeenCalledWith('/complete');
	});

	it('shows server validation errors and explains a concurrent edit', () => {
		create();
		component.applicants.at(0).setValue(validApplicant);
		component.form.controls.termsAccepted.setValue(true);

		applicantsService.save.and.returnValue(
			throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { mobile: 'Bad mobile.' } } }))
		);
		component.submit();
		expect(component.errorMessages()).toEqual(['Bad mobile.']);

		applicantsService.save.and.returnValue(throwError(() => new HttpErrorResponse({ status: 412 })));
		component.submit();
		expect(component.errorMessages()).toEqual([CONFLICT_ERROR]);
		expect(component.saving()).toBeFalse();
	});

	it('explains when the details could not be loaded', () => {
		loanDetailsService.get.and.returnValue(of(loanDetails(NumberOfApplicants.Single)));
		applicantsService.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
		fixture = TestBed.createComponent(AboutYouComponent);
		fixture.detectChanges();

		expect(fixture.componentInstance.errorMessages()[0]).toContain('could not load');
	});
});
