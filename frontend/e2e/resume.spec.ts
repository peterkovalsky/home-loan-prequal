import { Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { ALEX, agreeToTerms, applicant, choose, completeLoanDetails, fillApplicant, setUpJourney } from './journey';

/**
 * Closing the browser and coming back: a new browser context that carries over only what a real
 * browser keeps (cookies and localStorage). Against a real API the answers come back from the
 * server; against the mock, from the mock's own storage.
 */
async function reopen(browser: Browser, context: BrowserContext): Promise<{ context: BrowserContext; page: Page }> {
	const storageState = await context.storageState();
	await context.close();
	const reopened = await browser.newContext({ storageState });
	await setUpJourney(reopened);
	return { context: reopened, page: await reopened.newPage() };
}

test.describe('Coming back later', () => {
	test.beforeEach(({ page }) => setUpJourney(page));

	test('a half-filled, not yet valid Loan details is there after closing the browser', async ({ browser, page }) => {
		await page.goto('/loan-details');
		await page.getByLabel("What's the plan?").selectOption({ label: 'Refinance' });
		await choose(page, 'Investment');
		await page.getByLabel('Borrowing how much?').fill('420000');
		await expect(page.getByText('Progress saved')).toBeVisible();

		const { context, page: again } = await reopen(browser, page.context());
		await again.goto('/');

		await expect(again).toHaveURL(/\/loan-details$/);
		await expect(again.getByLabel("What's the plan?")).toHaveValue(/.+/);
		await expect(again.getByLabel("What's the plan?").locator('option:checked')).toHaveText('Refinance');
		await expect(again.getByLabel('Borrowing how much?')).toHaveValue('420000');
		await expect(again.getByLabel('Estimated property value')).toHaveValue('');
		await context.close();
	});

	test('a returning customer lands on About you with what they had typed', async ({ browser, page }) => {
		await completeLoanDetails(page, 'Two of us');
		await applicant(page, 1).getByLabel('First name').fill('Alex');
		await applicant(page, 2).getByLabel('Last name').fill('Taylor');
		await expect(page.getByText('Progress saved')).toBeVisible();

		const { context, page: again } = await reopen(browser, page.context());
		await again.goto('/');

		await expect(again).toHaveURL(/\/about-you$/);
		await expect(applicant(again, 1).getByLabel('First name')).toHaveValue('Alex');
		await expect(applicant(again, 2).getByLabel('Last name')).toHaveValue('Taylor');
		await context.close();
	});

	test('a submitted application opens on the completion screen', async ({ browser, page }) => {
		await completeLoanDetails(page, 'Just me');
		await fillApplicant(page, 1, ALEX);
		await agreeToTerms(page);
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page).toHaveURL(/\/complete$/);

		const { context, page: again } = await reopen(browser, page.context());
		await again.goto('/');

		await expect(again).toHaveURL(/\/complete$/);
		await expect(again.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
		await context.close();
	});

	test('the completion screen is only for a submitted application', async ({ page }) => {
		await page.goto('/complete');
		await expect(page).toHaveURL(/\/loan-details$/);
	});

	test('"Not you? Start a new application" starts from a blank form', async ({ page }) => {
		await page.goto('/loan-details');
		await page.getByLabel('Borrowing how much?').fill('420000');
		await expect(page.getByText('Progress saved')).toBeVisible();

		await page.getByRole('button', { name: 'Not you? Start a new application' }).click();

		await expect(page).toHaveURL(/\/loan-details$/);
		await expect(page.getByLabel('Borrowing how much?')).toHaveValue('');
		await expect(page.getByRole('button', { name: 'Not you? Start a new application' })).toHaveCount(0);
	});
});
