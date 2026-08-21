import { expect, test } from '@playwright/test';
import path from 'node:path';

const planFixture = path.resolve('fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf');

async function importPlans(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await chooser).setFiles(planFixture);
}

async function publishGrading(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: 'Open Model Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Model Studio' }).click();
  const cards = page.locator('.model-studio__candidate');
  await expect(cards).toHaveCount(22);
  for (let index = 0; index < 22; index += 1) {
    const card = cards.nth(index);
    await card.getByRole('radio', { name: await card.getAttribute('data-kind') === 'grading_note' ? 'Reject' : 'Approve' }).check();
  }
  await page.getByLabel('Reviewer name').fill('Richard review');
  await page.getByRole('button', { name: 'Publish approved grading layer' }).click();
}

test('reviews and publishes the survey-backed sanitary layer for offline phone use', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await importPlans(page);
  await publishGrading(page);
  await importPlans(page);

  await expect(page.getByRole('button', { name: 'Open Sanitary Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Sanitary Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Sanitary Studio' })).toBeVisible();
  await expect(page.getByText('Topographic Survey · PDF page 2')).toBeVisible();
  await expect(page.getByText('4 sanitary candidates')).toBeVisible();
  await expect(page.locator('.sanitary-studio__excluded')).toHaveCount(2);
  await expect(page.locator('[data-symbol="sanitary-manhole"]')).toBeVisible();
  await expect(page.locator('[data-symbol="sanitary-cleanout"]')).toBeVisible();
  await expect(page.locator('[data-symbol="sanitary-pipe"]')).toBeVisible();

  const candidates = page.locator('.sanitary-studio__candidate');
  await expect(candidates).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) await candidates.nth(index).getByRole('radio', { name: 'Approve' }).check();
  await page.getByLabel('Sanitary reviewer name').fill('Richard sanitary review');
  await page.getByRole('button', { name: 'Publish approved sanitary layer' }).click();

  await expect(page.getByRole('status')).toContainText('reading-public-library-grading-sanitary-v2');
  await expect(page.locator('.plan-canvas__pdf')).toHaveCount(0);
  await expect(page.locator('.sanitary-symbol--manhole')).toHaveCount(2);
  await expect(page.locator('.sanitary-symbol--cleanout')).toHaveCount(1);
  await expect(page.locator('.sanitary-symbol--pipe')).toHaveCount(1);
  await expect(page.locator('.sanitary-line')).toHaveCount(1);

  const sanitaryLabels = page.locator('.plan-object[data-layer-id="sanitary"] .grading-map-label');
  const priorities = await sanitaryLabels.evaluateAll((labels) => labels.map((label) => Number(label.getAttribute('data-label-priority'))));
  expect(priorities[0]).toBeGreaterThan(priorities.at(-1)!);
  expect(await sanitaryLabels.evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.every((box) => box.left >= 8 && box.right <= innerWidth - 8)
      && boxes.every((box, index) => boxes.slice(index + 1).every((other) => (
        box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top
      )));
  })).toBe(true);
  const hitTargets = page.locator('.plan-object[data-layer-id="sanitary"] .plan-object-hit-target');
  await expect(hitTargets).toHaveCount(4);
  expect(await hitTargets.evaluateAll((targets) => targets.every((target) => {
    const box = target.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth;
  }))).toBe(true);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('Sanitary', { exact: true })).toBeVisible();
  await page.getByText('Sanitary', { exact: true }).click();
  await expect(page.locator('.plan-object[data-layer-id="sanitary"]')).toHaveCount(0);
  await page.getByText('Sanitary', { exact: true }).click();
  await expect(page.locator('.plan-object[data-layer-id="sanitary"]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID or name/).fill('survey-smh-west');
  await page.getByPlaceholder(/Search by ID or name/).press('Enter');
  await expect(page.getByText('Reference-derived', { exact: true })).toBeVisible();
  await expect(page.getByText('Medium confidence', { exact: true })).toBeVisible();
  await expect(page.getByText('154.49', { exact: true })).toBeVisible();

  await page.locator('.field-sheet__handle').click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByText('Grading', { exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.plan-object[data-object-id="survey-smh-west"] .grading-map-label')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reading-sanitary-phone-offline.png'), fullPage: true });
});
