/*
 * Applicant rules as plain functions so the form validators and the mock API share them.
 * The .NET validators mirror these constants and the boundary cases in the specs.
 */

export const MIN_APPLICANT_AGE = 18;
export const MAX_APPLICANT_AGE = 120;
export const NAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 254;

const AU_MOBILE = /^04\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Accepts the ways people type an Australian mobile (`0412 345 678`, `+61 412 345 678`,
 * `61412345678`, `(04) 1234-5678`) and returns it as `04XXXXXXXX`, or `null` if it isn't one.
 */
export function normaliseAuMobile(raw: string | null | undefined): string | null {
	if (!raw) {
		return null;
	}
	const digits = raw
		.replace(/[\s\-().]/g, '')
		.replace(/^\+?61/, '0')
		.replace(/^00/, '0');
	return AU_MOBILE.test(digits) ? digits : null;
}

export function isValidAuMobile(raw: string | null | undefined): boolean {
	return normaliseAuMobile(raw) !== null;
}

export function isValidEmail(raw: string | null | undefined): boolean {
	const email = raw?.trim() ?? '';
	return email.length <= EMAIL_MAX_LENGTH && EMAIL.test(email);
}

/**
 * Parses `yyyy-MM-dd` as a local calendar date. `new Date('1990-01-01')` would parse as UTC
 * and land on the previous day in timezones behind UTC. Rejects impossible dates such as 2023-02-30.
 */
export function parseIsoDate(value: string | null | undefined): Date | null {
	const match = value ? ISO_DATE.exec(value) : null;
	if (!match) {
		return null;
	}
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Whole years between the date of birth and `today`, or `null` if the date is invalid. */
export function ageOn(dateOfBirth: string | null | undefined, today: Date): number | null {
	const dob = parseIsoDate(dateOfBirth);
	if (!dob) {
		return null;
	}
	const hadBirthdayThisYear =
		today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
	return today.getFullYear() - dob.getFullYear() - (hadBirthdayThisYear ? 0 : 1);
}

export type DateOfBirthProblem = 'invalid' | 'future' | 'underage' | 'tooOld';

export function dateOfBirthProblem(dateOfBirth: string | null | undefined, today: Date): DateOfBirthProblem | null {
	const age = ageOn(dateOfBirth, today);
	if (age === null) {
		return 'invalid';
	}
	if (parseIsoDate(dateOfBirth)! > today) {
		return 'future';
	}
	if (age < MIN_APPLICANT_AGE) {
		return 'underage';
	}
	return age > MAX_APPLICANT_AGE ? 'tooOld' : null;
}

export function toIsoDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
