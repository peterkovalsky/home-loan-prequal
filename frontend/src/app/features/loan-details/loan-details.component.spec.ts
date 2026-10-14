import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApplicantsService } from '../../core/api/applicants.service';
import { LoanDetailsService } from '../../core/api/loan-details.service';
import { LoanDetails } from '../../core/models/loan-details.model';
import { AuState, LendingPurpose, NumberOfApplicants, PropertyUsage } from '../../core/models/reference-data';
import { provideTestAppConfig } from '../../../testing/test-app-config';
import { LoanDetailsComponent } from './loan-details.component';

describe('LoanDetailsComponent', () => {
	let fixture: ComponentFixture<LoanDetailsComponent>;
	let component: LoanDetailsComponent;
	let service: jasmine.SpyObj<LoanDetailsService>;

	const savedDetails: LoanDetails = {
		applicationId: 1,
		purpose: LendingPurpose.PurchaseExistingDwelling,
		propertyUsage: PropertyUsage.OwnerOccupied,
		numberOfApplicants: NumberOfApplicants.Couple,
		isSameHousehold: true,
		numberOfDependants: 2,
		loanAmount: 600000,
		deposit: 150000,
		estimatedPropertyValue: 750000,
		isAddressKnown: false,
		address: null,
		state: AuState.VIC
	};

	function create(existing: LoanDetails | null = null): void {
		service.get.and.returnValue(of(existing));
		fixture = TestBed.createComponent(LoanDetailsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	function fillValidForm(): void {
		component.form.patchValue({
			purpose: LendingPurpose.Refinance,
			propertyUsage: PropertyUsage.InvestmentResidential,
			numberOfApplicants: NumberOfApplicants.Single,
			numberOfDependants: 0,
			loanAmount: 400000,
			estimatedPropertyValue: 800000,
			state: AuState.NSW
		});
	}

	beforeEach(() => {
		service = jasmine.createSpyObj<LoanDetailsService>('LoanDetailsService', ['get', 'save']);
		TestBed.configureTestingModule({
			imports: [LoanDetailsComponent],
			providers: [
				provideRouter([]),
				provideTestAppConfig(),
				{ provide: LoanDetailsService, useValue: service },
				{ provide: ApplicantsService, useValue: jasmine.createSpyObj('ApplicantsService', ['get', 'save']) }
			]
		});
	});

	it('loads saved details into the form', () => {
		create(savedDetails);

		expect(component.loading()).toBeFalse();
		expect(component.form.controls.loanAmount.value).toBe(600000);
		expect(component.showSameHousehold).toBeTrue();
		expect(component.showDeposit).toBeTrue();
		expect(component.form.controls.isSameHousehold.value).toBeTrue();
	});

	it('only asks about the household when there is more than one applicant', () => {
		create();
		const applicants = component.form.controls.numberOfApplicants;

		applicants.setValue(NumberOfApplicants.Single);
		expect(component.showSameHousehold).toBeFalse();

		applicants.setValue(NumberOfApplicants.Couple);
		expect(component.showSameHousehold).toBeTrue();
	});

	it('only asks for a deposit when buying or building', () => {
		create();
		const purpose = component.form.controls.purpose;

		purpose.setValue(LendingPurpose.Refinance);
		expect(component.showDeposit).toBeFalse();

		purpose.setValue(LendingPurpose.PurchaseNewDwelling);
		expect(component.showDeposit).toBeTrue();
	});

	it('clears a hidden answer when the question no longer applies', () => {
		create(savedDetails);

		component.form.controls.purpose.setValue(LendingPurpose.Refinance);

		expect(component.form.controls.deposit.value).toBeNull();
	});

	it('requires an address instead of a state once the address is known', () => {
		create();

		component.form.controls.isAddressKnown.setValue(true);

		expect(component.form.controls.address.enabled).toBeTrue();
		expect(component.form.controls.state.disabled).toBeTrue();
	});

	it('flags a deposit larger than the property value', () => {
		create();
		fillValidForm();
		component.form.patchValue({ purpose: LendingPurpose.PurchaseExistingDwelling });
		component.form.patchValue({ deposit: 900000 });

		expect(component.form.hasError('depositExceedsPropertyValue')).toBeTrue();
	});

	it('does not save an invalid form', () => {
		create();

		component.submit();

		expect(service.save).not.toHaveBeenCalled();
		expect(component.form.controls.loanAmount.touched).toBeTrue();
	});

	it('saves hidden answers as null and continues to About you', () => {
		create();
		fillValidForm();
		service.save.and.callFake((details) => of(details));
		const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

		component.submit();

		expect(service.save).toHaveBeenCalledOnceWith(
			jasmine.objectContaining({
				loanAmount: 400000,
				deposit: null,
				isSameHousehold: null,
				address: null,
				state: AuState.NSW
			})
		);
		expect(navigate).toHaveBeenCalledWith('/about-you');
	});

	it('shows validation messages returned by the API', () => {
		create();
		fillValidForm();
		service.save.and.returnValue(
			throwError(
				() =>
					new HttpErrorResponse({
						status: 400,
						error: { errors: { loanAmount: 'Loan amount is too high.' } }
					})
			)
		);

		component.submit();

		expect(component.errorMessages()).toEqual(['Loan amount is too high.']);
		expect(component.saving()).toBeFalse();
	});

	it('caps amounts at the same limit as the API', () => {
		create();

		component.form.controls.loanAmount.setValue(100_000_001);
		component.form.controls.estimatedPropertyValue.setValue(100_000_000);

		expect(component.form.controls.loanAmount.hasError('max')).toBeTrue();
		expect(component.form.controls.estimatedPropertyValue.valid).toBeTrue();
	});
});
