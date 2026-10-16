import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	AbstractControl,
	FormArray,
	FormControl,
	FormGroup,
	NonNullableFormBuilder,
	ReactiveFormsModule,
	Validators
} from '@angular/forms';
import { finalize, forkJoin, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/api/api-errors';
import { APP_CONFIG } from '../../core/config/app-config';
import { DraftAutosave } from '../../core/drafts/draft-autosave';
import { STEP_PATHS } from '../../core/journey/journey-steps';
import { JourneyService } from '../../core/journey/journey.service';
import {
	Applicant,
	ApplicantDraft,
	ApplicantsDraft,
	ApplicantsResponse,
	SaveApplicantsRequest
} from '../../core/models/applicant.model';
import { NumberOfApplicants, TITLE_OPTIONS, Title } from '../../core/models/reference-data';
import { ApplicationStore } from '../../core/state/application.store';
import { CLOCK } from '../../core/time/clock';
import { DraftStatusComponent } from '../../shared/components/draft-status/draft-status.component';
import { StepActionsComponent } from '../../shared/components/step-actions/step-actions.component';
import { StepCardComponent } from '../../shared/components/step-card/step-card.component';
import { isInvalid } from '../../shared/forms/form-helpers';
import { ApplicantCountRange } from '../../shared/validation/applicant-count';
import { NAME_MAX_LENGTH, normaliseAuMobile, toIsoDate } from '../../shared/validation/applicant-rules';
import {
	auMobileValidator,
	dateOfBirthValidator,
	emailAddressValidator,
	requiredText
} from '../../shared/validators/applicant.validators';
import { TermsDialogComponent } from './terms-dialog/terms-dialog.component';

type ApplicantForm = FormGroup<{
	title: FormControl<Title | null>;
	firstName: FormControl<string>;
	lastName: FormControl<string>;
	email: FormControl<string>;
	mobile: FormControl<string>;
	dateOfBirth: FormControl<string>;
}>;

const EMPTY_APPLICANT: ApplicantDraft = {
	title: null,
	firstName: '',
	lastName: '',
	email: '',
	mobile: '',
	dateOfBirth: ''
};

@Component({
	selector: 'app-about-you',
	imports: [ReactiveFormsModule, StepCardComponent, StepActionsComponent, TermsDialogComponent, DraftStatusComponent],
	templateUrl: './about-you.component.html',
	styleUrl: './about-you.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutYouComponent implements OnInit {
	private readonly fb = inject(NonNullableFormBuilder);
	private readonly store = inject(ApplicationStore);
	private readonly journey = inject(JourneyService);
	private readonly config = inject(APP_CONFIG);
	private readonly clock = inject(CLOCK);
	private readonly destroyRef = inject(DestroyRef);

	readonly titleOptions = TITLE_OPTIONS;
	readonly nameMaxLength = NAME_MAX_LENGTH;
	readonly latestDateOfBirth = toIsoDate(this.clock());
	readonly isInvalid = isInvalid;

	readonly loading = signal(true);
	readonly saving = signal(false);
	readonly saved = signal(false);
	readonly errorMessages = signal<string[]>([]);

	readonly form = this.fb.group({
		applicants: this.fb.array<ApplicantForm>([]),
		termsAccepted: this.fb.control(false, Validators.requiredTrue)
	});

	private range: ApplicantCountRange = { min: 1, max: 1 };
	private numberOfApplicants: NumberOfApplicants | null = null;
	/** Applicants beyond the current count (e.g. the customer went back and chose "Just me"). Kept, not submitted. */
	private hiddenApplicants: ApplicantDraft[] = [];

	/** Keeps what's typed on the server, valid or not, so the customer can leave and come back. */
	readonly autosave = new DraftAutosave('about-you', () => this.toDraftValue());

	get applicants(): FormArray<ApplicantForm> {
		return this.form.controls.applicants;
	}

	get canAddApplicant(): boolean {
		return this.applicants.length < this.range.max;
	}

	get reasonShown(): string {
		return this.numberOfApplicants === NumberOfApplicants.More
			? 'Shown because you said more than two of you are applying'
			: 'Shown because you said two of you are applying';
	}

	ngOnInit(): void {
		forkJoin({
			loanDetails: this.store.ensureLoanDetails(),
			applicants: this.store.ensureApplicants(),
			drafts: this.store.ensureDrafts()
		})
			.pipe(
				finalize(() => this.loading.set(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: ({ loanDetails, applicants }) => {
					this.numberOfApplicants = loanDetails?.numberOfApplicants ?? null;
					this.range = this.store.requiredApplicantCount() ?? this.range;
					this.populate(applicants);
					this.autosave.restored();
					this.form.valueChanges
						.pipe(takeUntilDestroyed(this.destroyRef))
						.subscribe(() => this.autosave.changed());
				},
				error: () => this.errorMessages.set(['We could not load your details. Please refresh the page.'])
			});
	}

	canRemoveApplicant(index: number): boolean {
		return index > 0 && this.applicants.length > this.range.min;
	}

	addApplicant(): void {
		if (this.canAddApplicant) {
			this.applicants.push(this.createApplicant(this.applicants.length, this.hiddenApplicants.shift()));
			this.form.markAsDirty();
		}
	}

	removeApplicant(index: number): void {
		if (this.canRemoveApplicant(index)) {
			this.applicants.removeAt(index);
			this.form.markAsDirty();
		}
	}

	agreeToTerms(): void {
		this.form.controls.termsAccepted.setValue(true);
		this.form.controls.termsAccepted.markAsDirty();
	}

	dateOfBirthMessage(control: AbstractControl): string {
		if (control.hasError('minimumAge')) {
			return 'Every applicant must be 18 or older.';
		}
		if (control.hasError('maximumAge')) {
			return 'Please check the date of birth.';
		}
		if (control.getError('dateOfBirth') === 'future') {
			return "Date of birth can't be in the future.";
		}
		return control.hasError('required') ? 'Please enter a date of birth.' : 'Please enter a valid date.';
	}

	back(): void {
		this.journey.goBack(STEP_PATHS.aboutYou);
	}

	submit(): void {
		this.saved.set(false);
		this.errorMessages.set([]);
		this.form.markAllAsTouched();
		if (this.form.invalid) {
			return;
		}

		this.saving.set(true);
		this.autosave
			.beforeSave()
			.pipe(
				switchMap(() => this.store.saveApplicants(this.toRequest())),
				finalize(() => this.saving.set(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: () => {
					this.form.markAsPristine();
					this.saved.set(!this.journey.goNext(STEP_PATHS.aboutYou));
				},
				error: (error: unknown) => {
					this.errorMessages.set(toErrorMessages(error));
					// Not saved after all: keep the input as a draft again.
					this.autosave.changed();
				}
			});
	}

	/** Draft first (unsaved input wins), then what was saved, then blanks; sized to the loan details answer. */
	private populate(saved: ApplicantsResponse | null): void {
		const draft = this.store.applicantsDraft();
		const source = draft?.applicants ?? saved?.applicants.map((a) => this.toDraft(a)) ?? [];
		const count = Math.min(Math.max(source.length, this.range.min), this.range.max);

		this.applicants.clear({ emitEvent: false });
		for (let index = 0; index < count; index++) {
			this.applicants.push(this.createApplicant(index, source[index]), { emitEvent: false });
		}
		this.hiddenApplicants = source.slice(count);
		this.form.controls.termsAccepted.setValue(
			draft?.termsAccepted ?? saved?.consent.termsVersion === this.config.termsVersion,
			{ emitEvent: false }
		);
	}

	private createApplicant(index: number, value: ApplicantDraft = EMPTY_APPLICANT): ApplicantForm {
		const name = [requiredText, Validators.maxLength(NAME_MAX_LENGTH)];
		return this.fb.group({
			title: new FormControl<Title | null>(value.title, Validators.required),
			firstName: this.fb.control(value.firstName, name),
			lastName: this.fb.control(value.lastName, name),
			email: this.fb.control(
				value.email,
				index === 0 ? [requiredText, emailAddressValidator] : emailAddressValidator
			),
			mobile: this.fb.control(value.mobile, [requiredText, auMobileValidator]),
			dateOfBirth: this.fb.control(value.dateOfBirth, [Validators.required, dateOfBirthValidator(this.clock)])
		});
	}

	/** Everything typed, including applicants hidden by a smaller count, so none is lost. */
	private toDraftValue(): ApplicantsDraft {
		const { applicants, termsAccepted } = this.form.getRawValue();
		return { applicants: [...applicants, ...this.hiddenApplicants], termsAccepted };
	}

	private toDraft(applicant: Applicant): ApplicantDraft {
		const { title, firstName, lastName, email, mobile, dateOfBirth } = applicant;
		return { title, firstName, lastName, email: email ?? '', mobile, dateOfBirth };
	}

	private toRequest(): SaveApplicantsRequest {
		const { applicants, termsAccepted } = this.form.getRawValue();
		return {
			applicants: applicants.map((a) => ({
				title: a.title!,
				firstName: a.firstName.trim(),
				lastName: a.lastName.trim(),
				email: a.email.trim() || null,
				mobile: normaliseAuMobile(a.mobile) ?? a.mobile,
				dateOfBirth: a.dateOfBirth
			})),
			consent: { accepted: termsAccepted, termsVersion: this.config.termsVersion }
		};
	}
}
