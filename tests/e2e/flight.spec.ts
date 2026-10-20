import { test, expect, type Page } from '@playwright/test';

async function instrument(page: Page, name: string): Promise<number> {
  const value = await page
    .getByRole('meter', { name, exact: true })
    .getAttribute('aria-valuenow');
  if (value === null) throw new Error(`Missing instrument value: ${name}`);
  return Number(value);
}

async function startFlight(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '夜のなかへ。' })).toBeVisible();
  await page.getByRole('button', { name: '飛びはじめる' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(100);
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('start, keyboard controls, pause and resume', async ({ page }) => {
  await startFlight(page);
  const initialFuel = await instrument(page, '燃料');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyW');
  await page.clock.runFor(1_000);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('KeyW');
  expect(await instrument(page, 'バンク角')).toBeGreaterThan(0);
  expect(await instrument(page, '出力')).toBeGreaterThan(65);
  expect(await instrument(page, '燃料')).toBeLessThan(initialFuel);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '夜は、ここに。' })).toBeVisible();
  const pausedFuel = await instrument(page, '燃料');
  const pausedAltitude = await instrument(page, '高度');
  await page.clock.runFor(5_000);
  expect(await instrument(page, '燃料')).toBe(pausedFuel);
  expect(await instrument(page, '高度')).toBe(pausedAltitude);
  await page.getByRole('button', { name: '飛行に戻る' }).click();
  await page.clock.runFor(1_000);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await instrument(page, '燃料')).toBeLessThan(pausedFuel);
});

test('fuel exhausts at three minutes; glide, sea contact and restart', async ({
  page,
}) => {
  await startFlight(page);
  await page.clock.runFor(178_000);
  expect(await instrument(page, '燃料')).toBeGreaterThan(0);
  expect(await instrument(page, '出力')).toBe(65);
  await page.clock.runFor(2_000);
  expect(await instrument(page, '燃料')).toBe(0);
  expect(await instrument(page, '出力')).toBe(0);
  await expect(page.locator('#overlay')).toBeHidden();

  const altitude = await instrument(page, '高度');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.clock.runFor(5_000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  expect(await instrument(page, '出力')).toBe(0);
  expect(await instrument(page, '高度')).toBeLessThan(altitude);
  await page.clock.runFor(60_000);
  await expect(page.getByRole('heading', { name: '飛行のあと。' })).toBeVisible();
  expect(await instrument(page, '高度')).toBe(0);
  await page.getByRole('button', { name: 'もう一度、空へ' }).click();
  await page.clock.runFor(100);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await instrument(page, '燃料')).toBeGreaterThan(99);
  expect(await instrument(page, '出力')).toBe(65);
  expect(await instrument(page, '高度')).toBe(1200);
});
