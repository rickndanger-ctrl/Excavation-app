import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve('fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf');
async function importPlans(page: import('@playwright/test').Page) { await page.getByRole('button', { name: 'Menu' }).click(); const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Import Civil Plans' }).click(); await (await chooser).setFiles(fixture); }
async function publish(page: import('@playwright/test').Page, open: string, count: number, reviewer: string, publishLabel: string) {
  await page.getByRole('button', { name: open }).click(); const cards = page.locator('.model-studio__candidate'); await expect(cards).toHaveCount(count);
  for (let i = 0; i < count; i += 1) { const card = cards.nth(i); await card.getByRole('radio', { name: await card.getAttribute('data-kind') === 'grading_note' ? 'Reject' : 'Approve' }).check(); }
  await page.getByLabel(reviewer).fill('Richard review'); await page.getByRole('button', { name: publishLabel }).click();
}

test('reviews and publishes two survey water gates for offline phone use', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:4175');
  await importPlans(page); await publish(page, 'Open Model Studio', 22, 'Reviewer name', 'Publish approved grading layer');
  await importPlans(page); await publish(page, 'Open Sanitary Studio', 4, 'Sanitary reviewer name', 'Publish approved sanitary layer');
  await importPlans(page); await publish(page, 'Open Storm Studio', 9, 'Storm reviewer name', 'Publish approved storm layer');
  await importPlans(page);

  await page.getByRole('button', { name: 'Open Water Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Water Studio' })).toBeVisible();
  await expect(page.getByText('2 water-gate candidates')).toBeVisible();
  await expect(page.locator('.water-studio__excluded')).toHaveCount(3);
  await expect(page.getByText(/Water main geometry is unavailable/)).toBeVisible();
  await expect(page.locator('[data-symbol="water-gate"]')).toBeVisible();
  const cards = page.locator('.water-studio__candidate');
  for (let i = 0; i < 2; i += 1) await cards.nth(i).getByRole('radio', { name: 'Approve' }).check();
  await page.getByLabel('Water reviewer name').fill('Richard water review');
  await page.getByRole('button', { name: 'Publish approved water layer' }).click();

  await expect(page.getByRole('status')).toContainText('reading-public-library-grading-sanitary-storm-water-v4');
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Open Model Studio' })).toHaveCount(0);
  await expect(page.locator('.plan-canvas__pdf')).toHaveCount(0);
  await expect(page.locator('.water-symbol--gate')).toHaveCount(2);
  await expect(page.locator('.water-line')).toHaveCount(0);
  const waterObjects = page.locator('.plan-object[data-layer-id="water"]');
  await expect(waterObjects).toHaveCount(2);
  const targets = await waterObjects.locator('.plan-object-hit-target').evaluateAll((items) => items.map((item) => { const box = item.getBoundingClientRect(); return { id: item.parentElement!.getAttribute('data-object-id')!, left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
  expect(targets.every((target) => target.right - target.left >= 44 && target.bottom - target.top >= 44 && target.left >= 0 && target.right <= 390)).toBe(true);
  expect(Math.hypot((targets[0].left + targets[0].right - targets[1].left - targets[1].right) / 2, (targets[0].top + targets[0].bottom - targets[1].top - targets[1].bottom) / 2)).toBeLessThan(44);
  const nearestTarget = targets[1];
  await page.mouse.click((nearestTarget.left + nearestTarget.right) / 2, (nearestTarget.top + nearestTarget.bottom) / 2);
  await expect(page.locator('.foreman-strip__id')).toHaveText(nearestTarget.id);
  await page.locator('.field-sheet__handle').click(); await page.waitForTimeout(400);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Menu' }).click(); await page.getByText('Water', { exact: true }).click(); await expect(waterObjects).toHaveCount(0); await page.getByText('Water', { exact: true }).click(); await expect(waterObjects).toHaveCount(2);
  for (const name of ['Grading', 'Sanitary', 'Storm']) await page.getByText(name, { exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Search objects' }).click(); await page.getByPlaceholder(/Search by ID or name/).fill('survey-wg-southeast-east'); await page.getByPlaceholder(/Search by ID or name/).press('Enter');
  await expect(page.getByText('Reference-derived', { exact: true })).toBeVisible(); await expect(page.getByText('Medium confidence', { exact: true })).toBeVisible();
  const warning = page.getByText(/Water main geometry is unavailable/); await expect(warning).toBeVisible();
  await page.locator('.field-sheet').evaluate((sheet) => { sheet.scrollTop = sheet.scrollHeight; }); await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('reading-water-phone-offline-detail.png'), fullPage: true });
  await page.locator('.field-sheet__handle').click(); await page.waitForTimeout(400);
  await page.locator('.field-sheet').evaluate((sheet) => { sheet.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('reading-water-phone-offline.png'), fullPage: true });
});
