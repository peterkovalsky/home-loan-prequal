import { NumberOfApplicants } from '../../core/models/reference-data';

export interface ApplicantCountRange {
	min: number;
	max: number;
}

/** "More than two" starts at three applicants and allows up to the configured maximum. */
export function applicantCountRange(
	numberOfApplicants: NumberOfApplicants,
	maxApplicants: number
): ApplicantCountRange {
	switch (numberOfApplicants) {
		case NumberOfApplicants.Single:
			return { min: 1, max: 1 };
		case NumberOfApplicants.Couple:
			return { min: 2, max: 2 };
		case NumberOfApplicants.More:
			return { min: 3, max: Math.max(3, maxApplicants) };
	}
}
