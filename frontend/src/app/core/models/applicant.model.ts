import { Title } from './reference-data';

export interface Applicant {
	title: Title;
	firstName: string;
	lastName: string;
	/** Required for the primary applicant (ordinal 1), optional for the rest. */
	email: string | null;
	/** Normalised Australian mobile, `04XXXXXXXX`. */
	mobile: string;
	/** ISO calendar date, `yyyy-MM-dd`. */
	dateOfBirth: string;
}

export interface SavedApplicant extends Applicant {
	id: number;
	/** 1-based position; 1 is the primary applicant. */
	ordinal: number;
}

export interface Consent {
	accepted: boolean;
	termsVersion: string;
}

/** PUT body. Replaces the whole set: array order is the applicant order. */
export interface SaveApplicantsRequest {
	applicants: Applicant[];
	consent: Consent;
}

export interface ApplicantsResponse {
	applicationId: number;
	applicants: SavedApplicant[];
	consent: { termsVersion: string; acceptedAt: string };
}

/** Unsaved About you input, held in memory so Back (or any navigation) never loses it. */
export interface ApplicantDraft {
	title: Title | null;
	firstName: string;
	lastName: string;
	email: string;
	mobile: string;
	dateOfBirth: string;
}

export interface ApplicantsDraft {
	applicants: ApplicantDraft[];
	termsAccepted: boolean;
}
