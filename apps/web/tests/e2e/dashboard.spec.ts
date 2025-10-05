import { expect, test } from '@playwright/test';

async function authenticate(page) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('API token').fill('demo-token');
  await page.getByLabel('Email').fill('qa@localoffice.dev');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Connected')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('admin can configure programs and approve orders', async ({ page }) => {
  await page.goto('/admin');
  await authenticate(page);

  await expect(page.getByText('Program builder')).toBeVisible();

  const serviceDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const windowStart = new Date(serviceDate.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(serviceDate.getTime() + 60 * 60 * 1000);
  const formatInput = (date: Date) => date.toISOString().slice(0, 16);

  await page.getByLabel('Program name').fill('Playwright Launch');
  await page.getByLabel('Provider ID').fill('provider-playwright');
  await page.getByLabel('Cadence').fill('One-time');
  await page.getByLabel('Ordering window').fill('8a-12p');
  await page.getByLabel('Cutoff hours').fill('24');
  await page.getByLabel('Subsidy rule').fill('$20 per employee');
  await page.getByLabel('Service date').fill(formatInput(serviceDate));
  await page.getByLabel('Window start').fill(formatInput(windowStart));
  await page.getByLabel('Window end').fill(formatInput(windowEnd));
  await page.getByRole('button', { name: 'Save program' }).click();

  await expect(page.getByText('Program saved successfully', { exact: false })).toBeVisible();
  await expect(page.getByText('Playwright Launch')).toBeVisible();

  // Approve the seeded pending order
  const confirmButton = page.getByRole('button', { name: 'Confirm order' }).first();
  await confirmButton.click();
  await expect(page.getByText('No approvals pending', { exact: false })).toBeVisible();
});

test('employee can place an order against upcoming program slots', async ({ page }) => {
  await page.goto('/employee');
  await authenticate(page);

  await expect(page.getByText('Place an order')).toBeVisible();
  await page.getByLabel('Program slot').selectOption({ index: 1 });
  await page.getByLabel('Menu item SKU').fill('playwright-panini');
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel('Order notes').fill('Testing automation lunch');
  await page.getByRole('button', { name: 'Submit order' }).click();

  await expect(page.getByText('Order submitted!', { exact: false })).toBeVisible();
  await expect(page.getByText('playwright-panini')).toBeVisible();
});

test('provider reviews manifests and files incidents', async ({ page }) => {
  await page.goto('/provider');
  await authenticate(page);

  await expect(page.getByText('Upcoming batches')).toBeVisible();
  await page.getByRole('button', { name: 'Manifest' }).first().click();
  await expect(page.getByText('Manifest URL', { exact: false })).toBeVisible();

  await page.getByLabel('Category').selectOption('QUALITY');
  await page.getByLabel('Severity').selectOption('HIGH');
  await page.getByLabel('Order ID').fill('order-qa');
  await page.getByLabel('Batch ID').fill('batch-qa');
  await page.getByLabel('Description').fill('Meals arrived without utensils.');
  await page.getByRole('button', { name: 'Submit incident' }).click();

  await expect(page.getByText('Incident logged', { exact: false })).toBeVisible();
  await expect(page.getByText('Meals arrived without utensils.')).toBeVisible();
});
