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

### Micro Center bundles

The `mk-microcenter-` rows are Micro Center's in-store CPU, board and memory bundles, read from the bundle pages on 2026-10-29. One row per CPU, using its cheapest board; a pricier board adds no agents. An extra row, `mk-microcenter-270k-plus-160`, keeps the 270K Plus bundle's 2×16 GB kit and adds 2×64 GB DDR5 in the free slots, 160 GB in all, with the sticks in its price. Each is priced as a complete machine. Desktop bundles are priced as shipped, with their 16–32 GB kit, plus the report's $210 2 TB NVMe; going to 128 GB is the machine's RAM upgrade (2×64 GB DDR5 at $1,852, or $976 of DDR4 for AM4 at default prices), priced from the Settings page. Workstation bundles already include 128 GB of registered memory and add the same NVMe. Every bundle then gets the default parts: a Rosewill RSV-L4620 4U chassis ($200), ARCTIC P12 Pro PST 5-pack ($20), two Noctua NF-S12B redux-1200 ($35), a cooler and an 80 PLUS Gold PSU. The cooler is the ARCTIC Liquid Freezer III Pro 360 ($70) on desktop sockets; workstation sockets get ARCTIC's WS360 AIOs: WS360-SP6 ($159) on Threadripper sTR5, WS360-SP5 ($174) on EPYC and WS360-4710 ($115) on Xeon 6 (owner-supplied prices, 2026-11-01). The chassis, fan and AIO prices are owner-supplied, from Aaron's default parts list (2026-10-29). Only two Gold sizes were priced: a [Seasonic Focus GX-750](https://slickdeals.net/f/19443312-seasonic-focus-gx-750w-atx-3-1-fully-modular-power-supply-w-10-year-warranty-90-free-s-h) 750 W ($90, 2026-04) and a [Seasonic Focus GX-1000](https://slickdeals.net/f/19715775-seasonic-focus-gx-1000-1000w-atx-3-1-fully-modular-power-supply-white-129-00-free-shipping) 1000 W ($130, 2026). Each row takes the smaller of the two that keeps the estimated full load at or under 55% of its rating, which is 750 W for desktops and 1000 W for workstations. 550, 650 or 850 W Gold units would also meet the rule on the lighter machines, but they were not priced. Gold is the choice for machines that run around the clock. Against a plain 80 PLUS unit it saves about $33 of power over three years at $0.11/kWh on a 270K box, roughly its price premium, and comes with a 7–10 year warranty. Platinum and Titanium save another $10–20 over three years, less than they cost. Power estimates are unchanged, since `estimatePower` is calibrated on wall measurements taken with typical Gold-class units. Each row's `notes` gives the breakdown, and its `build` field holds it in structured form so the Settings page can reprice it. `price` is the as-shipped total at the default settings. The Xeon 654 and Ryzen 5 5600X3D bundles are left out because PassMark has no CPU Mark for them yet.

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

### GMKtec store

The `mk-gmktec-` rows added on 2026-11-08 come from GMKtec's AMD mini PC collection (`gmktec.com/collections/amd-mini-pc`), read through the store's product data that day, with each row's `source` linking its product page. One row per configuration a buyer would consider. Prices are the store's sale prices, and the list price is in `notes`. Memory limits (`maxRam`) are from each product page's spec table; where a page gives two figures, the lower one is used.

- **Barebones:** each barebone is a complete working machine: the barebone, a 96 GB DDR5 SO-DIMM kit (Crucial 2×48 GB, $899.99, Newegg) or a 64 GB kit (G.Skill 2×32 GB, $900, DatacenterDisk) where the box tops out at 64 GB, and the report's $210 2 TB NVMe. These totals are static and don't follow the Settings page.
- **NEO-X1 Pro:** these rows include a graphics card that agents don't use. Their power estimate leaves the GPU out, so real running costs are higher.
- **16 GB machines:** the 16 GB-only models are listed so they show up as unable to hold an agent at the default settings.
- **Left out:** the G11 (Ryzen Embedded R2514), sold out for US delivery.

Thirteen processors were added for these rows, each from a PassMark comparison page found through web search. The 7730U and 6950H rows use older snapshots (2025-02 and an undated page read in 2026-11) because those pages could be tied to an exact URL. The report's EVO-X2 preset gets 11 agents and the market rows 14, because PassMark's figure for the 395 rose from 54,530 to 55,040. That 1% crosses the point where a seventh simultaneous build fits the CPU at the default settings.

## Still missing

These processors have no scores yet, so listings using them were dropped. They are the next research batch.

- **Intel:** i5-14500T, i5-14500, i7-14700, i9-14900K, Core Ultra 5 225, Ultra 5 245K, Ultra 7 265K, Ultra 5 125H, Ultra 7 155H, Ultra 9 185H, Ultra 7 255H, Ultra 9 285H, N100, i3-N305, i5-12450H, i7-12700H, i9-12900H, i9-13900H, i5-1240P, i7-1260P, i5-11500, i5-8350U, i7-8665U, i5-1135G7, i7-1165G7, i5-1145G7, i7-1185G7.
- **Xeon Scalable and W, common in used workstations and servers:** Silver 4114, 4210; Gold 5122, 6130, 6136, 6150, 6152, 6154, 6234, 6240, 6244, 6246; W-2133, W-2155, w7-2495X; E5-2699 v4; Core i7-7820X, i9-7900X.
- **AMD:** Ryzen AI 9 365, Ryzen 7 8745HS.
- **Apple:** M2, M2 Pro, M2 Max, M2 Ultra, M3, M3 Pro, M3 Max, M3 Ultra, M4, M4 Pro, M4 Max, M5, M5 Pro (15-core), M5 Ultra.
- **Price classes not yet covered:** new towers and workstations (Dell Pro Max, HP Z2/Z4, ThinkStation P3/P5/P8, System76, Puget) and used Ryzen and Core desktop builds.
