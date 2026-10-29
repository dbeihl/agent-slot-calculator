/**
 * The build-time eBay price refresh, run against a stub of eBay's API so no
 * network or credentials are needed. It has not been run against live eBay.
 */
import { describe, expect, it } from 'vitest';
import { buildSearchUrl, cpuToken, itemPrice, refresh, summarize, titleMatches, MIN_MATCHES } from '../scripts/refresh-prices.mjs';

const listing = { id: 'mk-m720q', cpu: 'intel-core-i5-8500t', ram: 32, ebayQuery: 'ThinkCentre M720q i5-8500T 32GB' };
const item = (title: string, value: number, ship?: number) => ({
  title, itemWebUrl: 'https://www.ebay.com/itm/' + value, price: { value: String(value), currency: 'USD' },
  shippingOptions: ship == null ? [] : [{ shippingCost: { value: String(ship), currency: 'USD' } }],
});

describe('matching', () => {
  it('takes the model token from the processor id', () => {
    expect(cpuToken('intel-core-i5-8500t')).toBe('8500t');
    expect(cpuToken('intel-xeon-e5-2680-v4')).toBe('2680 v4');
  });

  it('accepts titles naming the processor and memory, and rejects parts and other configurations', () => {
    expect(titleMatches('Lenovo ThinkCentre M720q Tiny i5-8500T 32GB RAM 256GB SSD', listing)).toBe(true);
    expect(titleMatches('Lenovo M720q i5-8500T 32 GB', listing)).toBe(true);
    expect(titleMatches('Lenovo M720q i5-8500T 16GB', listing)).toBe(false);
    expect(titleMatches('Lenovo M720q i5-8400T 32GB', listing)).toBe(false);
    expect(titleMatches('Lenovo M720q i5-8500T 32GB FOR PARTS', listing)).toBe(false);
    expect(titleMatches('Lenovo M720q barebone i5-8500T 32GB', listing)).toBe(false);
  });

  it('adds shipping and ignores other currencies', () => {
    expect(itemPrice(item('x', 300, 20))).toBe(320);
    expect(itemPrice(item('x', 300))).toBe(300);
    expect(itemPrice({ price: { value: '300', currency: 'CAD' } })).toBeNull();
  });

  it('asks for fixed-price US listings in the given price range', () => {
    const u = new URL(buildSearchUrl('M720q i5-8500T 32GB'));
    expect(u.searchParams.get('q')).toBe('M720q i5-8500T 32GB');
    expect(u.searchParams.get('filter')).toContain('buyingOptions:{FIXED_PRICE}');
    expect(u.searchParams.get('filter')).toContain('priceCurrency:USD');
  });
});

describe('summary', () => {
  it('needs enough matches', () => {
    const few = Array.from({ length: MIN_MATCHES - 1 }, (_, i) => item('M720q i5-8500T 32GB', 300 + i));
    expect(summarize(few, listing, 't')).toBeNull();
  });

  it('takes a trimmed median of matching results', () => {
    const prices = [100, 290, 300, 310, 320, 330, 340, 350, 360, 2000];
    const items = [...prices.map((p) => item('M720q i5-8500T 32GB SSD', p)), item('M720q i5-8500T 32GB for parts', 50)];
    expect(summarize(items, listing, 't')).toMatchObject({ median: 330, count: 10, low: 290, high: 360, fetched: 't' });
  });
});

describe('refresh', () => {
  it('gets a token, searches each listing with a query, and keeps curated prices when results are thin', async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push(url);
      if (url.includes('oauth2/token')) return new Response(JSON.stringify({ access_token: 'tok' }));
      expect(init?.headers?.Authorization).toBe('Bearer tok');
      const q = new URL(url).searchParams.get('q')!;
      const items = q.includes('M720q') ? Array.from({ length: 6 }, (_, i) => item('M720q i5-8500T 32GB', 300 + i * 10, 15)) : [];
      return new Response(JSON.stringify({ itemSummaries: items }));
    };
    const other = { id: 'mk-other', cpu: 'intel-core-i5-10500t', ram: 32, ebayQuery: 'M90q i5-10500T 32GB' };
    const noQuery = { id: 'mk-new', cpu: 'intel-core-i5-10500t', ram: 32 };
    const { file, skipped } = await refresh({ fetchFn, clientId: 'id', clientSecret: 'secret', listings: [listing, other, noQuery], now: new Date('2026-10-29T00:00:00Z') });
    expect(calls).toHaveLength(3);
    expect(file.updated).toBe('2026-10-29T00:00:00.000Z');
    expect(file.prices['mk-m720q']).toMatchObject({ median: 345, count: 6 });
    expect(skipped).toEqual(['mk-other']);
  });
});
