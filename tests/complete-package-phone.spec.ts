import { expect, test } from '@playwright/test';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json';

test('keeps the complete authored overview legible on a phone without dropping geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/rest/v1/projects?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  let drawer = page.locator('.field-drawer');
  const chooser = page.waitForEvent('filechooser');
  await drawer.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifestPath);
  await expect(page.getByRole('status')).toContainText('123 semantic features');

  await page.getByRole('button', { name: 'Menu' }).click();
  drawer = page.locator('.field-drawer');
  await drawer.getByLabel('Select excavation phase').selectOption('__overview__');
  await expect(drawer).toHaveCount(0);

  await expect(page.locator('[data-object-id]')).toHaveCount(123);
  expect(await page.locator('.plan-canvas__overlay text').count()).toBeLessThanOrEqual(40);
});
