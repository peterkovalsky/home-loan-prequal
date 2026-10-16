import { expect, test } from '@playwright/test';
import { ALEX, JORDAN, agreeToTerms, applicant, completeLoanDetails, fillApplicant, setUpJourney } from './journey';

test.describe('About you', () => {
	test.beforeEach(({ page }) => setUpJourney(page));

	test('two applicants can complete the step', async ({ page }) => {
		await completeLoanDetails(page, 'Two of us');

		await expect(applicant(page, 1).getByText('Primary')).toBeVisible();
		await expect(applicant(page, 2).getByText('Shown because you said two of you are applying')).toBeVisible();
		await fillApplicant(page, 1, ALEX);
		await fillApplicant(page, 2, JORDAN);
		await agreeToTerms(page);
		await page.getByRole('button', { name: 'Continue' }).click();

		// Saving the last step submits the application.
		await expect(page).toHaveURL(/\/complete$/);
		await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
		await expect(page.getByText('Thanks, Alex.')).toBeVisible();
		await expect(page.getByText(/Your reference is HL-\d+/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'About you (completed)' })).toBeVisible();

		await page.reload();
		await expect(page).toHaveURL(/\/complete$/);
		await page.getByRole('link', { name: 'About you (completed)' }).click();
		await expect(applicant(page, 2).getByLabel('Mobile')).toHaveValue('0498765432');
		await expect(page.getByRole('checkbox', { name: /I agree to the pre-qualification/ })).toBeChecked();
	});

	test('after submitting, "Start a new application" gives a blank Loan details', async ({ page }) => {
		await completeLoanDetails(page, 'Just me');
		await fillApplicant(page, 1, ALEX);
		await agreeToTerms(page);
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();

		await page.getByRole('button', { name: 'Start a new application', exact: true }).click();

		await expect(page).toHaveURL(/\/loan-details$/);
		await expect(page.getByLabel('Borrowing how much?')).toHaveValue('');
		await expect(page.getByRole('link', { name: 'Loan details (completed)' })).toHaveCount(0);
	});

	test('Back keeps what the customer has typed', async ({ page }) => {
		await completeLoanDetails(page, 'Two of us');
		await fillApplicant(page, 1, ALEX);
		await applicant(page, 2).getByLabel('First name').fill('Jordan');

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/loan-details$/);
		await expect(page.getByLabel('Borrowing how much?')).toHaveValue('500000');
		await page.getByRole('button', { name: 'Continue' }).click();

		await expect(applicant(page, 1).getByLabel('First name')).toHaveValue('Alex');
		await expect(applicant(page, 1).getByLabel('Date of birth')).toHaveValue('1988-03-14');
		await expect(applicant(page, 2).getByLabel('First name')).toHaveValue('Jordan');
	});

	test('explains what needs fixing before it can continue', async ({ page }) => {
		await completeLoanDetails(page, 'Two of us');
		await fillApplicant(page, 1, ALEX);
		await fillApplicant(page, 2, { ...JORDAN, mobile: '0412 34', dateOfBirth: '2015-01-01' });

		await page.getByRole('button', { name: 'Continue' }).click();

		await expect(applicant(page, 2).getByText('Enter a valid Australian mobile number')).toBeVisible();
		await expect(applicant(page, 2).getByText('Every applicant must be 18 or older.')).toBeVisible();
		await expect(page.getByText('Please agree to the terms to continue.')).toBeVisible();
		await expect(applicant(page, 1).locator('.invalid-feedback:visible')).toHaveCount(0);
		await expect(page).toHaveURL(/\/about-you$/);
	});

	test('the primary applicant must give an email; others may leave it out', async ({ page }) => {
		await completeLoanDetails(page, 'Two of us');
		await fillApplicant(page, 1, { ...ALEX, email: '' });
		await fillApplicant(page, 2, JORDAN);
		await agreeToTerms(page);

		await page.getByRole('button', { name: 'Continue' }).click();

		await expect(applicant(page, 1).getByText('Please enter an email address.')).toBeVisible();
		await expect(applicant(page, 2).getByText('Please enter an email address.')).toHaveCount(0);
	});

	test('"More than two" starts at three and allows one more', async ({ page }) => {
		await completeLoanDetails(page, 'More than two');
		await expect(page.getByRole('group', { name: /^Applicant \d$/ })).toHaveCount(3);

		await page.getByRole('button', { name: '+ Add another applicant' }).click();
		await expect(page.getByRole('group', { name: /^Applicant \d$/ })).toHaveCount(4);
		await expect(page.getByRole('button', { name: '+ Add another applicant' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Remove applicant 4' }).click();
		await expect(page.getByRole('group', { name: /^Applicant \d$/ })).toHaveCount(3);
		await expect(page.getByRole('button', { name: /Remove applicant/ })).toHaveCount(0);
	});

	test('opening About you before Loan details sends the customer back to step 1', async ({ page }) => {
		await page.goto('/about-you');

		await expect(page).toHaveURL(/\/loan-details$/);
		await expect(page.getByRole('heading', { name: "Let's start with your loan" })).toBeVisible();
	});
});
