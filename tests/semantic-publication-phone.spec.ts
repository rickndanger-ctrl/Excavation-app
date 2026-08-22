import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const manifestJson = fs.readFileSync(
  '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json',
  'utf8',
);
const envelope = {
  publication_schema: 'excavation-field-map.semantic-publication/v1',
  package_id: 'hilyard-apartment-test',
  package_version: 'hilyard-complete-v1',
  content_sha256: createHash('sha256').update(manifestJson).digest('hex'),
  created_at: '2026-08-21T12:00:00.000Z',
  manifest_json: manifestJson,
};

test('discovers a directly published immutable package in the phone project flow and keeps it offline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/rest/v1/projects?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/semantic-publications.local.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/model-studio-api/publications', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([envelope]),
  }));

  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('.project-selector__btn').click();
  await expect(page.getByRole('button', { name: /Hilyard Apartment Civil Plan Test/ })).toBeVisible();
  await page.getByRole('button', { name: /Hilyard Apartment Civil Plan Test/ }).click();
  await expect(page.locator('[data-object-id]')).toHaveCount(129);
  await expect(page.getByText('FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION', { exact: true })).toBeVisible();
  await expect(page.getByText('● Immutable package · offline')).toBeVisible();
  await page.getByLabel('Select excavation phase').selectOption('__overview__');
  await page.getByRole('button', { name: 'Menu' }).click();

  const layers = [
    ['Property / Constraints', 'property', 12],
    ['Grading / Surfaces', 'grading', 29],
    ['Sanitary Sewer', 'sanitary', 9],
    ['Storm / Roof Drainage', 'storm', 18],
    ['Domestic Water', 'domestic-water', 8],
    ['Fire Water', 'fire-water', 12],
    ['Water Source Reference', 'water-reference', 1],
    ['Gas / Power / Telecom / Lighting', 'dry-utilities', 25],
    ['Finished Job Layout', 'finished-site', 11],
    ['Construction / Erosion Control', 'construction-erosion', 4],
  ] as const;
  for (const [label, layerId, expectedCount] of layers) {
    const control = page.getByLabel(label);
    await expect(control).toBeChecked();
    await expect(page.locator(`[data-layer-id="${layerId}"]`)).toHaveCount(expectedCount);
    await page.getByText(label, { exact: true }).click();
    await expect(page.locator(`[data-layer-id="${layerId}"]`)).toHaveCount(0);
    await page.getByText(label, { exact: true }).click();
    await expect(page.locator(`[data-layer-id="${layerId}"]`)).toHaveCount(expectedCount);
  }

  const cached = await page.evaluate(() => ({
    active: localStorage.getItem('excavation-field-map:activeSemanticPublication:v1'),
    packages: localStorage.getItem('excavation-field-map:semantic-publications:v1'),
  }));
  expect(cached.active).toBe('hilyard-apartment-test@hilyard-complete-v1');
  expect(cached.packages).toContain(envelope.content_sha256);

  await page.unroute('**/semantic-publications.local.json');
  await page.route('**/semantic-publications.local.json', (route) => route.abort('internetdisconnected'));
  await page.unroute('**/model-studio-api/publications');
  await page.route('**/model-studio-api/publications', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.locator('[data-object-id]')).toHaveCount(129);
  await expect(page.getByText('FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION', { exact: true })).toBeVisible();
});
