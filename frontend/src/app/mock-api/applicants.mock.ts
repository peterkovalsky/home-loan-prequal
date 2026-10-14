import { Applicant, ApplicantsResponse, SaveApplicantsRequest } from '../core/models/applicant.model';
import { LoanDetails } from '../core/models/loan-details.model';
import { Title } from '../core/models/reference-data';
import { AppConfig } from '../core/config/app-config';
import { applicantCountRange } from '../shared/validation/applicant-count';
import {
	NAME_MAX_LENGTH,
	dateOfBirthProblem,
	isValidEmail,
	normaliseAuMobile
} from '../shared/validation/applicant-rules';

const TITLES = new Set<number>(Object.values(Title).filter((v): v is number => typeof v === 'number'));

const DOB_MESSAGES = {
	invalid: 'enter a valid date of birth.',
	future: 'date of birth cannot be in the future.',
	underage: 'every applicant must be 18 or older.',
	tooOld: 'check the date of birth.'
};

/** Server-side rules for PUT /applicants. Field keys look like `applicants[1].mobile`. */
export function validateApplicants(
	request: Partial<SaveApplicantsRequest> | null,
	loanDetails: LoanDetails,
	config: AppConfig,
	today: Date
): Record<string, string> {
	const errors: Record<string, string> = {};
	const applicants = Array.isArray(request?.applicants) ? request.applicants : null;
	const range = applicantCountRange(loanDetails.numberOfApplicants, config.maxApplicants);

	if (!applicants || applicants.length < range.min || applicants.length > range.max) {
		errors['applicants'] =
			range.min === range.max
				? `Expected ${range.min} applicant(s) to match your loan details.`
				: `Expected between ${range.min} and ${range.max} applicants to match your loan details.`;
	}

	(applicants ?? []).forEach((applicant, index) => {
		const label = `Applicant ${index + 1}`;
		const key = (field: keyof Applicant) => `applicants[${index}].${field}`;
		const name = (value: unknown) =>
			typeof value === 'string' && value.trim().length > 0 && value.trim().length <= NAME_MAX_LENGTH;

		if (!TITLES.has(applicant?.title)) {
			errors[key('title')] = `${label}: choose a title.`;
		}
		if (!name(applicant?.firstName)) {
			errors[key('firstName')] = `${label}: enter a first name (up to ${NAME_MAX_LENGTH} characters).`;
		}
		if (!name(applicant?.lastName)) {
			errors[key('lastName')] = `${label}: enter a last name (up to ${NAME_MAX_LENGTH} characters).`;
		}
		if (applicant?.email ? !isValidEmail(applicant.email) : index === 0) {
			errors[key('email')] = `${label}: enter a valid email address.`;
		}
		if (!normaliseAuMobile(applicant?.mobile)) {
			errors[key('mobile')] = `${label}: enter a valid Australian mobile number.`;
		}
		const dobProblem = dateOfBirthProblem(applicant?.dateOfBirth, today);
		if (dobProblem) {
			errors[key('dateOfBirth')] = `${label}: ${DOB_MESSAGES[dobProblem]}`;
		}
	});

	if (request?.consent?.accepted !== true) {
		errors['consent'] = 'You must agree to the pre-qualification and privacy terms.';
	} else if (request.consent.termsVersion !== config.termsVersion) {
		errors['consent'] = 'Please agree to the latest pre-qualification and privacy terms.';
	}

	return errors;
}

/** Normalises the request into what the server stores. Keeps ids stable per position, as the API's MERGE will. */
export function toApplicantsResponse(
	applicationId: number,
	request: SaveApplicantsRequest,
	previous: ApplicantsResponse | null,
	now: Date
): ApplicantsResponse {
	const sameTerms = previous?.consent.termsVersion === request.consent.termsVersion;
	return {
		applicationId,
		applicants: request.applicants.map((applicant, index) => ({
			id: applicationId * 100 + index + 1,
			ordinal: index + 1,
			title: applicant.title,
			firstName: applicant.firstName.trim(),
			lastName: applicant.lastName.trim(),
			email: applicant.email?.trim() || null,
			mobile: normaliseAuMobile(applicant.mobile)!,
			dateOfBirth: applicant.dateOfBirth
		})),
		consent: {
			termsVersion: request.consent.termsVersion,
			acceptedAt: sameTerms ? previous.consent.acceptedAt : now.toISOString()
		}
	};
}
