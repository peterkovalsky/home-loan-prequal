import { HttpRequest } from '@angular/common/http';
import { LoanDetails } from '../core/models/loan-details.model';
import { MockResult, badRequest, checkPrecondition, readResource, writeResource } from './mock-http';

export type { MockResult } from './mock-http';

export interface MockRoute {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	path: RegExp;
	handle: (req: HttpRequest<unknown>, params: string[]) => MockResult;
}

const loanDetailsKey = (applicationId: string) => `applications/${applicationId}/loan-details`;

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
	}
];
