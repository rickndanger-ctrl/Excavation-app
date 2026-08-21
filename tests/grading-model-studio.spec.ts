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
  const labelLayout = await page.locator('.grading-map-label').evaluateAll((labels) => labels.map((label) => {
    const box = label.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  expect(labelLayout.length).toBeGreaterThanOrEqual(8);
  expect(labelLayout.length).toBeLessThan(20);
  for (let left = 0; left < labelLayout.length; left += 1) {
    expect(labelLayout[left].left).toBeGreaterThanOrEqual(0);
    expect(labelLayout[left].right).toBeLessThanOrEqual(390);
    for (let right = left + 1; right < labelLayout.length; right += 1) {
      const overlaps = labelLayout[left].left < labelLayout[right].right
        && labelLayout[left].right > labelLayout[right].left
        && labelLayout[left].top < labelLayout[right].bottom
        && labelLayout[left].bottom > labelLayout[right].top;
      expect(overlaps).toBe(false);
    }
  }
  const hitTargets = await page.locator('.plan-object-hit-target').evaluateAll((targets) => targets.map((target) => {
    const box = target.getBoundingClientRect();
    return { id: target.parentElement!.getAttribute('data-object-id')!, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  expect(hitTargets).toHaveLength(20);
  expect(hitTargets.every((target) => target.right - target.left >= 44 && target.bottom - target.top >= 44)).toBe(true);
  expect(hitTargets.every((target) => target.left >= 0 && target.right <= 390)).toBe(true);

  const crowdedPair = hitTargets.flatMap((left, leftIndex) => hitTargets.slice(leftIndex + 1).map((right) => ({
    left,
    right,
    distance: Math.hypot((left.left + left.right - right.left - right.right) / 2, (left.top + left.bottom - right.top - right.bottom) / 2),
  }))).sort((a, b) => a.distance - b.distance)[0];
  expect(crowdedPair.distance).toBeLessThan(44);
  for (const target of [crowdedPair.left, crowdedPair.right]) {
    await page.mouse.click((target.left + target.right) / 2, (target.top + target.bottom) / 2);
    await expect(page.locator('.foreman-strip__id')).toHaveText(target.id);
    await page.locator('.field-sheet__handle').click();
  }

  const suppressedId = await page.locator('.plan-object[data-label-suppressed="true"]').first().getAttribute('data-object-id');
  expect(suppressedId).toBeTruthy();
  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID or name/).fill(suppressedId!);
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
