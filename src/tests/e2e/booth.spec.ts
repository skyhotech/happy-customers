import { expect, test, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SAMPLE_UPLOAD = join(ROOT, 'public/assets/thumbs/poster-36.jpg');
const OUT = join(ROOT, 'test-results/downloads');

/** Reads JPEG pixel size from the SOF marker. */
function jpegSize(path: string) {
  const b = readFileSync(path);
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  throw new Error('not a jpeg');
}

async function captureFromCamera(page: Page) {
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeVisible();
  await expect(page.getByText(/Live · \d+×\d+/)).toBeVisible();
  await page.getByRole('radio', { name: 'Off' }).click(); // no countdown in tests
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await page.waitForURL('**/review');
}

async function pickBranch(page: Page, query: string, cardName: RegExp) {
  await page.waitForURL('**/branches');
  await page.getByRole('searchbox', { name: 'Search branches' }).fill(query);
  await page.getByRole('button', { name: cardName }).first().click();
  await page.waitForURL('**/editor');
}

async function generate(page: Page) {
  await expect(page.getByRole('button', { name: /GENERATE & DOWNLOAD/ })).toBeEnabled({ timeout: 60_000 });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.getByRole('button', { name: /GENERATE & DOWNLOAD/ }).click()]);
  await expect(page.getByText('Poster ready!')).toBeVisible();
  return download;
}

test.describe.configure({ mode: 'serial' });

test('capture → retake → review → branch → generate & download → history (persists after reload)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SKY HAPPY CUSTOMERS' })).toBeVisible();

  await page.getByRole('button', { name: /START NEW PHOTO SESSION/ }).click();
  await page.waitForURL('**/camera');
  await captureFromCamera(page);

  // Retake and recapture
  await page.getByRole('button', { name: 'Retake' }).click();
  await page.waitForURL('**/camera');
  await captureFromCamera(page);

  // Non-destructive adjustments
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Mirror' }).click();
  await page.getByRole('button', { name: /Use Photo/ }).click();

  await pickBranch(page, 'velapadi', /Vellore – Velapadi/);
  await expect(page.getByText('Vellore – Velapadi').first()).toBeVisible();

  const download = await generate(page);
  const name = download.suggestedFilename();
  expect(name).toMatch(/^SKY_HAPPY_CUSTOMER_VELLORE_VELAPADI_\d{8}_\d{6}_[A-Z0-9]{6}\.jpg$/);
  const file = join(OUT, name);
  await download.saveAs(file);
  expect(jpegSize(file)).toEqual({ width: 3516, height: 6250 }); // real template resolution
  expect(statSync(file).size).toBeGreaterThan(500_000);

  // History + persistence across reload
  await page.goto('/history');
  await expect(page.getByText('1 record')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 record')).toBeVisible();

  // Re-download an older poster
  await page.getByRole('link', { name: /View poster for Vellore – Velapadi/ }).click();
  const [again] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download again' }).click()]);
  expect(again.suggestedFilename()).toBe(name);

  // Reuse the photo for a different branch and regenerate
  await page.getByRole('button', { name: 'Reuse photo' }).click();
  await pickBranch(page, 'arcot', /Arcot – Sandy Bazaar/);
  const second = await generate(page);
  expect(second.suggestedFilename()).toMatch(/^SKY_HAPPY_CUSTOMER_ARCOT_SANDY_BAZAAR_/);

  await page.goto('/');
  await expect(page.getByText('Total customer sessions')).toBeVisible();
  await expect(page.locator('section[aria-label="Statistics"]').getByText('2', { exact: true }).first()).toBeVisible();
});

test('missing camera falls back to upload; oversized files are rejected', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('none'), { name: 'NotFoundError' }));
  });
  await page.goto('/camera');
  await expect(page.getByText(/No camera was found/)).toBeVisible();

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(31 * 1024 * 1024, 1) });
  await expect(page.getByText(/too large/)).toBeVisible();

  await input.setInputFiles(SAMPLE_UPLOAD);
  await page.waitForURL('**/review');
  await expect(page.getByRole('heading', { name: 'Review customer photo' })).toBeVisible();
});

test('rejected download shows a manual fallback and does not claim success', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLAnchorElement.prototype.click;
    (window as unknown as { __blockDownloads: boolean }).__blockDownloads = true;
    HTMLAnchorElement.prototype.click = function () {
      if ((window as unknown as { __blockDownloads: boolean }).__blockDownloads && this.download) throw new Error('Blocked by test');
      return orig.call(this);
    };
  });
  await page.goto('/camera');
  await captureFromCamera(page);
  await page.getByRole('button', { name: /Use Photo/ }).click();
  await pickBranch(page, 'chengam', /Chengam/);
  await page.getByRole('button', { name: /GENERATE & DOWNLOAD/ }).click();
  await expect(page.getByText('Poster ready!')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/blocked the automatic download/)).toBeVisible();
  await expect(page.getByText('Download started')).toHaveCount(0);
  await page.evaluate(() => ((window as unknown as { __blockDownloads: boolean }).__blockDownloads = false));
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download poster/ }).click()]);
  expect(d.suggestedFilename()).toMatch(/CHENGAM/);
});

test('unverified template is hidden from the branch selector', async ({ page }) => {
  await page.goto('/templates');
  await page.getByRole('button', { name: /Puducherry – Anna Salai/ }).click();
  await page.getByRole('switch', { name: /Template verified for production/ }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Template saved')).toBeVisible();

  await page.goto('/camera');
  await captureFromCamera(page);
  await page.getByRole('button', { name: /Use Photo/ }).click();
  await page.getByRole('searchbox', { name: 'Search branches' }).fill('puducherry');
  await expect(page.getByText('No matching branch')).toBeVisible();
});

test('mobile layout renders the booth @mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /START NEW PHOTO SESSION/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible();
});
