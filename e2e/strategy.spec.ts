import { test, expect } from '@playwright/test';
import { planStrategies, DEFAULT_SITUATION } from '../src/lib/strategy';
import { CATALOG } from '../src/data/catalog';
import { DEFAULTS } from '../src/data/presets';

const site = '/agent-slot-calculator/';
const page_ = site + 'strategy/';
const TITLE = { cash: 'Cash only', finance: 'Finance the rest', stages: 'Grow in stages', monthly: 'Lowest monthly bill' } as const;
// Expected picks come from the same engine over the catalog, so data updates don't break the journeys.
const plan = (over = {}) => planStrategies(CATALOG, DEFAULTS, { ...DEFAULT_SITUATION, ...over });

test('a buyer on a cash budget sees four strategies with the recommended one first', async ({ page }) => {
  await page.goto(page_);
  await expect(page.getByRole('spinbutton', { name: 'Cash available now' })).toHaveValue('3000');
  await expect(page.getByRole('spinbutton', { name: 'Agents you want' })).toHaveValue('20');
  const expected = plan();
  await expect(page.locator('.strategy')).toHaveCount(4);
  await expect(page.locator('.strategy').first()).toHaveAttribute('data-key', expected.recommended!);
  await expect(page.locator('#s-rec')).toContainText('Recommended: ' + TITLE[expected.recommended!]);
  await expect(page.locator('.strategy[data-key="finance"]')).toContainText('Turn on financing above to compare it.');
  const cash = expected.strategies.find((s) => s.key === 'cash')!.fleet!;
  await expect(page.locator('.strategy[data-key="cash"] .metric').nth(1)).toContainText('$' + Math.round(cash.purchase).toLocaleString('en-US'));
});

test('turning on financing adds a plan with its loan and interest', async ({ page }) => {
  await page.goto(page_);
  await page.getByRole('checkbox', { name: /I can finance/ }).check();
  await page.getByRole('spinbutton', { name: 'Rate' }).fill('8');
  await page.getByRole('combobox', { name: 'over' }).selectOption('24');
  const f = plan({ finance: true, apr: 8, termMonths: 24 }).strategies.find((s) => s.key === 'finance')!.fleet!;
  const card = page.locator('.strategy[data-key="finance"]');
  await expect(card.locator('.metric').nth(1)).toContainText('$' + Math.round(f.financed).toLocaleString('en-US') + ' financed');
  await expect(card.locator('.metric').nth(2)).toContainText('loan for 24 mo');
  await expect(card).toContainText('The loan adds');
});

test('limits change the plan and persist across a reload', async ({ page }) => {
  await page.goto(page_);
  await page.getByRole('spinbutton', { name: 'Cash available now' }).fill('500');
  await page.getByRole('checkbox', { name: /Rack servers/ }).uncheck();
  await page.getByRole('spinbutton', { name: 'Most machines to run' }).fill('2');
  const expected = plan({ cash: 500, serversOk: false, maxBoxes: 2 });
  const cash = expected.strategies.find((s) => s.key === 'cash')!.fleet!;
  await expect(page.locator('.strategy[data-key="cash"] .metric').first()).toContainText(String(cash.agents));
  await expect(page.locator('.strategy[data-key="cash"]')).not.toContainText('Rack servers');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Cash available now' })).toHaveValue('500');
  await expect(page.getByRole('checkbox', { name: /Rack servers/ })).not.toBeChecked();
  await page.getByRole('spinbutton', { name: 'Monthly limit' }).fill('1');
  await expect(page.locator('#s-rec')).toContainText('No strategy fits these limits.');
});

test('the target follows the calculator and a machine opens there', async ({ page }) => {
  await page.goto(site);
  await page.getByRole('spinbutton', { name: 'Agents you want', exact: true }).fill('8');
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Strategy' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Agents you want' })).toHaveValue('8');
  const link = page.locator('.strategy').first().locator('.fleet a').first();
  const name = await link.textContent();
  await link.click();
  await expect(page.locator('#mname')).toHaveValue(name!);
});

test('blocked storage still plans at the defaults', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(page_);
  await expect(page.locator('.strategy')).toHaveCount(4);
  expect(errors).toEqual([]);
});

for (const width of [400, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`strategy page at ${width}px ${colorScheme} stays inside the page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(page_);
      await page.getByRole('checkbox', { name: /I can finance/ }).check();
      await expect(page.locator('.strategy[data-key="finance"] .metrics')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(colorScheme === 'dark' ? 'rgb(13, 18, 25)' : 'rgb(241, 243, 247)');
      const origin = new URL(page.url()).origin;
      expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
