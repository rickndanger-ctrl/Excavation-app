import { expect, test } from '@playwright/test';
import path from 'node:path';

const planFixture = path.resolve(
  'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf',
);

test('imports a real civil plan PDF as the uncalibrated 2D base layer', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();

  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await fileChooser).setFiles(planFixture);

  const status = page.getByRole('status');
  await expect(status).toContainText('25020-RPL_Bid_Drawings_2025_07_11.pdf');
  await expect(status).toContainText('Page 1 of 8');
  await expect(status).toContainText('field overlays hidden until reviewed and calibrated');

  const pdfCanvas = page.locator('canvas.plan-canvas__pdf');
  await expect(pdfCanvas).toBeVisible();
  await expect.poll(
    async () => pdfCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width),
  ).toBeGreaterThan(1000);
  await expect.poll(
    async () => pdfCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.height),
  ).toBeGreaterThan(500);

  const initialRender = await pdfCanvas.evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    renderZoom: Number(canvas.dataset.renderZoom),
    page: canvas.dataset.renderedPage,
  }));
  expect(initialRender.page).toBe('1');

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(
    async () => Number(await pdfCanvas.getAttribute('data-render-zoom')),
  ).toBeGreaterThan(initialRender.renderZoom);
  await expect.poll(
    async () => pdfCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width),
  ).toBeGreaterThan(initialRender.width);

  for (let pageNumber = 2; pageNumber <= 8; pageNumber += 1) {
    const completedWidth = await pdfCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width);
    await page.getByRole('button', { name: 'Next' }).click();
    // The previous completed frame remains visible while the next page renders.
    expect(await pdfCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(completedWidth);
    await expect(status).toContainText(`Page ${pageNumber} of 8`);
    await expect.poll(
      async () => await pdfCanvas.getAttribute('data-rendered-page'),
    ).toBe(String(pageNumber));
  }
  await expect(page.locator('.plan-canvas__overlay polyline')).toHaveCount(0);
  await expect(page.locator('.plan-canvas__overlay g')).toHaveCount(0);
});

test('keeps extracted source geometry visible when the PDF image is hidden', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button', { name: 'Menu' }).click();

  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import Civil Plans' }).click();
  await (await fileChooser).setFiles(planFixture);

  const extracted = page.locator('canvas.plan-canvas__extracted');
  await expect(extracted).toBeAttached();
  await expect.poll(async () => Number(await extracted.getAttribute('data-path-count'))).toBeGreaterThan(4000);
  await expect.poll(async () => Number(await extracted.getAttribute('data-text-count'))).toBeGreaterThan(0);
  await expect(extracted).toHaveAttribute('data-source-page-width', '1728');
  await expect(extracted).toHaveAttribute('data-source-page-height', '2592');
  await expect(extracted).toHaveAttribute('data-source-page-rotation', '270');

  const before = await extracted.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhite = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) nonWhite += 1;
    }
    return nonWhite;
  });
  expect(before).toBeGreaterThan(1000);
  await expect(extracted).toBeHidden();

  await page.getByRole('checkbox', { name: 'Show source PDF' }).uncheck();
  await expect(page.locator('canvas.plan-canvas__pdf')).toBeHidden();
  await expect(extracted).toBeVisible();

  const after = await extracted.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhite = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) nonWhite += 1;
    }
    return nonWhite;
  });
  expect(after).toBe(before);
});
