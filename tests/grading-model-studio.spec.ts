import { expect, test } from '@playwright/test';
import path from 'node:path';

const planFixture = path.resolve('fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf');

test('reviews, publishes, and uses the L2.1 grading layer offline on a phone', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await chooser).setFiles(planFixture);

  await expect(page.getByRole('button', { name: 'Open Model Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Model Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Model Studio' })).toBeVisible();
  await expect(page.getByText('22 grading candidates')).toBeVisible();
  await expect(page.getByText('NOT FOR CONSTRUCTION')).toBeVisible();

  const cards = page.locator('.model-studio__candidate');
  await expect(cards).toHaveCount(22);
  for (let index = 0; index < 22; index += 1) {
    const card = cards.nth(index);
    if (await card.getAttribute('data-kind') === 'grading_note') {
      await card.getByRole('radio', { name: 'Reject' }).check();
    } else {
      await card.getByRole('radio', { name: 'Approve' }).check();
    }
  }
  await page.getByLabel('Reviewer name').fill('Richard review');
  await page.getByRole('button', { name: 'Publish approved grading layer' }).click();

  await expect(page.getByRole('status')).toContainText('Version reading-public-library-l2.1-grading-v1');
  await expect(page.getByText('Source PDF excluded from offline package')).toBeVisible();
  await expect(page.locator('.plan-canvas__pdf')).toHaveCount(0);
  await expect(page.locator('.plan-object')).toHaveCount(20);
  await expect.poll(async () => page.locator('.plan-object').evaluateAll((objects) => objects.filter((object) => {
    const box = object.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 140 && box.bottom <= innerHeight - 40;
  }).length)).toBeGreaterThanOrEqual(15);
  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID or name/).fill('Slope 4.9%');
  await page.getByPlaceholder(/Search by ID or name/).press('Enter');
  await expect(page.getByText('Reference-derived', { exact: true })).toBeVisible();
  await expect(page.getByText('High confidence', { exact: true })).toBeVisible();
  await page.locator('.field-sheet__handle').click();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('Grading', { exact: true })).toBeVisible();
  await page.getByText('Grading', { exact: true }).click();
  await expect(page.locator('.plan-object')).toHaveCount(0);
  await page.getByText('Grading', { exact: true }).click();
  await expect(page.locator('.plan-object')).toHaveCount(20);
  await page.getByRole('button', { name: 'Close' }).click();

  const snapshot = await page.evaluate(() => ({
    width: window.innerWidth,
    packageVersion: localStorage.getItem('excavation-field-map:semantic-package:active'),
    storedSourcePdf: Object.values(localStorage).some((value) => value.startsWith('blob:') || value.includes('%PDF')),
  }));
  expect(snapshot).toEqual({
    width: 390,
    packageVersion: 'reading-public-library-l2.1-grading-v1',
    storedSourcePdf: false,
  });
  await page.screenshot({ path: testInfo.outputPath('reading-l21-grading-phone-offline.png'), fullPage: true });
});
