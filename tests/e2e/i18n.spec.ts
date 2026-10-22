import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

test('English flight, pause, Japanese switch, persistence and flight ending', async ({
  page,
}) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Night Flight');
  await expect(page.getByRole('heading', { name: 'Into the night.' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.clock.runFor(1000);
  await expect(page.getByRole('meter', { name: 'Fuel', exact: true })).toHaveAttribute(
    'aria-valuenow',
    /99/,
  );
  await page.getByRole('button', { name: 'Pause and controls' }).click();
  await expect(page.getByRole('heading', { name: 'The night is here.' })).toBeVisible();
  const fuel = await page
    .getByRole('meter', { name: 'Fuel', exact: true })
    .getAttribute('aria-valuenow');
  await page.getByLabel('Language / 言語').selectOption('ja');
  await expect(page.getByRole('heading', { name: '夜は、ここに。' })).toBeVisible();
  await page.clock.runFor(1000);
  expect(
    await page
      .getByRole('meter', { name: '燃料', exact: true })
      .getAttribute('aria-valuenow'),
  ).toBe(fuel);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { name: '夜のなかへ。' })).toBeVisible();
  await page.getByLabel('Language / 言語').selectOption('en');
  await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.keyboard.down('ArrowUp');
  await page.clock.runFor(60_000);
  await page.keyboard.up('ArrowUp');
  await expect(page.getByRole('heading', { name: 'After the flight.' })).toBeVisible();
  await page.getByLabel('Language / 言語').selectOption('ja');
  await expect(page.getByRole('heading', { name: '飛行のあと。' })).toBeVisible();
  await page.getByLabel('Language / 言語').selectOption('en');
  await page.getByRole('button', { name: 'Fly again' }).click();
  await page.clock.runFor(100);
  await expect(
    page.getByRole('meter', { name: 'Altitude', exact: true }),
  ).toHaveAttribute('aria-valuenow', '1200');
});

test('English touch instructions and switching without storage', async ({ browser }) => {
  const context = await browser.newContext({
    locale: 'en-US',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.touch-help')).toContainText('Left stick');
  await page.getByLabel('Language / 言語').selectOption('ja');
  await expect(page.getByRole('heading', { name: '夜のなかへ。' })).toBeVisible();
  await page.getByLabel('Language / 言語').selectOption('en');
  await page.getByRole('button', { name: 'Begin flight' }).tap();
  await expect(
    page.getByRole('button', { name: 'Increase power', exact: true }),
  ).toBeVisible();
  await context.close();
});
