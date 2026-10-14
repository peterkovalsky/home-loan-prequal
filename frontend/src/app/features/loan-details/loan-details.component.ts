import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, merge } from 'rxjs';
import { toErrorMessages } from '../../core/api/api-errors';
import { STEP_PATHS } from '../../core/journey/journey-steps';
import { JourneyService } from '../../core/journey/journey.service';
import { LoanDetails } from '../../core/models/loan-details.model';
import {
	AU_STATE_OPTIONS,
	AuState,
	LENDING_PURPOSE_OPTIONS,
	LendingPurpose,
	NUMBER_OF_APPLICANTS_OPTIONS,
	NumberOfApplicants,
	PROPERTY_USAGE_OPTIONS,
	PURCHASE_PURPOSES,
	PropertyUsage
} from '../../core/models/reference-data';
import { ApplicationStore } from '../../core/state/application.store';
import { StepActionsComponent } from '../../shared/components/step-actions/step-actions.component';
import { StepCardComponent } from '../../shared/components/step-card/step-card.component';
import { isInvalid } from '../../shared/forms/form-helpers';
import { MAX_AMOUNT } from '../../shared/validation/loan-rules';
import { depositWithinPropertyValueValidator } from '../../shared/validators/deposit.validator';

@Component({
	selector: 'app-loan-details',
	imports: [ReactiveFormsModule, StepCardComponent, StepActionsComponent],
	templateUrl: './loan-details.component.html',
	styleUrl: './loan-details.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoanDetailsComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly store = inject(ApplicationStore);
	private readonly journey = inject(JourneyService);
	private readonly destroyRef = inject(DestroyRef);

	readonly purposeOptions = LENDING_PURPOSE_OPTIONS;
	readonly propertyUsageOptions = PROPERTY_USAGE_OPTIONS;
	readonly applicantOptions = NUMBER_OF_APPLICANTS_OPTIONS;
	readonly stateOptions = AU_STATE_OPTIONS;
	readonly isInvalid = isInvalid;

	readonly loading = signal(true);
	readonly saving = signal(false);
	readonly saved = signal(false);
	readonly errorMessages = signal<string[]>([]);

	readonly form = this.fb.group(
		{
			purpose: this.fb.control<LendingPurpose | null>(null, Validators.required),
			propertyUsage: this.fb.control<PropertyUsage | null>(null, Validators.required),
			numberOfApplicants: this.fb.control<NumberOfApplicants | null>(null, Validators.required),
			isSameHousehold: this.fb.control<boolean | null>({ value: null, disabled: true }, Validators.required),
			numberOfDependants: this.fb.control<number | null>(0, [
				Validators.required,
				Validators.min(0),
				Validators.max(20)
			]),
			loanAmount: this.fb.control<number | null>(null, [
				Validators.required,
				Validators.min(1),
				Validators.max(MAX_AMOUNT)
			]),
			deposit: this.fb.control<number | null>({ value: null, disabled: true }, [
				Validators.required,
				Validators.min(0)
			]),
			estimatedPropertyValue: this.fb.control<number | null>(null, [
				Validators.required,
				Validators.min(1),
				Validators.max(MAX_AMOUNT)
			]),
			isAddressKnown: this.fb.nonNullable.control(false),
			address: this.fb.control<string | null>({ value: null, disabled: true }, [
				Validators.required,
				Validators.maxLength(200)
			]),
			state: this.fb.control<AuState | null>(null, Validators.required)
		},
		{ validators: depositWithinPropertyValueValidator }
	);

	get showSameHousehold(): boolean {
		return this.form.controls.isSameHousehold.enabled;
	}

	get showDeposit(): boolean {
		return this.form.controls.deposit.enabled;
	}

	get isAddressKnown(): boolean {
		return this.form.controls.isAddressKnown.value;
	}

	ngOnInit(): void {
		this.watchConditionalFields();

		this.store
			.ensureLoanDetails()
			.pipe(
				finalize(() => this.loading.set(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (details) => {
					if (details) {
						this.form.patchValue(details, { emitEvent: false });
						this.syncConditionalFields(false);
					}
				},
				error: () => this.errorMessages.set(['We could not load your loan details. Please refresh the page.'])
			});
	}

	submit(): void {
		this.saved.set(false);
		this.errorMessages.set([]);
		this.form.markAllAsTouched();
		if (this.form.invalid) {
			return;
		}

		this.saving.set(true);
		this.store
			.saveLoanDetails(this.toLoanDetails())
			.pipe(
				finalize(() => this.saving.set(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: () => this.saved.set(!this.journey.goNext(STEP_PATHS.loanDetails)),
				error: (error: unknown) => this.errorMessages.set(toErrorMessages(error))
			});
	}

	private watchConditionalFields(): void {
		const { numberOfApplicants, purpose, isAddressKnown } = this.form.controls;
		merge(numberOfApplicants.valueChanges, purpose.valueChanges, isAddressKnown.valueChanges)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.syncConditionalFields(true));
	}

	private syncConditionalFields(clearHidden: boolean): void {
		const { numberOfApplicants, purpose, isAddressKnown, isSameHousehold, deposit, address, state } =
			this.form.controls;
		const applicants = numberOfApplicants.value;
		const loanPurpose = purpose.value;

		this.toggle(isSameHousehold, applicants != null && applicants !== NumberOfApplicants.Single, clearHidden);
		this.toggle(deposit, loanPurpose != null && PURCHASE_PURPOSES.includes(loanPurpose), clearHidden);
		this.toggle(address, isAddressKnown.value, clearHidden);
		this.toggle(state, !isAddressKnown.value, clearHidden);
	}

	private toggle(control: AbstractControl, enabled: boolean, clearWhenDisabled: boolean): void {
		if (enabled) {
			control.enable({ emitEvent: false });
			return;
		}
		if (clearWhenDisabled) {
			control.reset(null, { emitEvent: false });
		}
		control.disable({ emitEvent: false });
	}

	private toLoanDetails(): LoanDetails {
		const value = this.form.getRawValue();
		return {
			applicationId: this.store.applicationId,
			purpose: value.purpose!,
			propertyUsage: value.propertyUsage!,
			numberOfApplicants: value.numberOfApplicants!,
			isSameHousehold: this.showSameHousehold ? value.isSameHousehold : null,
			numberOfDependants: value.numberOfDependants ?? 0,
			loanAmount: value.loanAmount!,
			deposit: this.showDeposit ? value.deposit : null,
			estimatedPropertyValue: value.estimatedPropertyValue,
			isAddressKnown: value.isAddressKnown,
			address: value.isAddressKnown ? value.address : null,
			state: value.isAddressKnown ? null : value.state
		};
	}
}
