import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const depositWithinPropertyValueValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
	const deposit = group.get('deposit')?.value as number | null;
	const propertyValue = group.get('estimatedPropertyValue')?.value as number | null;
	if (deposit == null || propertyValue == null) {
		return null;
	}
	return deposit > propertyValue ? { depositExceedsPropertyValue: true } : null;
};
