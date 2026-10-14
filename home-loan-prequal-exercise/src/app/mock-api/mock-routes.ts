import { HttpRequest } from '@angular/common/http';
import { LoanDetails } from '../core/models/loan-details.model';
import { mockDb } from './mock-db';

export interface MockResult {
	status: number;
	body: unknown;
}

export interface MockRoute {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	path: RegExp;
	handle: (req: HttpRequest<unknown>, params: string[]) => MockResult;
}

const ok = (body: unknown): MockResult => ({ status: 200, body });
const badRequest = (errors: Record<string, string>): MockResult => ({ status: 400, body: { errors } });

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
		handle: (_req, [applicationId]) => ok(mockDb.get<LoanDetails>(`applications/${applicationId}/loan-details`))
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
			mockDb.set(`applications/${applicationId}/loan-details`, details);
			return ok(details);
		}
	}
];
