import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { CATALOG } from '../src/data/catalog';
import { costPoints } from '../src/lib/costs';
import { DEFAULTS } from '../src/data/presets';

const site = '/agent-slot-calculator/';
const costs = site + 'costs/';
// Expected counts come from the catalog, so adding listings doesn't break the journeys.
const all = costPoints(CATALOG, DEFAULTS);
const plotted = (keep: (p: (typeof all)[number]) => boolean = () => true) => all.filter((p) => p.result.n > 0 && keep(p)).length;

test('hardware buyer compares every machine on the cost chart', async ({ page }) => {
  await page.goto(costs);
  await expect(page.locator('#cost-assume')).toHaveText('30% duty · 12 GB/build · 3 yr · $0.35/kWh');
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted());
  await expect(page.locator('#cost-count')).toContainText(`Showing ${all.length} of ${all.length} machines.`);
  const reference = page.locator('#cost-tbody tr[data-id="270k128"] td');
  await expect(reference.nth(1)).toHaveText('$4,272');
  await expect(reference.nth(2)).toHaveText('14');
  await expect(reference.nth(3)).toHaveText('$305');
  await expect(reference.nth(5)).toContainText('report price');
  await expect(page.locator('#cost-tbody .tag', { hasText: 'Best at this budget' }).first()).toBeVisible();
});

test('filters narrow the chart and the table together', async ({ page }) => {
  await page.goto(costs);
  await page.getByRole('button', { name: 'Used', exact: true }).click();
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted((p) => p.entry.condition !== 'new'));
  await expect(page.locator('#cost-tbody')).not.toContainText('New mini pc');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('mac');
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted((p) => p.entry.form === 'mac'));
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('all');
  await page.getByRole('combobox', { name: 'Memory' }).selectOption('128');
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted((p) => p.machine.ram >= 128));
  await page.getByRole('combobox', { name: 'Memory' }).selectOption('0');
  await page.getByRole('spinbutton', { name: 'Box total up to' }).fill('1000');
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted((p) => p.total <= 1000));
  await page.getByRole('spinbutton', { name: 'Box total up to' }).fill('');
  await page.getByRole('checkbox', { name: 'Include machines you already own' }).uncheck();
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted((p) => p.entry.condition !== 'owned'));
  await expect(page.locator('#cost-tbody')).not.toContainText('Already yours');
});

test('keyboard and pointer users read a dot through its tooltip', async ({ page }) => {
  await page.goto(costs);
  const dot = page.locator('#cost-chart .pt[data-id="270k128"]');
  await expect(dot).toHaveAttribute('aria-label', /\$305 per agent, 14 agents, \$4,272 over 3 years, ×\d\.\d\d the cheapest per agent/);
  await dot.focus();
  await expect(page.locator('#cost-tip')).toBeVisible();
  await expect(page.locator('#cost-tip')).toContainText('$305 per agent');
  await expect(page.locator('#cost-tip')).toContainText('report price');
  await expect(page.locator('#cost-tbody tr[data-id="270k128"]')).toHaveClass(/is-hot/);
  await dot.blur();
  await expect(page.locator('#cost-tip')).toBeHidden();
  await page.locator('#cost-chart .pt[data-id="tr9980b"]').hover();
  await expect(page.locator('#cost-tip')).toContainText('35 agents · $17,156 over 3 yr');
});

test('fleet operator settings carry over and a machine opens in the calculator', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('spinbutton', { name: 'Duty cycle', exact: true }).fill('15');
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Cost chart' }).click();
  await expect(page).toHaveURL(/\/costs\/$/);
  await expect(page.locator('#cost-assume')).toContainText('15% duty');
  await expect(page.locator('#cost-tbody tr[data-id="270k128"] td').nth(2)).toHaveText('26');
  await page.getByRole('link', { name: 'Ryzen 9 9950X · 192 GB (new build)' }).click();
  await expect(page.locator('#preset')).toHaveValue('9950x192');
  await expect(page.locator('#f-p-n')).toHaveValue('15');
  await expect(page).toHaveURL(new RegExp(site + '$'));
  await page.reload();
  await expect(page.locator('#preset')).toHaveValue('9950x192');
});

test('a market listing opens in the calculator with its own numbers', async ({ page }) => {
  const market = all.find((p) => p.entry.origin === 'market' && p.result.n > 0)!;
  await page.goto(costs);
  await page.locator(`#cost-tbody tr[data-id="${market.id}"] a`).first().click();
  await expect(page.locator('#preset')).toHaveValue(market.id);
  await expect(page.locator('#f-price-n')).toHaveValue(String(market.machine.price));
  await expect(page.locator('#agents')).toHaveText(String(market.result.n));
});

test('an edited machine appears on the chart as your pick', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Home build server');
  await page.goto(costs);
  await expect(page.locator('#cost-chart .pt[data-id="custom"]')).toHaveAttribute('aria-label', /^Home build server: \$305 per agent/);
  await expect(page.locator('#cost-tbody tr.is-selected')).toContainText('Home build serverYour pick');
  await expect(page.locator('#cost-chart')).toContainText('Your pick');
});

test('a buyer adds a listing they found, sees it everywhere, and exports it', async ({ page }) => {
  await page.goto(costs);
  await page.getByRole('button', { name: 'Add to the chart' }).click();
  await expect(page.locator('#a-error')).toHaveText('Fill in the processor, single-thread score, multi-thread score, memory and price.');
  await page.getByRole('combobox', { name: 'Processor' }).fill('Intel Core i5-12500T');
  await expect(page.getByRole('spinbutton', { name: 'Single-thread score' })).not.toHaveValue('');
  await page.getByRole('textbox', { name: 'Name' }).fill('OptiPlex 7000 Micro deal');
  await page.getByRole('spinbutton', { name: 'Memory' }).fill('64');
  await page.getByRole('spinbutton', { name: 'Price, all in' }).fill('640');
  await page.getByRole('button', { name: 'Add to the chart' }).click();
  await expect(page.locator('#yours-msg')).toHaveText('Added OptiPlex 7000 Micro deal to the chart.');
  await expect(page.locator('#yours-list')).toContainText('OptiPlex 7000 Micro deal · $640');
  const row = page.locator('#cost-tbody tr', { hasText: 'OptiPlex 7000 Micro deal' });
  await expect(row).toContainText('your price');
  await expect(page.locator('#cost-chart .pt[data-id^="u-"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#yours-list')).toContainText('OptiPlex 7000 Micro deal');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = await (await download).path();
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported.listings[0]).toMatchObject({ name: 'OptiPlex 7000 Micro deal', ram: 64, price: 640, cpuName: 'Intel Core i5-12500T' });
  await row.locator('a').click();
  await expect(page.locator('#mname')).toHaveValue('OptiPlex 7000 Micro deal');
  await page.goto(costs);
  await page.getByRole('button', { name: 'Remove OptiPlex 7000 Micro deal' }).click();
  await expect(page.locator('#cost-chart .pt[data-id^="u-"]')).toHaveCount(0);
  await page.locator('#import').setInputFiles({ name: 'listings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('#yours-msg')).toHaveText('Imported 1 machine.');
  await expect(page.locator('#cost-chart .pt[data-id^="u-"]')).toHaveCount(1);
});

test('blocked storage still draws the chart at the defaults', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(costs);
  await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted());
  expect(errors).toEqual([]);
});

for (const width of [400, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`cost chart at ${width}px ${colorScheme} stays inside the page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(costs);
      await expect(page.locator('#cost-chart .pt')).toHaveCount(plotted());
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const chart = await page.locator('#cost-chart').boundingBox();
      const wrap = await page.locator('#cost-chart-wrap').boundingBox();
      expect(Math.abs(chart!.width - wrap!.width)).toBeLessThan(1);
      expect(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(colorScheme === 'dark' ? 'rgb(13, 18, 25)' : 'rgb(241, 243, 247)');
      const origin = new URL(page.url()).origin;
      expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
