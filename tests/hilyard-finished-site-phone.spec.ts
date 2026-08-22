import { expect, test } from '@playwright/test';

const manifest = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json';

test('shows the complete Hilyard finished-job base and preloaded measurement tips on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifest);

  await expect(page.getByRole('status')).toContainText('Hilyard Apartment Civil Plan Test');
  await expect(page.getByRole('status')).toContainText('Plan calibration verified · 15/15 checks');
  await expect(page.getByRole('status')).toContainText('Reference-scale product QA · not survey or staking control');
  await expect(page.locator('[data-layer-id="finished-site"]')).toHaveCount(11);
  await expect(page.locator('[data-object-id="building-apartment-1"]')).toBeVisible();
  await expect(page.locator('[data-object-id="paving-arrival-court"]')).toBeVisible();
  await expect(page.locator('[data-object-id="sidewalk-south-entry"]')).toBeVisible();
  await expect(page.locator('[data-object-id="building-apartment-1"] text')).toBeVisible();
  const pavementFill = await page.locator('[data-object-id="paving-arrival-court"] polygon').getAttribute('fill');
  const sidewalkFill = await page.locator('[data-object-id="sidewalk-south-entry"] polygon').getAttribute('fill');
  const landscapeFill = await page.locator('[data-object-id="landscape-north-court"] polygon').getAttribute('fill');
  expect(new Set([pavementFill, sidewalkFill, landscapeFill]).size).toBe(3);

  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID/).fill('sidewalk-south-entry');
  await page.getByPlaceholder(/Search by ID/).press('Enter');
  const sheet = page.locator('.field-sheet');
  await expect(sheet).toHaveClass(/open/);
  await expect(sheet.getByText('Measurement & Location Tips')).toBeVisible();
  await expect(sheet.getByText('West edge of south entry walk is 18.5 FT east of the building southwest corner.')).toBeVisible();
  await expect(sheet.getByText('Plan-derived guidance · verify control before field use')).toBeVisible();
});
