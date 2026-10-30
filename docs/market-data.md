# Market data

The cost chart plots the report's 23 presets, Aaron's own machines (_AB, with PassMark sources) and market listings. This file explains where the market numbers come from, the rules they pass, how to add more, and what is still missing.

## Files

| File | Holds | Changed by |
| --- | --- | --- |
| `src/data/presets.ts` | The report's 23 machines, unchanged, plus Aaron's own machines (_AB) with PassMark sources in `catalog.ts` | Hand, only for an intentional model update |
| `src/data/cpus.json` | One row per processor: PassMark single-thread rating (`st`), CPU Mark (`mt`), TDP, source page, snapshot date | Hand |
| `src/data/listings.json` | One row per priced machine: processor id, memory, price, condition, type, source page, date | Hand |
| `src/data/market-prices.json` | eBay median asking prices by listing id | `scripts/refresh-prices.mjs` only |
| `src/data/catalog.ts` | Joins the above into the machines both pages use | Code |

A listing needs only a processor id, memory, price and source, because scores come from `cpus.json` and power is estimated when no review measured it.

## Rules every row passes

`test/catalog.test.ts` enforces these:

- Every processor has both PassMark scores and a `cpubenchmark.net` source. The one exception is the Apple M5 Pro, M5 Max and M6 rows. They carry the report's own estimates in PassMark terms, are marked `estimated`, and cite the report, because PassMark rates Apple chips lower than build benchmarks do.
- Every listing names a known processor, a positive price and memory, and an `https` source.
- Market listing ids never collide with preset ids, and presets pass through the catalog unchanged.
- The power estimate stays within 15% of the report's measured or estimated load watts for its reference machines.

## How the numbers were gathered (October 2026)

Processor scores and listing prices were collected on 2026-10-29 from web search results that cite their pages. `cpubenchmark.net` itself is blocked in the session that did the work, so every score was read from a search result naming its PassMark page, never from memory. Where snapshots disagreed, the most recent dated one was used. Listings were then filtered:

- dropped when the processor had no sourced scores;
- dropped when under 16 GB of memory was installed;
- dropped when the price predates 2026, because DDR5 prices roughly quadrupled during 2026;
- dropped when the listing was outside the US.

That kept 35 of 92 researched listings. Each kept row carries the researcher's caveats in `notes`, for example an asking price, a single listing, an included GPU or a price far above typical. The calculator shows them under the machine.

PassMark's terms of use could not be checked from the session. The rows hold individual published figures with a link to each page. Licensing PassMark's data is the alternative if that matters for a public site.

## Power

Few listings have measured wall power. Without it, `estimatePower` in `catalog.ts` uses idle by machine type and load = base + 1.3 × TDP (base 20 W for mini PCs, 90 W otherwise), with mobile chips run at 45 W or more and Ryzen AI Max boxes at 120 W. The table and tooltips label these "power estimated".

## eBay price refresh

`scripts/refresh-prices.mjs` searches eBay's Browse API for each listing with an `ebayQuery`. It keeps fixed-price US results whose title names the processor and the memory size and isn't a parts or barebones sale. It then records a trimmed median when at least five results match. The weekly `Refresh market prices` workflow runs it and opens a pull request with the price changes.

To turn it on:

1. Create an eBay developer keyset with Browse API access at developer.ebay.com.
2. Add `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` as repository secrets.
3. Enable Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests".
4. Run the workflow once by hand and review its pull request.

The script is tested against a stub of the API (`test/refresh-prices.test.ts`) and has not yet run against live eBay. Asking prices run above sale prices, and eBay's sold-item data sits behind its restricted Marketplace Insights API.

## Adding data

- **One machine you found:** use "Add a machine you found" on the cost chart. It stays in your browser. Export it to share or to paste into `listings.json`.
- **A processor:** add a row to `cpus.json` with both scores and the PassMark page. The id is the lowercased name with non-alphanumerics as hyphens.
- **A listing:** add a row to `listings.json` with a `mk-` id, then run `npm test`.

## Still missing

These processors have no scores yet, so listings using them were dropped. They are the next research batch.

- **Intel:** i5-14500T, i5-14500, i7-14700, i9-14900K, Core Ultra 5 225, Ultra 5 245K, Ultra 7 265K, Ultra 9 285K, Ultra 5 125H, Ultra 7 155H, Ultra 9 185H, Ultra 7 255H, Ultra 9 285H, N100, i3-N305, i5-12450H, i7-12700H, i9-12900H, i9-13900H, i5-1240P, i7-1260P, i5-11500, i5-8350U, i7-8665U, i5-1135G7, i7-1165G7, i5-1145G7, i7-1185G7.
- **Xeon Scalable and W, common in used workstations and servers:** Silver 4114, 4210; Gold 5122, 6130, 6136, 6150, 6152, 6154, 6234, 6240, 6244, 6246; W-2133, W-2155, w7-2495X; E5-2699 v4; Core i7-7820X, i9-7900X.
- **AMD:** Ryzen AI 9 365, Ryzen 7 8745HS, Ryzen 9 8945HS, Ryzen 9 9955HX, Ryzen AI Max+ PRO 495.
- **Apple:** M2, M2 Pro, M2 Max, M2 Ultra, M3, M3 Pro, M3 Max, M3 Ultra, M4, M4 Pro, M4 Max, M5, M5 Pro (15-core), M5 Ultra.
- **Price classes not yet covered:** new towers and workstations (Dell Pro Max, HP Z2/Z4, ThinkStation P3/P5/P8, System76, Puget), used Ryzen and Core desktop builds, and EPYC boards sold with memory.
