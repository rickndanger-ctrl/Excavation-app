import { expect, test } from '@playwright/test';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/semantic-manifest.json';
const planPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/hilyard-site-layout.pdf';
const readingFinishedSitePath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/.model-studio/published/reading-public-library-demo/434b20cfeb845231c98d25dd4949df013c9d921b6179191f29f6f06e762b40cc/semantic-publication.json';

test('opens on the model instead of covering it with a preselected sample detail sheet', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');

  await expect(page.locator('.field-sheet')).not.toHaveClass(/open/);
});

test('refits a published 2D model when the viewport changes to phone size', async ({ page }) => {
  await page.setViewportSize({ width: 974, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(readingFinishedSitePath);
  await expect(page.getByRole('status')).toContainText('reading-reviewed-v4-cbff78ff3ef7100a');
  await expect(page.locator('[data-object-id="reading-proposed-unit-paver-terrace"]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });

  await expect.poll(async () => {
    const box = await page.locator('.semantic-plan-background').boundingBox();
    return box && {
      left: Math.round(box.x),
      right: Math.round(box.x + box.width),
      top: Math.round(box.y),
      bottom: Math.round(box.y + box.height),
    };
  }).toEqual(expect.objectContaining({ left: expect.any(Number), right: expect.any(Number) }));
  const box = await page.locator('.semantic-plan-background').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test('renders the recognizable finished job as a material-styled base beneath work layers', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(readingFinishedSitePath);
  await expect(page.getByRole('status')).toContainText('reading-reviewed-v4-cbff78ff3ef7100a');

  const building = page.locator('[data-object-id="reading-library-footprint"]');
  const sidewalk = page.locator('[data-object-id="reading-existing-south-sidewalk"]');
  const lawn = page.locator('[data-object-id="reading-existing-south-lawn"]');
  const westWalk = page.locator('[data-object-id="reading-existing-west-concrete-walk"]');
  const seatWall = page.locator('[data-object-id="reading-seat-wall-upper"]');
  const sanitary = page.locator('[data-object-id="survey-smh-west"]');
  const basePrecedesOverlay = await building.evaluate((element, overlay) => Boolean(
    element.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING,
  ), await sanitary.elementHandle());
  expect(basePrecedesOverlay).toBe(true);

  await page.getByRole('button', { name: 'Menu' }).click();
  for (const layer of ['Grading', 'Sanitary Sewer', 'Storm / Roof Drainage', 'Water Source Reference', 'Dry Utilities']) {
    await page.getByText(layer, { exact: true }).click();
  }
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(building.locator('polygon')).toHaveAttribute('fill', '#334155');
  await expect(building.locator('polygon')).toHaveAttribute('fill-opacity', '0.82');
  await expect(sidewalk.locator('polygon')).toHaveAttribute('fill', '#d6d3d1');
  await expect(lawn.locator('polygon')).toHaveAttribute('fill', '#a7c99a');
  await expect(building.locator('text')).toHaveText('Reading Public Library');
  await expect(westWalk.locator('text')).toHaveCount(0);
  await expect(seatWall.locator('text')).toHaveCount(0);

});

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
