import { HttpRequest } from '@angular/common/http';
import { AppConfig } from '../core/config/app-config';
import { ApplicantsResponse, SaveApplicantsRequest } from '../core/models/applicant.model';
import { LoanDetails } from '../core/models/loan-details.model';
import { toApplicantsResponse, validateApplicants } from './applicants.mock';
import { mockDb } from './mock-db';
import { MockResult, badRequest, checkPrecondition, problem, readResource, writeResource } from './mock-http';

export type { MockResult } from './mock-http';

export interface MockRoute {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	path: RegExp;
	handle: (req: HttpRequest<unknown>, params: string[], context: MockContext) => MockResult;
}

export interface MockContext {
	config: AppConfig;
	now: Date;
}

const loanDetailsKey = (applicationId: string) => `applications/${applicationId}/loan-details`;
const applicantsKey = (applicationId: string) => `applications/${applicationId}/applicants`;

function validateLoanDetails(details: LoanDetails): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!details.loanAmount || details.loanAmount <= 0) {
		errors['loanAmount'] = 'Loan amount must be greater than zero.';
	}
	if (details.numberOfDependants < 0) {
		errors['numberOfDependants'] = 'Number of dependants cannot be negative.';
	}
	return errors;
}

export const MOCK_ROUTES: MockRoute[] = [
	{
		method: 'GET',
		path: /^\/api\/applications\/(\d+)\/loan-details$/,
		handle: (_req, [applicationId]) => readResource(loanDetailsKey(applicationId))
	},
	{
		method: 'PUT',
		path: /^\/api\/applications\/(\d+)\/loan-details$/,
		handle: (req, [applicationId]) => {
			const details = { ...(req.body as LoanDetails), applicationId: Number(applicationId) };
			const errors = validateLoanDetails(details);
			if (Object.keys(errors).length) {
				return badRequest(errors);
			}
			return (
				checkPrecondition(req, loanDetailsKey(applicationId)) ??
				writeResource(loanDetailsKey(applicationId), details)
			);
		}
	},
	{
		method: 'GET',
		path: /^\/api\/applications\/(\d+)\/applicants$/,
		handle: (_req, [applicationId]) => readResource(applicantsKey(applicationId))
	},
	{
		method: 'PUT',
		path: /^\/api\/applications\/(\d+)\/applicants$/,
		handle: (req, [applicationId], { config, now }) => {
			const loanDetails = mockDb.get<LoanDetails>(loanDetailsKey(applicationId));
			if (!loanDetails) {
				return problem(409, 'Loan details required', 'Save your loan details before adding applicants.');
			}
			const request = req.body as SaveApplicantsRequest;
			const errors = validateApplicants(request, loanDetails, config, now);
			if (Object.keys(errors).length) {
				return badRequest(errors);
			}
			const key = applicantsKey(applicationId);
			const previous = mockDb.get<ApplicantsResponse>(key);
			return (
				checkPrecondition(req, key) ??
				writeResource(key, toApplicantsResponse(Number(applicationId), request, previous, now))
			);
		}
	}
];
