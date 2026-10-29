import { test, expect } from '@playwright/test';

const site = '/agent-slot-calculator/';

test('hardware buyer gets the report default verdict', async ({ page }) => {
  await page.goto(site);
  await expect(page.locator('#agents')).toHaveText('14');
  await expect(page.locator('#limit')).toHaveText('limited by memory');
  await expect(page.locator('#m-hw')).toHaveText('$214');
  await expect(page.locator('#m-tco')).toHaveText('$305');
  await expect(page.locator('#vpill')).toHaveText('Worth it');
});

test('hardware buyer can reject the M920q and model a 15 percent duty cycle', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('m920q');
  await expect(page.locator('#agents')).toHaveText('0');
  await expect(page.locator('#vpill')).toHaveText("Can't hold an agent");
  await expect(page.locator('#vband')).toHaveAttribute('data-state', 'bad');
  await expect(page.locator('#flags')).toContainText('Slow cores');
  await expect(page.locator('#flags')).toContainText('With 32 GB');
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('270k128');
  await page.getByRole('spinbutton', { name: 'Duty cycle', exact: true }).fill('15');
  await expect(page.locator('#agents')).toHaveText('26');
  await expect(page.getByRole('slider', { name: 'Duty cycle', exact: true })).toHaveValue('15');
});

test('machine edits synchronize sliders and switch to Custom', async ({ page }) => {
  await page.goto(site);
  for (const [name, value] of [
    ['Price', '16000'], ['Memory', '640'], ['Single-thread', '7000'],
    ['Multi-thread', '170000'], ['Idle power', '260'], ['Full-load power', '750'],
  ]) {
    await page.getByRole('combobox', { name: 'Start from' }).selectOption('270k128');
    const number = page.getByRole('spinbutton', { name, exact: true });
    const range = page.getByRole('slider', { name, exact: true });
    await number.fill(value);
    await expect(number).toHaveValue(value);
    await expect(page.locator('#preset')).toHaveValue('custom');
    await range.focus();
    await range.press('Home');
    await expect(number).toHaveValue(await range.inputValue());
  }
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('270k128');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('My build box');
  await expect(page.locator('#vname')).toHaveText('My build box');
  await expect(page.locator('#preset')).toHaveValue('custom');
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('270k128');
  await page.getByRole('button', { name: 'macOS + Docker VM · 8 GB' }).click();
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect(page.getByRole('button', { name: 'macOS + Docker VM · 8 GB' })).toHaveAttribute('aria-pressed', 'true');
});

test('fleet operator gets power-only costs and an upgrade scenario', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('checkbox', { name: 'I already own it' }).check();
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect(page.locator('#m-hw')).toHaveText('$0');
  await expect(page.locator('#vpill')).toHaveText('Use it');
  await expect(page.locator('#flags')).toContainText('Already paid for, so only electricity counts.');
  await page.getByRole('combobox', { name: 'Start from' }).selectOption('270k64');
  await expect(page.locator('#flags')).toContainText('With 128 GB (+$930): 14 agents');
  await page.getByRole('spinbutton', { name: 'Upgrade to' }).fill('192');
  await page.getByRole('spinbutton', { name: 'for', exact: true }).fill('2050');
  await expect(page.locator('#flags')).toContainText('With 192 GB (+$2,050)');
  await expect(page.locator('#mnote')).toContainText('Includes an estimated $400–450');
});

test('workload chips and advanced assumptions apply to all machines and reset', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('button', { name: 'TS / Ruby 8' }).click();
  await expect(page.locator('#agents')).toHaveText('18');
  await expect(page.locator('#f-slotGB-n')).toHaveValue('8');
  await expect(page.getByRole('button', { name: 'TS / Ruby 8' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Rust / C++ / Java 16' }).click();
  await expect(page.locator('#agents')).toHaveText('10');
  const referenceRow = page.locator('#tbody tr[aria-selected="true"]');
  await expect(referenceRow.locator('td').nth(2)).toHaveText('10');
  await page.getByRole('spinbutton', { name: 'Agents you want', exact: true }).fill('30');
  await expect(page.locator('#fleet')).toContainText('For 30 agents: 3 boxes');
  await page.getByRole('spinbutton', { name: 'Electricity', exact: true }).fill('0.15');
  await page.getByText('More assumptions', { exact: true }).click();
  for (const [name, value] of [
    ['Threads per running build', '8'], ['Memory per idle agent', '2'],
    ['Serial share of a build', '60'], ['Time at full load', '50'],
    ['Years of use', '5'], ['128 GB desktop price', '4000'],
  ]) {
    await page.getByRole('spinbutton', { name, exact: true }).fill(value);
    await expect(page.getByRole('slider', { name, exact: true })).toHaveValue(value);
  }
  await page.getByRole('button', { name: 'Reset to report defaults' }).click();
  await expect(page.locator('#agents')).toHaveText('14');
  await expect(page.locator('#m-tco')).toHaveText('$305');
  await expect(page.locator('#f-years-n')).toHaveValue('3');
  await expect(page.locator('#f-refPrice-n')).toHaveValue('3000');
  await expect(page.locator('#f-rate-n')).toHaveValue('0.35');
});

test('keyboard user activates comparison rows with Enter and Space', async ({ page }) => {
  await page.goto(site);
  const smallPC = page.getByRole('row').filter({ hasText: 'Lenovo M920q ·' });
  await smallPC.focus();
  await smallPC.press('Enter');
  await expect(page.locator('#preset')).toHaveValue('m920q');
  await expect(page.locator('#agents')).toHaveText('0');
  const reference = page.getByRole('row').filter({ hasText: 'Core Ultra 7 270K Plus · 128 GB' });
  await reference.focus();
  await reference.press('Space');
  await expect(page.locator('#preset')).toHaveValue('270k128');
  await expect(page.locator('#agents')).toHaveText('14');
  await expect(page.locator('#tbody tr[aria-selected="true"]')).toContainText('Core Ultra 7 270K Plus · 128 GB');
});

test('keyboard can reach every control with a visible focus ring', async ({ page }) => {
  await page.goto(site);
  await page.getByText('More assumptions', { exact: true }).click();
  const selector = 'input, select, button, summary, tr[tabindex="0"]';
  const total = await page.locator(selector).count();
  const reached = new Set<number>();
  for (let i = 0; i < total + 3 && reached.size < total; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate((selector) => {
      const active = document.activeElement;
      const index = Array.from(document.querySelectorAll(selector)).indexOf(active!);
      const css = active ? getComputedStyle(active) : null;
      return { index, visible: active?.matches(':focus-visible'), width: css?.outlineWidth, style: css?.outlineStyle };
    }, selector);
    if (focus.index < 0) continue;
    expect(focus.visible).toBe(true);
    expect(focus.width).toBe('2px');
    expect(focus.style).toBe('solid');
    reached.add(focus.index);
  }
  expect(reached.size).toBe(total);
});

test('reload restores custom machine and workload settings', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Home build server');
  await page.getByRole('spinbutton', { name: 'Price', exact: true }).fill('4000');
  await page.getByRole('spinbutton', { name: 'Duty cycle', exact: true }).fill('15');
  await page.reload();
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect(page.locator('#mname')).toHaveValue('Home build server');
  await expect(page.locator('#f-price-n')).toHaveValue('4000');
  await expect(page.locator('#f-p-n')).toHaveValue('15');
  await expect(page.locator('#agents')).toHaveText('26');
});

test('blocked storage leaves the calculator usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(site);
  await expect(page.locator('#agents')).toHaveText('14');
  await page.getByRole('spinbutton', { name: 'Duty cycle', exact: true }).fill('15');
  await expect(page.locator('#agents')).toHaveText('26');
  await page.reload();
  await expect(page.locator('#agents')).toHaveText('14');
  expect(errors).toEqual([]);
});

for (const width of [400, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${width}px ${colorScheme} layout contains overflow and respects motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(site);
      await expect(page.locator('#agents')).toHaveText('14');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.bar')).toBeVisible({ visible: width < 920 });
      expect(await page.locator('#vband').evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
      expect(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(colorScheme === 'dark' ? 'rgb(13, 18, 25)' : 'rgb(241, 243, 247)');
      if (width === 400) {
        expect(await page.locator('.table-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await page.getByRole('row').filter({ hasText: 'Lenovo M920q ·' }).click();
        await expect(page.locator('#bar-agents')).toHaveText('0');
        await expect(page.locator('#bar-pill')).toHaveText("Can't hold an agent");
        await expect(page.locator('#h-machine')).toBeInViewport();
      } else {
        expect(await page.locator('.area-result').evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
      }
      const origin = new URL(page.url()).origin;
      expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('a returning visitor sees current preset data, not the copy saved on their first visit', async ({ page }) => {
  await page.goto(site);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('agent-slot-calc-v1')!);
    saved.M.price = 3600;
    saved.M.upGB = 192; saved.M.upCost = 2000;
    localStorage.setItem('agent-slot-calc-v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('#preset')).toHaveValue('270k128');
  await expect(page.locator('#f-price-n')).toHaveValue('3000');
  await expect(page.locator('#vpill')).toHaveText('Worth it');
  await expect(page.locator('#upgb')).toHaveValue('192');
});

test('an incomplete saved machine falls back to the reference box', async ({ page }) => {
  await page.goto(site);
  await page.evaluate(() => {
    localStorage.setItem('agent-slot-calc-v1', JSON.stringify({ A: { p: 0.3 }, M: { price: 100, ram: 64 }, presetId: 'custom' }));
  });
  await page.reload();
  await expect(page.locator('#preset')).toHaveValue('270k128');
  await expect(page.locator('#mname')).not.toHaveValue('undefined');
  await expect(page.locator('#agents')).toHaveText('14');
});
