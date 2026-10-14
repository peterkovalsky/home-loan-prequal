import { APIRequestContext, Locator, Page, expect } from '@playwright/test';

export type ApplicantsAnswer = 'Just me' | 'Two of us' | 'More than two';

export interface ApplicantInput {
	title: string;
	firstName: string;
	lastName: string;
	email?: string;
	mobile: string;
	dateOfBirth: string;
}

export const ALEX: ApplicantInput = {
	title: 'Mr',
	firstName: 'Alex',
	lastName: 'Taylor',
	email: 'alex.taylor@example.com',
	mobile: '0412 345 678',
	dateOfBirth: '1988-03-14'
};

export const JORDAN: ApplicantInput = {
	title: 'Ms',
	firstName: 'Jordan',
	lastName: 'Taylor',
	mobile: '+61 498 765 432',
	dateOfBirth: '1990-07-02'
};

/** The Bootstrap toggle buttons hide the radio input, so click its visible label. */
async function choose(page: Page, label: string): Promise<void> {
	await page.locator('label.btn', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).click();
}

export async function completeLoanDetails(page: Page, applicants: ApplicantsAnswer): Promise<void> {
	await page.goto('/loan-details');
	await page.getByLabel("What's the plan?").selectOption({ label: 'Refinance' });
	await choose(page, 'To live in');
	await choose(page, applicants);
	if (applicants !== 'Just me') {
		await choose(page, 'Yes');
	}
	await page.getByLabel('Borrowing how much?').fill('500000');
	await page.getByLabel('Estimated property value').fill('900000');
	await page.getByLabel('In which state?').selectOption({ label: 'NSW' });
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page).toHaveURL(/\/about-you$/);
}

export function applicant(page: Page, number: number): Locator {
	return page.getByRole('group', { name: `Applicant ${number}` });
}

export async function fillApplicant(page: Page, number: number, input: ApplicantInput): Promise<void> {
	const section = applicant(page, number);
	await section.getByLabel('Title').selectOption({ label: input.title });
	await section.getByLabel('First name').fill(input.firstName);
	await section.getByLabel('Last name').fill(input.lastName);
	await section.getByLabel('Email').fill(input.email ?? '');
	await section.getByLabel('Mobile').fill(input.mobile);
	await section.getByLabel('Date of birth').fill(input.dateOfBirth);
}

export async function agreeToTerms(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'pre-qualification and privacy terms' }).click();
	const dialog = page.getByRole('dialog', { name: 'Pre-qualification and privacy terms' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'I agree' }).click();
	await expect(dialog).toBeHidden();
}

/**
 * Against the real API (E2E_CONFIGURATION=local-api) application 1 persists between tests, so delete
 * it first. Against the mock each test already gets a fresh browser context, and so fresh localStorage.
 */
export async function resetApplication(request: APIRequestContext): Promise<void> {
	if (process.env['E2E_CONFIGURATION'] === 'local-api') {
		const response = await request.delete('/api/applications/1');
		expect(response.status()).toBe(204);
	}
}
