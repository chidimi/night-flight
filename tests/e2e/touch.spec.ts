import { test, expect, type Page } from '@playwright/test';

async function reading(page: Page, name: string): Promise<number> {
  const value = await page
    .getByRole('meter', { name, exact: true })
    .getAttribute('aria-valuenow');
  if (value === null) throw new Error(`Missing instrument: ${name}`);
  return Number(value);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`${viewport.width}x${viewport.height} touch`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport });

    test('simultaneous steering and power, release, cancellation, pause and rotation', async ({
      page,
      context,
    }) => {
      page.on('pageerror', (error) => {
        throw error;
      });
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
      await page.goto('/');
      await page.getByRole('button', { name: '飛びはじめる' }).tap();
      await page.clock.runFor(100);
      const stick = page.locator('#stick');
      await expect(stick).toBeVisible();
      const bounds = await stick.boundingBox();
      const plus = await page
        .getByRole('button', { name: '出力を上げる', exact: true })
        .boundingBox();
      if (!bounds || !plus) throw new Error('Missing touch controls');
      expect(bounds.y + bounds.height).toBeLessThan(viewport.height);
      expect(plus.x + plus.width).toBeLessThanOrEqual(viewport.width);
      const session = await context.newCDPSession(page);
      const steering = {
        id: 1,
        x: bounds.x + bounds.width - 6,
        y: bounds.y + bounds.height / 2,
      };
      const power = { id: 2, x: plus.x + plus.width / 2, y: plus.y + plus.height / 2 };
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [steering, power],
      });
      await page.clock.runFor(1_000);
      expect(await reading(page, 'バンク角')).toBeGreaterThan(0);
      expect(await reading(page, '出力')).toBeGreaterThan(65);
      const altitude = await reading(page, '高度');
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 1, x: bounds.x + bounds.width / 2, y: bounds.y - 20 }, power],
      });
      await expect(stick).toHaveAttribute('style', /--stick-y: -34px/);
      await page.clock.runFor(4_000);
      expect(await reading(page, '高度')).toBeLessThan(altitude - 1);

      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      const releasedPower = await reading(page, '出力');
      await page.clock.runFor(4_000);
      const settledBank = await reading(page, 'バンク角');
      await page.clock.runFor(1_000);
      expect(Math.abs((await reading(page, 'バンク角')) - settledBank)).toBeLessThan(0.1);
      expect(await reading(page, '出力')).toBe(releasedPower);

      // Cancel a real browser touch sequence, as the OS may do on interruption.
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [power],
      });
      await page.clock.runFor(200);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
      });
      const cancelledPower = await reading(page, '出力');
      await page.clock.runFor(500);
      expect(await reading(page, '出力')).toBe(cancelledPower);

      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [power],
      });
      await page.getByRole('button', { name: '一時停止と操作説明' }).click();
      await expect(stick).toBeHidden();
      const fuel = await reading(page, '燃料');
      await page.clock.runFor(1_000);
      expect(await reading(page, '燃料')).toBe(fuel);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page.getByRole('button', { name: '飛行に戻る' }).tap();
      const resumedPower = await reading(page, '出力');
      await page.clock.runFor(1_000);
      expect(await reading(page, '出力')).toBe(resumedPower);

      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [power],
      });
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await page.clock.runFor(100);
      const rotatedPower = await reading(page, '出力');
      await page.clock.runFor(1_000);
      expect(await reading(page, '出力')).toBe(rotatedPower);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await expect(stick).toBeVisible();
    });
  });
}
