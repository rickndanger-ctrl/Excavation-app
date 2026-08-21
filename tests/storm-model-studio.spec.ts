import { expect, test } from '@playwright/test';
import path from 'node:path';

const planFixture = path.resolve('fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf');
async function importPlans(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await chooser).setFiles(planFixture);
}
async function approveStudio(page: import('@playwright/test').Page, button: string, count: number, reviewerLabel: string, publishButton: string) {
  await expect(page.getByRole('button', { name: button })).toBeVisible();
  await page.getByRole('button', { name: button }).click();
  const cards = page.locator('.model-studio__candidate');
  await expect(cards).toHaveCount(count);
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const kind = await card.getAttribute('data-kind');
    await card.getByRole('radio', { name: kind === 'grading_note' ? 'Reject' : 'Approve' }).check();
  }
  await page.getByLabel(reviewerLabel).fill('Richard review');
  await page.getByRole('button', { name: publishButton }).click();
}

test('reviews and publishes survey-backed storm structures for offline phone use', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await importPlans(page);
  await approveStudio(page, 'Open Model Studio', 22, 'Reviewer name', 'Publish approved grading layer');
  await importPlans(page);
  await approveStudio(page, 'Open Sanitary Studio', 4, 'Sanitary reviewer name', 'Publish approved sanitary layer');
  await importPlans(page);

  await page.getByRole('button', { name: 'Open Storm Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Storm Studio' })).toBeVisible();
  await expect(page.getByText('Topographic Survey · PDF page 2')).toBeVisible();
  await expect(page.getByText('9 storm structure candidates')).toBeVisible();
  await expect(page.locator('.storm-studio__pending-pipe')).toHaveCount(2);
  await expect(page.locator('.storm-studio__excluded')).toHaveCount(3);
  await expect(page.locator('[data-symbol="storm-manhole"]')).toBeVisible();
  await expect(page.locator('[data-symbol="storm-catch-basin"]')).toBeVisible();
  const stormCards = page.locator('.storm-studio__candidate');
  for (let i = 0; i < 9; i += 1) await stormCards.nth(i).getByRole('radio', { name: 'Approve' }).check();
  await page.getByLabel('Storm reviewer name').fill('Richard storm review');
  await page.getByRole('button', { name: 'Publish approved storm layer' }).click();

  await expect(page.getByRole('status')).toContainText('reading-public-library-grading-sanitary-storm-v3');
  await expect(page.locator('.plan-canvas__pdf')).toHaveCount(0);
  await expect(page.locator('.storm-symbol--manhole')).toHaveCount(7);
  await expect(page.locator('.storm-symbol--catch-basin')).toHaveCount(2);
  await expect(page.locator('.storm-line')).toHaveCount(0);
  const objects = page.locator('.plan-object[data-layer-id="storm"]');
  await expect(objects).toHaveCount(9);
  expect(await objects.locator('.plan-object-hit-target').evaluateAll((targets) => targets.every((target) => {
    const box = target.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth;
  }))).toBe(true);

  const visibleLabels = objects.locator('.grading-map-label');
  expect(await visibleLabels.evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.every((box) => box.left >= 8 && box.right <= innerWidth - 8)
      && boxes.every((box, i) => boxes.slice(i + 1).every((other) => box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top));
  })).toBe(true);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByText('Storm', { exact: true }).click();
  await expect(objects).toHaveCount(0);
  await page.getByText('Storm', { exact: true }).click();
  await expect(objects).toHaveCount(9);
  await page.getByText('Grading', { exact: true }).click();
  await page.getByText('Sanitary', { exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID or name/).fill('storm ceptor');
  await page.getByPlaceholder(/Search by ID or name/).press('Enter');
  await expect(page.getByText('Reference-derived', { exact: true })).toBeVisible();
  await expect(page.getByText('Medium confidence', { exact: true })).toBeVisible();
  await expect(page.getByText('140.80', { exact: true })).toBeVisible();
  const approximationWarning = page.getByText(/Approximate survey surface evidence/);
  await expect(approximationWarning).toBeVisible();
  await approximationWarning.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('reading-storm-phone-offline-detail.png'), fullPage: true });
  await page.locator('.field-sheet__handle').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('reading-storm-phone-offline.png'), fullPage: true });
});
