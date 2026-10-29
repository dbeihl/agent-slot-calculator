#!/usr/bin/env node
/**
 * Refresh used-machine prices from eBay at build time (never in the browser).
 *
 * For every listing in src/data/listings.json with an `ebayQuery`, search eBay's
 * Browse API for fixed-price US listings, keep the results whose title names the
 * listing's processor and memory, and record a trimmed median asking price in
 * src/data/market-prices.json. The catalog uses that median in place of the
 * curated price. Fewer than MIN_MATCHES usable results leaves the curated price.
 *
 * Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (an eBay developer keyset with the
 * Browse API). Without them it prints a notice and exits 0 without writing.
 * Asking prices are not sale prices: sold-item data sits behind eBay's
 * restricted Marketplace Insights API.
 *
 *   node scripts/refresh-prices.mjs          # write src/data/market-prices.json
 *   node scripts/refresh-prices.mjs --dry    # print what would change
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
export const MIN_MATCHES = 5;
/** Titles that describe something other than a whole, working machine. */
const REJECT = /\b(for parts|not working|as[- ]is|barebones?|no (ram|memory|cpu|ssd|hdd|drive|os)|lot of|\d+\s*x\s*(lot|units)|motherboard only|case only)\b/i;

/** The model token a title must contain, e.g. "8500t" from "intel-core-i5-8500t", "7b13" from "amd-epyc-7b13". */
export function cpuToken(cpuId) {
  const parts = cpuId.split('-');
  return parts[parts.length - 1] === 'v4' ? parts.slice(-2).join(' ') : parts[parts.length - 1];
}

export function buildSearchUrl(query, { minPrice = 50, maxPrice = 20000 } = {}) {
  const u = new URL(SEARCH_URL);
  u.searchParams.set('q', query);
  u.searchParams.set('limit', '100');
  u.searchParams.set('filter', `buyingOptions:{FIXED_PRICE},conditionIds:{2000|2010|2020|2030|2500|3000},price:[${minPrice}..${maxPrice}],priceCurrency:USD,deliveryCountry:US`);
  return u.toString();
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

/** Does an eBay result title describe this listing: its processor, its memory, and a whole machine? */
export function titleMatches(title, listing) {
  if (REJECT.test(title)) return false;
  const t = norm(title);
  if (!t.includes(norm(cpuToken(listing.cpu)).trim())) return false;
  return new RegExp(`\\b${listing.ram}\\s*gb\\b`).test(t);
}

/** Price plus first shipping cost, in USD; null when either is missing or not in dollars. */
export function itemPrice(item) {
  if (item?.price?.currency !== 'USD') return null;
  const price = Number(item.price.value);
  const ship = item.shippingOptions?.[0]?.shippingCost;
  const shipping = ship && ship.currency === 'USD' ? Number(ship.value) : 0;
  return isFinite(price) && isFinite(shipping) ? price + shipping : null;
}

/** Trimmed median of the matching results: drop the cheapest and dearest tenth, then take the median. */
export function summarize(items, listing, fetched) {
  const matched = items
    .filter((it) => typeof it.title === 'string' && titleMatches(it.title, listing))
    .map((it) => ({ price: itemPrice(it), url: it.itemWebUrl }))
    .filter((x) => x.price != null)
    .sort((a, b) => a.price - b.price);
  if (matched.length < MIN_MATCHES) return null;
  const cut = Math.floor(matched.length / 10);
  const kept = matched.slice(cut, matched.length - cut);
  const mid = kept[Math.floor(kept.length / 2)];
  return {
    median: Math.round(mid.price),
    count: matched.length,
    low: Math.round(kept[0].price),
    high: Math.round(kept[kept.length - 1].price),
    fetched,
    sample: mid.url,
  };
}

/** @param {(url: string, init?: any) => Promise<Response>} fetchFn @param {string} clientId @param {string} clientSecret */
async function getToken(fetchFn, clientId, clientSecret) {
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) throw new Error(`eBay token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/**
 * Search eBay for every listing with an `ebayQuery` and return the new prices file.
 * @param {{ fetchFn?: (url: string, init?: any) => Promise<Response>, clientId: string, clientSecret: string,
 *   listings: { id: string, cpu: string, ram: number, ebayQuery?: string }[], now?: Date }} options
 */
export async function refresh({ fetchFn = fetch, clientId, clientSecret, listings, now = new Date() }) {
  const token = await getToken(fetchFn, clientId, clientSecret);
  const fetched = now.toISOString();
  /** @type {Record<string, ReturnType<typeof summarize>>} */
  const prices = {};
  /** @type {string[]} */
  const skipped = [];
  for (const listing of listings.filter((l) => l.ebayQuery)) {
    const res = await fetchFn(buildSearchUrl(listing.ebayQuery), { headers: { Authorization: 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
    if (!res.ok) throw new Error(`eBay search failed for ${listing.id}: ${res.status} ${await res.text()}`);
    const summary = summarize((await res.json()).itemSummaries || [], listing, fetched);
    if (summary) prices[listing.id] = summary;
    else skipped.push(listing.id);
  }
  return { file: { updated: fetched, prices }, skipped };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const { EBAY_CLIENT_ID: clientId, EBAY_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) {
    console.log('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not set, so prices were not refreshed.');
    return;
  }
  const listings = JSON.parse(await readFile(new URL('src/data/listings.json', ROOT), 'utf8'));
  const { file, skipped } = await refresh({ clientId, clientSecret, listings });
  const n = Object.keys(file.prices).length;
  console.log(`Refreshed ${n} listing${n === 1 ? '' : 's'}; ${skipped.length} kept their curated price (fewer than ${MIN_MATCHES} matching results): ${skipped.join(', ') || 'none'}.`);
  if (dry) { console.log(JSON.stringify(file, null, 2)); return; }
  await writeFile(new URL('src/data/market-prices.json', ROOT), JSON.stringify(file, null, 1) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
