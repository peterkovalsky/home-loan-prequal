import { FormControl } from '@angular/forms';
import { auMobileValidator, dateOfBirthValidator, emailAddressValidator, requiredText } from './applicant.validators';

describe('applicant validators', () => {
	const errorsFor = (validator: (c: FormControl) => unknown, value: unknown) => validator(new FormControl(value));

	it('leaves empty values to Validators.required', () => {
		const dob = dateOfBirthValidator(() => new Date(2026, 9, 14));
		for (const value of [null, '', '  ']) {
			expect(errorsFor(auMobileValidator, value)).toBeNull();
			expect(errorsFor(emailAddressValidator, value)).toBeNull();
			expect(errorsFor(dob, value)).toBeNull();
		}
	});

	it('treats whitespace-only text as missing', () => {
		expect(errorsFor(requiredText, '   ')).toEqual({ required: true });
		expect(errorsFor(requiredText, 'Alex')).toBeNull();
	});

	it('flags an invalid mobile and email', () => {
		expect(errorsFor(auMobileValidator, '0412 34')).toEqual({ auMobile: true });
		expect(errorsFor(auMobileValidator, '0412 345 678')).toBeNull();
		expect(errorsFor(emailAddressValidator, 'alex@')).toEqual({ emailAddress: true });
	});

	it('explains why a date of birth is not accepted', () => {
		const dob = dateOfBirthValidator(() => new Date(2026, 9, 14));

		expect(errorsFor(dob, '2008-10-14')).toBeNull();
		expect(errorsFor(dob, '2008-10-15')).toEqual({ minimumAge: { required: 18 } });
		expect(errorsFor(dob, '1900-01-01')).toEqual({ maximumAge: { allowed: 120 } });
		expect(errorsFor(dob, '2030-01-01')).toEqual({ dateOfBirth: 'future' });
		expect(errorsFor(dob, '2023-02-30')).toEqual({ dateOfBirth: 'invalid' });
	});
});
