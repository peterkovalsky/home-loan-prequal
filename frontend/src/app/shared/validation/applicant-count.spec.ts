import { NumberOfApplicants } from '../../core/models/reference-data';
import { applicantCountRange } from './applicant-count';

describe('applicantCountRange', () => {
	it('maps each answer to the number of applicant sections', () => {
		expect(applicantCountRange(NumberOfApplicants.Single, 4)).toEqual({ min: 1, max: 1 });
		expect(applicantCountRange(NumberOfApplicants.Couple, 4)).toEqual({ min: 2, max: 2 });
		expect(applicantCountRange(NumberOfApplicants.More, 4)).toEqual({ min: 3, max: 4 });
	});

	it('never lets a low configured maximum go below three for "more than two"', () => {
		expect(applicantCountRange(NumberOfApplicants.More, 2)).toEqual({ min: 3, max: 3 });
	});
});
