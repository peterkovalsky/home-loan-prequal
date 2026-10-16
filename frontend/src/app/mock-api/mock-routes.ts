import { HttpRequest } from '@angular/common/http';
import { AppConfig } from '../core/config/app-config';
import { ApplicantsResponse, SaveApplicantsRequest } from '../core/models/applicant.model';
import { LoanDetails } from '../core/models/loan-details.model';
import { toApplicantsResponse, validateApplicants } from './applicants.mock';
import { APPLICATION_TOKEN_HEADER } from '../core/session/application-session';
import { mockDb } from './mock-db';
import { MockResult, badRequest, checkPrecondition, ok, problem, readResource, writeResource } from './mock-http';

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

const applicationKey = (applicationId: string) => `applications/${applicationId}`;
const loanDetailsKey = (applicationId: string) => `applications/${applicationId}/loan-details`;
const applicantsKey = (applicationId: string) => `applications/${applicationId}/applicants`;
const draftKey = (applicationId: string, step: string) => `applications/${applicationId}/drafts/${step}`;
const DRAFT_STEPS = ['loan-details', 'about-you'];
const FIRST_APPLICATION_ID = 1_000_000;

/** As the API does it: only the token the application was created with opens it; otherwise 404. */
function refuseWithoutToken(req: HttpRequest<unknown>, applicationId: string): MockResult | null {
	const application = mockDb.get<{ token: string }>(applicationKey(applicationId));
	return application && req.headers.get(APPLICATION_TOKEN_HEADER) === application.token
		? null
		: problem(404, 'Not found', 'Application not found.');
}

/** A successful save replaces the step's draft, as the API does in the same transaction. */
function clearingDraft(applicationId: string, step: string, result: MockResult): MockResult {
	if (result.status < 400) {
		mockDb.remove(draftKey(applicationId, step));
	}
	return result;
}

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
		method: 'POST',
		path: /^\/api\/applications$/,
		handle: () => {
			const id = mockDb.get<number>('next-application-id') ?? FIRST_APPLICATION_ID;
			mockDb.set('next-application-id', id + 1);
			const token = crypto.randomUUID();
			mockDb.set(applicationKey(String(id)), { token });
			return { status: 201, body: { id, resumeToken: token } };
		}
	},
	{
		method: 'GET',
		path: /^\/api\/applications\/(\d+)\/drafts$/,
		handle: (req, [applicationId]) =>
			refuseWithoutToken(req, applicationId) ??
			ok(
				Object.fromEntries(
					DRAFT_STEPS.map((step) => [step, mockDb.get(draftKey(applicationId, step))]).filter(([, d]) => d)
				)
			)
	},
	{
		method: 'PUT',
		path: /^\/api\/applications\/(\d+)\/drafts\/([a-z-]+)$/,
		handle: (req, [applicationId, step]) => {
			const refused = refuseWithoutToken(req, applicationId);
			if (refused) {
				return refused;
			}
			if (!DRAFT_STEPS.includes(step)) {
				return problem(404, 'Not found', `There is no step called '${step}'.`);
			}
			if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
				return badRequest({ draft: 'A draft must be a JSON object.' });
			}
			mockDb.set(draftKey(applicationId, step), { data: req.body, updatedAt: new Date().toISOString() });
			return { status: 204, body: null };
		}
	},
	{
		method: 'GET',
		path: /^\/api\/applications\/(\d+)\/loan-details$/,
		handle: (req, [applicationId]) =>
			refuseWithoutToken(req, applicationId) ?? readResource(loanDetailsKey(applicationId))
	},
	{
		method: 'PUT',
		path: /^\/api\/applications\/(\d+)\/loan-details$/,
		handle: (req, [applicationId]) => {
			const refused = refuseWithoutToken(req, applicationId);
			if (refused) {
				return refused;
			}
			const details = { ...(req.body as LoanDetails), applicationId: Number(applicationId) };
			const errors = validateLoanDetails(details);
			if (Object.keys(errors).length) {
				return badRequest(errors);
			}
			return clearingDraft(
				applicationId,
				'loan-details',
				checkPrecondition(req, loanDetailsKey(applicationId)) ??
					writeResource(loanDetailsKey(applicationId), details)
			);
		}
	},
	{
		method: 'GET',
		path: /^\/api\/applications\/(\d+)\/applicants$/,
		handle: (req, [applicationId]) =>
			refuseWithoutToken(req, applicationId) ?? readResource(applicantsKey(applicationId))
	},
	{
		method: 'PUT',
		path: /^\/api\/applications\/(\d+)\/applicants$/,
		handle: (req, [applicationId], { config, now }) => {
			const refused = refuseWithoutToken(req, applicationId);
			if (refused) {
				return refused;
			}
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
			return clearingDraft(
				applicationId,
				'about-you',
				checkPrecondition(req, key) ??
					writeResource(key, toApplicantsResponse(Number(applicationId), request, previous, now))
			);
		}
	}
];
