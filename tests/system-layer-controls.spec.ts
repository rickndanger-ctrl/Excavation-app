import { expect, test } from '@playwright/test';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-water-fire/semantic-manifest.json';
const planPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-water-fire/hilyard-site-layout.pdf';

const featureCount = (page: import('@playwright/test').Page, layerId: string) => page.locator(`[data-layer-id="${layerId}"]`).count();

test('binds the latest civil systems to the existing Layers controls without replacing phase UX', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifestPath);

  await expect(page.getByRole('status')).toContainText('69 semantic features');
  await expect(page.getByText('Willow Creek', { exact: false })).toHaveCount(0);
  await expect.poll(() => featureCount(page, 'sanitary')).toBe(9);
  await expect.poll(() => featureCount(page, 'storm')).toBe(18);
  await expect.poll(() => featureCount(page, 'domestic-water')).toBe(8);
  await expect.poll(() => featureCount(page, 'fire-water')).toBe(12);

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Layers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Phase', exact: true })).toBeVisible();
  await expect(page.getByLabel('Select excavation phase')).toHaveValue('existing');

  await page.getByText('Sanitary Sewer', { exact: true }).click();
  await page.getByText('Storm / Roof Drainage', { exact: true }).click();
  await page.getByText('Fire Water', { exact: true }).click();
  await expect.poll(() => featureCount(page, 'sanitary')).toBe(0);
  await expect.poll(() => featureCount(page, 'storm')).toBe(0);
  await expect.poll(() => featureCount(page, 'fire-water')).toBe(0);
  await expect.poll(() => featureCount(page, 'domestic-water')).toBe(8);

  await page.getByText('Sanitary Sewer', { exact: true }).click();
  await page.getByText('Fire Water', { exact: true }).click();
  await page.getByText('Domestic Water', { exact: true }).click();
  await expect.poll(() => featureCount(page, 'sanitary')).toBe(9);
  await expect.poll(() => featureCount(page, 'fire-water')).toBe(12);
  await expect.poll(() => featureCount(page, 'domestic-water')).toBe(0);
  await expect.poll(() => featureCount(page, 'storm')).toBe(0);

  await page.getByLabel('Select excavation phase').selectOption('proposed');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel('Sanitary Sewer')).toBeChecked();
  await expect(page.getByLabel('Fire Water')).toBeChecked();
  await expect(page.getByLabel('Water Source Reference')).toHaveCount(0);
  await expect(page.getByLabel('Property / Constraints')).toHaveCount(0);
  await expect(page.getByText('Building / Site', { exact: true })).toBeVisible();

  await page.getByLabel('Select excavation phase').selectOption('temporary');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('No model layers in this phase.')).toBeVisible();
  await expect(page.locator('.layer-list input')).toHaveCount(0);

  await page.getByLabel('Select excavation phase').selectOption('__overview__');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByText('Water Source Reference', { exact: true })).toBeVisible();
  await expect(page.getByText('Property / Constraints', { exact: true })).toBeVisible();
  await expect(page.getByText('Building / Site', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Search objects' }).click();
  await page.getByPlaceholder(/Search by ID or name/).fill('domestic-water-seg-02');
  await expect(page.locator('.search-result__id')).toHaveText('domestic-water-seg-02');
  await page.locator('.search-result').click();
  await expect(page.locator('.foreman-strip__id')).toHaveText('domestic-water-seg-02');
  await expect(page.locator('.field-sheet')).toContainText('Generated');

  await page.locator('.field-sheet__handle').click();
  await page.getByRole('button', { name: 'Menu' }).click();
  const planChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await planChooser).setFiles(planPath);
  await expect(page.locator('canvas.plan-canvas__pdf')).toBeVisible();
  await expect.poll(() => featureCount(page, 'sanitary')).toBe(9);
  await expect.poll(() => featureCount(page, 'fire-water')).toBe(12);
  await expect.poll(() => featureCount(page, 'domestic-water')).toBe(0);
  await expect.poll(() => featureCount(page, 'storm')).toBe(0);
});
