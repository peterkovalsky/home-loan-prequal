import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
	MAX_APPLICANT_AGE,
	MIN_APPLICANT_AGE,
	dateOfBirthProblem,
	isValidAuMobile,
	isValidEmail
} from '../validation/applicant-rules';

const isEmpty = (value: unknown) => value == null || (typeof value === 'string' && value.trim() === '');

/** Leave "is it filled in?" to Validators.required; these only check the format. */
export const auMobileValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
	isEmpty(control.value) || isValidAuMobile(control.value as string) ? null : { auMobile: true };

export const emailAddressValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
	isEmpty(control.value) || isValidEmail(control.value as string) ? null : { emailAddress: true };

/** `today` is a function so tests can pin the date. */
export function dateOfBirthValidator(today: () => Date = () => new Date()): ValidatorFn {
	return (control: AbstractControl): ValidationErrors | null => {
		if (isEmpty(control.value)) {
			return null;
		}
		const problem = dateOfBirthProblem(control.value as string, today());
		switch (problem) {
			case null:
				return null;
			case 'underage':
				return { minimumAge: { required: MIN_APPLICANT_AGE } };
			case 'tooOld':
				return { maximumAge: { allowed: MAX_APPLICANT_AGE } };
			default:
				return { dateOfBirth: problem };
		}
	};
}
