import { expect, test } from '@playwright/test';
import { choose, useTestApplication } from './journey';

const TEST_KEY = 'E2E-PUBLIC-KEY';

const SUGGESTIONS = [
	{ id: 'a1', full_address: '1 George Street, SYDNEY NSW 2000', canonical_address_id: 'a1' },
	{ id: 'b2', full_address: '1 George Street, PARRAMATTA NSW 2150', canonical_address_id: 'b2' }
];

test.describe('Loan details', () => {
	test.beforeEach(async ({ page, request }) => {
		await useTestApplication(page, request, { addressFinderKey: TEST_KEY });
		// Registered last, so it wins over the block: canned Addressfinder answers, never the real service.
		await page.route('https://api.addressfinder.io/api/au/address/autocomplete/**', (route) => {
			const key = new URL(route.request().url()).searchParams.get('key');
			return key === TEST_KEY
				? route.fulfill({ json: { success: true, completions: SUGGESTIONS } })
				: route.fulfill({ status: 400, json: { success: false, message: `Unexpected key ${key}` } });
		});
	});

	test('suggests the property address and saves the one picked', async ({ page }) => {
		await page.goto('/loan-details');
		await page.getByLabel("What's the plan?").selectOption({ label: 'Refinance' });
		await choose(page, 'To live in');
		await choose(page, 'Just me');
		await page.getByLabel('Borrowing how much?').fill('500000');
		await page.getByLabel('Estimated property value').fill('900000');
		await page.getByLabel('I know the address of the property').check();

		const address = page.getByRole('combobox', { name: 'Property address' });
		const suggestions = page.locator('#address-suggestions').getByRole('option');
		await address.pressSequentially('1 george', { delay: 20 });
		await expect(suggestions).toHaveText(SUGGESTIONS.map((s) => s.full_address));
		await address.press('ArrowDown');
		await address.press('ArrowDown');
		await address.press('Enter');
		await expect(address).toHaveValue('1 George Street, PARRAMATTA NSW 2150');
		await expect(suggestions).toHaveCount(0);

		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page).toHaveURL(/\/about-you$/);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('combobox', { name: 'Property address' })).toHaveValue(
			'1 George Street, PARRAMATTA NSW 2150'
		);
	});
});
