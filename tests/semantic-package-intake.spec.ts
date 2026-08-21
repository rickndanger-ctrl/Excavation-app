import { expect, test } from '@playwright/test';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/semantic-manifest.json';
const planPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/hilyard-site-layout.pdf';

test('imports, searches, and clicks the real Hilyard point, line, and polygon package', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifestPath);

  await expect(page.getByRole('status')).toContainText('33 semantic features');
  await expect(page.locator('[data-geometry-type="Polygon"]')).toHaveCount(12);
  await expect(page.locator('[data-geometry-type="LineString"]')).toHaveCount(6);
  await expect(page.locator('[data-geometry-type="Point"]')).toHaveCount(15);
  await expect(page.locator('.semantic-plan-background')).toBeVisible();
  await expect(page.getByText('Willow Creek', { exact: false })).toHaveCount(0);

  for (const query of ['taxlot-10900', 'sanitary-service-seg-02', 'penetration-sanitary']) {
    await page.getByRole('button', { name: 'Search objects' }).click();
    await page.getByPlaceholder(/Search by ID or name/).fill(query);
    await expect(page.locator('.search-result__id')).toHaveText(query);
    await page.locator('.search-result').click();
    await expect(page.locator('.foreman-strip__id')).toHaveText(query);
    if (query === 'taxlot-10900') await expect(page.locator('.field-sheet')).toContainText('src-eugene-taxlots-gis');
    if (query === 'sanitary-service-seg-02') await expect(page.locator('.field-sheet')).toContainText('unknown_pending_design_flow');
  }

  await page.locator('[data-object-id="taxlot-10900"] polygon').dispatchEvent('click');
  await expect(page.locator('.foreman-strip__id')).toHaveText('taxlot-10900');
});

test('keeps approved semantic overlays visible over an imported source PDF', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  let chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifestPath);

  await page.getByRole('button', { name: 'Menu' }).click();
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await chooser).setFiles(planPath);

  await expect(page.locator('canvas.plan-canvas__pdf')).toBeVisible();
  await expect(page.locator('[data-object-id="building-apartment-1"]')).toBeVisible();
  await expect(page.locator('[data-object-id="sanitary-service-seg-02"]')).toBeVisible();
  await expect(page.locator('[data-object-id="penetration-sanitary"]')).toBeVisible();
});
