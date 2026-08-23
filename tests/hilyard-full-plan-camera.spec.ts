import { expect, test } from '@playwright/test';

const manifest = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-golden-apartment/semantic-manifest.json';

async function importHilyard(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Model Package' }).click();
  await (await chooser).setFiles(manifest);
  await expect(page.getByRole('status')).toContainText('Hilyard Apartment Civil Plan Test');
}

async function finishedLayoutBounds(page: import('@playwright/test').Page) {
  const ids = [
    'building-apartment-1',
    'paving-arrival-court',
    'sidewalk-south-entry',
    'sidewalk-east-service',
    'landscape-north-court',
  ];
  const boxes = await Promise.all(ids.map((id) => page.locator(`[data-object-id="${id}"]`).boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  return {
    left: Math.min(...boxes.map((box) => box!.x)),
    top: Math.min(...boxes.map((box) => box!.y)),
    right: Math.max(...boxes.map((box) => box!.x + box!.width)),
    bottom: Math.max(...boxes.map((box) => box!.y + box!.height)),
  };
}

test('fits the full Hilyard model on load and exposes a recovery control without fighting manual pan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await importHilyard(page);

  await expect(page.getByText('Model loaded: Hilyard Apartment Civil Plan Test', { exact: true })).toBeVisible();
  const fitButton = page.getByRole('button', { name: 'Fit full plan' });
  await expect(fitButton).toBeVisible();

  const initial = await finishedLayoutBounds(page);
  expect(initial.left).toBeGreaterThanOrEqual(16);
  expect(initial.top).toBeGreaterThanOrEqual(120);
  expect(initial.right).toBeLessThanOrEqual(374);
  expect(initial.bottom).toBeLessThanOrEqual(828);

  const transform = page.locator('.plan-canvas__transform');
  const beforePan = await transform.getAttribute('style');
  const canvas = page.locator('.plan-canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 190, canvasBox!.y + 420);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 270, canvasBox!.y + 500, { steps: 5 });
  await page.mouse.up();
  const afterPan = await transform.getAttribute('style');
  expect(afterPan).not.toEqual(beforePan);
  await page.waitForTimeout(250);
  expect(await transform.getAttribute('style')).toEqual(afterPan);

  await fitButton.click();
  const recovered = await finishedLayoutBounds(page);
  expect(recovered.left).toBeGreaterThanOrEqual(16);
  expect(recovered.top).toBeGreaterThanOrEqual(120);
  expect(recovered.right).toBeLessThanOrEqual(374);
  expect(recovered.bottom).toBeLessThanOrEqual(828);

  await importHilyard(page);
  const refit = await finishedLayoutBounds(page);
  expect(refit.left).toBeGreaterThanOrEqual(16);
  expect(refit.top).toBeGreaterThanOrEqual(120);
  expect(refit.right).toBeLessThanOrEqual(374);
  expect(refit.bottom).toBeLessThanOrEqual(828);
});

test('frames a selected construction phase without changing Fit full plan recovery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4175');
  await importHilyard(page);

  const fullPlan = await finishedLayoutBounds(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByLabel('Select excavation phase').selectOption('phase-07-finish-site');

  await expect(page.getByText('Fictional apartment building - reviewed assumption')).toBeVisible();
  await expect(page.getByText('City 21-inch storm main UNIQUE_ID 4183')).toBeHidden();
  await expect(page.getByText('ASSUMED electric permanent building terminal')).toBeHidden();

  const focused = await finishedLayoutBounds(page);
  expect(focused.right - focused.left).toBeGreaterThan(230);
  expect(focused.bottom - focused.top).toBeGreaterThan(250);
  expect(focused.left).toBeGreaterThanOrEqual(16);
  expect(focused.top).toBeGreaterThanOrEqual(120);
  expect(focused.right).toBeLessThanOrEqual(374);
  expect(focused.bottom).toBeLessThanOrEqual(828);

  await page.getByRole('button', { name: 'Fit full plan' }).click();
  const recovered = await finishedLayoutBounds(page);
  expect(recovered.right - recovered.left).toBeLessThan(focused.right - focused.left);
  expect(Math.abs(recovered.left - fullPlan.left)).toBeLessThan(12);
  expect(Math.abs(recovered.top - fullPlan.top)).toBeLessThan(12);
});
