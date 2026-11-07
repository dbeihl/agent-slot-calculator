/** The Proxmox node build drawn on the Build page. Each slot holds the parts that can go in it; the first is the default.
 *  Each part has its size in mm and where that size came from, and a price with its source. Sizes with no datasheet
 *  behind them say so in `note`. Positions inside the chassis are in `src/lib/build/layout.ts`. */
import type { Settings } from '../lib/settings';

export interface BuildPart {
  id: string;
  name: string;
  /** One line of what it is. */
  spec: string;
  /** Size in mm, in the part's own terms. */
  size: string;
  /** Where the spec came from. */
  source?: string;
  /** How sure the size and position are, and anything unconfirmed. */
  note?: string;
  /** Where to get it. */
  url: string;
  /** USD for this line; a function follows the Settings page. 0 with `priceLabel` when another line pays for it. */
  price: number | ((s: Settings) => number | null);
  priceLabel?: string;
  /** The price's source when it isn't `url`. */
  priceUrl?: string;
  /** Where the price came from and when. */
  priceNote: string;
  /** The source can't confirm this exact item or the price; shown as "est." */
  estimated?: boolean;
  /** Only offered in this chassis. */
  chassis?: string;
  /** CPU without integrated graphics. */
  noIgpu?: boolean;
}

export interface Slot {
  /** Part id used by the layout boxes for picking and highlight. */
  id: string;
  label: string;
  /** Can be left out. */
  optional?: boolean;
  /** Only used when this other slot is filled. */
  requires?: string;
  parts: BuildPart[];
}

/** Which part fills each slot, by slot id; null leaves an optional slot empty. */
export type Config = Record<string, string | null>;

/** The Micro Center bundle's board, CPU and 2 × 16 GB kit. `test/build.test.ts` checks this against listings.json. */
export const BUNDLE_PRICE = 629.99;
const BUNDLE_URL = 'https://www.microcenter.com/site/content/bundle-and-save.aspx?bundle=intel';
const SETTINGS = 'Editable on the Settings page.';

export const SLOTS: Slot[] = [
  {
    id: 'chassis',
    label: 'Chassis',
    parts: [
      {
        id: 'rackchoice',
        name: 'RackChoice 3U rackmount chassis',
        spec: '19" rack, 8 full-height slots, SFX PSU, up to a 360 mm radiator',
        size: '428 × 400 × 133 body, 482.6 wide with the ears',
        source: 'https://www.amazon.com/dp/B0CPTBMQVB',
        note: 'Outside size from the listing diagram. Inside positions (slot openings, rear vent, PSU opening) were measured off the listing photos, so they can be 10 mm out. The stock drive cage and three 120 mm fans are left out.',
        url: 'https://www.amazon.com/dp/B0CPTBMQVB',
        price: 254.99,
        priceUrl: 'https://www.newegg.com/p/3C6-00UH-01FE4',
        priceNote: 'Newegg search result for a RackChoice 3U with 360 mm radiator support, 2026-11-06. Not confirmed as this exact listing; Amazon and Newegg both blocked a direct read.',
        estimated: true,
      },
      {
        id: 'rosewill',
        name: 'Rosewill RSV-L4620 4U rackmount chassis',
        spec: '19" rack, 8 full-height slots, ATX PSU, middle wall for 3 × 120 mm fans or a 360 mm radiator. Limits: cooler 158, card 330, PSU 180',
        size: '430 × 600 × 176.5 body, 482.6 wide with the ears',
        source: 'https://www.rosewill.com/rosewill-rsv-l4620-black-silver/p/9SIA072KNA9802',
        note: 'Outside size from the manual summary on manuals.plus, which labels 600 as width; a 19" rack case can’t be, so it is drawn 430 wide and 600 deep. Slots, vents and the PSU opening were scaled off Rosewill’s rear photo, so they can be 5 mm out. Radiator and bracket positions were scaled from photos of a built Rosewill, so they can be 10 mm out. The middle crossbar position is estimated from angled photos, so it can be 20 mm out. The drive trays and the three stock 120 mm fans are left out.',
        url: 'https://www.amazon.com/dp/B0FZ2VL2P7',
        price: (s) => s.parts.chassis,
        priceNote: `Aaron’s parts list, 2026-10-29. Rosewill’s store showed $229.99 on 2026-11-06; Amazon blocked a direct read. ${SETTINGS}`,
      },
    ],
  },
  {
    id: 'board',
    label: 'Motherboard',
    parts: [{
      id: 'z890-eagle',
      name: 'Gigabyte Z890 EAGLE WIFI7 PLUS',
      spec: 'From the Micro Center bundle. LGA 1851 ATX. 4 × DDR5, PCIe 5.0 x16, 2 × PCIe 4.0 x4, 4 × M.2',
      size: '305 × 244',
      source: 'https://www.gigabyte.com/Motherboard/Z890-EAGLE-WIFI7-PLUS/sp',
      note: 'Slot, socket, DIMM and heatsink positions were measured from a review photo, so they can be 5 mm out. The x16 slot is the second slot position; the x4 slots are the sixth and seventh.',
      url: BUNDLE_URL,
      price: BUNDLE_PRICE,
      priceNote: 'Micro Center bundle with the CPU and 2 × 16 GB kit, in store only, $629.99 on the bundle page 2026-10-29.',
    }],
  },
  {
    id: 'cpu',
    label: 'CPU',
    parts: [{
      id: '270k-plus',
      name: 'Intel Core Ultra 7 270K Plus',
      spec: 'From the Micro Center bundle. 24 cores (8P + 16E), LGA 1851',
      size: '45 × 37.5 package',
      note: 'Standard LGA 1851 package size, not checked against Intel’s datasheet.',
      url: BUNDLE_URL,
      price: 0,
      priceLabel: 'In the bundle',
      priceNote: 'Paid for on the motherboard line.',
    }, {
      id: '250kf-plus',
      name: 'Intel Core Ultra 5 250KF Plus',
      spec: '18 cores (6P + 12E), LGA 1851, no integrated graphics',
      size: '45 × 37.5 package',
      source: 'https://www.centralcomputer.com/intel-core-ultra-5-250kf-plus-processor-18-cores-5-3ghz-turbo-retail-box-bx80768250kf.html',
      note: 'Not in the bundle, so it is bought on top and the bundle’s 270K Plus is left over. Standard LGA 1851 package size, not checked against Intel’s datasheet.',
      url: 'https://www.centralcomputer.com/intel-core-ultra-5-250kf-plus-processor-18-cores-5-3ghz-turbo-retail-box-bx80768250kf.html',
      price: 199.99,
      priceNote: 'Central Computer search result, 2026-11-06.',
      noIgpu: true,
    }],
  },
  {
    id: 'ram',
    label: 'Memory',
    parts: [
      {
        id: 'crucial-2x64',
        name: 'Crucial Pro DDR5-5600, 2 × 64 GB (128 GB)',
        spec: 'CP2K64G56C46U5, replaces the bundle’s 2 × 16 GB kit, in the second and fourth DIMM slots from the CPU',
        size: '133.35 × 33 × 7 each',
        note: 'Height not checked; drawn at the size of the bundle’s sticks. Check the board’s memory support list. The bundle’s kit is left over to sell or reuse.',
        url: 'https://datacenterdisk.com/ram/ddr5/128gb',
        price: (s) => { const stick = s.ram.ddr5[64]; return stick == null ? null : stick * 2; },
        priceNote: `$1,852 for the kit, 2026-09-22. ${SETTINGS}`,
      },
      {
        id: 'bundle-kit',
        name: 'G.Skill Ripjaws S5 DDR5-6000, 2 × 16 GB (32 GB)',
        spec: 'F5-6000J3636F16GX2-RS5K, from the Micro Center bundle, in the second and fourth DIMM slots from the CPU',
        size: '133.35 × 33 × 7 each',
        note: 'Height from the product listing; the slot pair is the usual dual-channel pair.',
        url: BUNDLE_URL,
        price: 0,
        priceLabel: 'In the bundle',
        priceNote: 'Paid for on the motherboard line.',
      },
    ],
  },
  {
    id: 'cooler',
    label: 'Pump block',
    parts: [{
      id: 'lf3-pump',
      name: 'ARCTIC Liquid Freezer III Pro 360, pump block',
      spec: 'Pump and cold plate with the VRM fan, on the CPU',
      size: '98 × 78 × 55 (estimated)',
      source: 'https://www.scan.co.uk/products/arctic-liquid-freezer-iii-pro-argb-360-aio-hydro-cpu-cooler-black-3x120mm-p12-pro-60mm-vrm-fan-coppe',
      note: 'Block size estimated; ARCTIC quotes 63 mm of clearance for the whole unit. The tube route is a guess.',
      url: 'https://tomshardware.com/pc-components/the-best-cpu-cooler-money-can-buy-is-now-just-usd89-99-grab-28-percent-off-an-arctic-liquid-freezer-iii-pro-at-amazon-just-usd7-shy-of-its-best-ever-price',
      price: (s) => s.parts.cooler,
      priceNote: `The whole cooler: radiator and three P12 Pro fans included. Aaron’s parts list, 2026-10-29; the linked article has an Amazon sale at $89.99. ${SETTINGS}`,
    }],
  },
  {
    id: 'radiator',
    label: 'Radiator',
    parts: [{
      id: 'lf3-radiator',
      name: 'ARCTIC Liquid Freezer III Pro 360, radiator',
      spec: 'At the front of the case; in the RackChoice, on the fan wall where the stock fans were',
      size: '398 × 120 × 38',
      source: 'https://www.alza.cz/kod/CBlf3b07',
      note: 'In the RackChoice the fan row is 360 mm wide, so the radiator overhangs it by 19 mm each side, and the 15 mm gap to the fan wall is assumed.',
      url: 'https://tomshardware.com/pc-components/the-best-cpu-cooler-money-can-buy-is-now-just-usd89-99-grab-28-percent-off-an-arctic-liquid-freezer-iii-pro-at-amazon-just-usd7-shy-of-its-best-ever-price',
      price: 0,
      priceLabel: 'With the cooler',
      priceNote: 'Paid for on the pump block line.',
    }],
  },
  {
    id: 'fans-push',
    label: 'Push fans',
    parts: [{
      id: 'p12-push',
      name: '3 × ARCTIC P12 Pro PST, push',
      spec: 'Between the front panel and the radiator',
      size: '120 × 120 × 25 each',
      url: 'https://tomshardware.com/pc-components/the-best-cpu-cooler-money-can-buy-is-now-just-usd89-99-grab-28-percent-off-an-arctic-liquid-freezer-iii-pro-at-amazon-just-usd7-shy-of-its-best-ever-price',
      price: 0,
      priceLabel: 'With the cooler',
      priceNote: 'The cooler ships with three P12 Pro fans.',
    }],
  },
  {
    id: 'fans-pull',
    label: 'Pull fans',
    optional: true,
    parts: [{
      id: 'p12-pull',
      name: '3 × ARCTIC P12 Pro PST, pull',
      spec: 'Behind the radiator, facing the board',
      size: '120 × 120 × 25 each',
      url: 'https://www.centralcomputer.com/arctic-acfan00307a-p12-pro-pst-5-pack-black-powerful-premium-fan-120-mm-pwm-fan-with-y-cable-splitter-600-3000-rpm-0-rpm-5-pwm-fluid-dynamic-bearing-4-pin.html',
      price: (s) => s.parts.fans,
      priceNote: `One 5-pack. Aaron’s parts list, 2026-10-29; the link shows the same pack. ${SETTINGS}`,
    }],
  },
  {
    id: 'fans-bracket',
    label: 'Bracket fans',
    optional: true,
    parts: [{
      id: 'p12-bracket',
      name: '3 × ARCTIC P12 Pro PST, intermediary bracket',
      spec: 'In the Rosewill’s intermediary fan bracket, in place of its stock fans, between the radiator and the board',
      size: '120 × 120 × 25 each',
      url: 'https://www.centralcomputer.com/arctic-acfan00307a-p12-pro-pst-5-pack-black-powerful-premium-fan-120-mm-pwm-fan-with-y-cable-splitter-600-3000-rpm-0-rpm-5-pwm-fluid-dynamic-bearing-4-pin.html',
      price: (s) => s.parts.fans,
      priceNote: `A second 5-pack: nine fans in all, and the cooler brings three. ${SETTINGS}`,
      chassis: 'rosewill',
    }],
  },
  {
    id: 'gpu',
    label: 'GPU',
    optional: true,
    parts: [{
      id: 'a6000',
      name: 'NVIDIA RTX A6000',
      spec: '48 GB dual-slot blower card in the PCIe 5.0 x16 slot',
      size: '267 × 112, 2 slots',
      source: 'https://www.pugetsystems.com/parts/Video-Card/NVIDIA-RTX-A6000-48GB-PCI-E-13850',
      note: 'The A6000’s power plug is on the end facing the fans, so a cable needs room past the card end.',
      url: 'https://gpuprix.com/us/gpus/rtx-a6000',
      price: 5990,
      priceNote: 'Lowest new US price on GPUPrix (PNY at Amazon), updated 2026-11-03. Twelve-month low $4,996.',
    }],
  },
  {
    id: 'ssd',
    label: 'Boot drive',
    optional: true,
    parts: [{
      id: 'm461',
      name: 'MSI SPATIUM M461 2 TB',
      spec: 'M.2 2280 NVMe in M2A_CPU (PCIe 5.0 slot), under its heatsink',
      size: '80 × 22',
      url: 'https://www.maxmybuild.com/storage/nvme-ssds/msi-spatium-m461/2tb',
      price: 538.12,
      priceNote: 'The only in-stock US offer on MaxMyBuild, 2026-11-06. Its 30-day low is $299.99, and the calculator assumes $210 for a generic 2 TB NVMe.',
    }],
  },
  {
    id: 'nic',
    label: 'Network card',
    optional: true,
    parts: [{
      id: 'cx4121c',
      name: 'Dell Mellanox ConnectX-4 Lx CX4121C',
      spec: '2 × 25 GbE SFP28, PCIe 3.0 x8, in the first PCIe 4.0 x4 slot',
      size: '142 × 69 half-height card, drawn with a full-height bracket',
      source: 'https://www.starline.de/en/products/mellanox-mcx4121a-acat',
      note: 'Card length and height from the MCX4121A manual. The chassis has full-height slots only, so the half-height bracket it ships with cannot screw in.',
      url: 'https://www.ebay.com/itm/298740750660',
      price: 30,
      priceNote: 'The eBay listing chosen for this build, 2026-11-06.',
    }],
  },
  {
    id: 'nic-shroud',
    label: 'Network card shroud',
    optional: true,
    requires: 'nic',
    parts: [{
      id: 'cx4-shroud',
      name: '3D-printed ConnectX-4 Lx shroud with Noctua NF-A4x10 FLX',
      spec: 'Printed shroud over the card, with a 40 mm fan past the card’s end',
      size: 'About 190 × 65 × 18 shroud, 40 × 40 × 10 fan',
      source: 'https://noctua.at/en/nf-a4x10-flx/specification',
      note: 'Shroud size scaled off two photos of the printed part, using the 79 mm low-profile bracket, so it can be 10 mm out. The 18 mm thickness is the roughest of the three. Printables blocked a direct read, so check the model’s own dimensions.',
      url: 'https://www.printables.com/model/1715543-mellanox-connectx-4-lx-shroud',
      price: 17.95,
      priceUrl: 'https://www.amazon.com/s?k=Noctua+NF-A4x10+FLX',
      priceNote: '$2 for the printed shroud and $15.95 for the fan at Amazon, 2026-11-06.',
    }],
  },
  {
    id: 'psu',
    label: 'Power supply',
    parts: [
      {
        id: 'sf1000',
        name: 'Corsair SF1000 Platinum',
        spec: '1000 W SFX, fully modular, standing on end at the rear. Needs an SFX-to-ATX bracket in an ATX opening',
        size: '125 × 100 × 63.5',
        source: 'https://www.pugetsystems.com/parts/Power-Supply/Corsair-SF1000-Platinum-1000W-SFX-Power-Supply-15841/',
        url: 'https://www.maxmybuild.com/power-supplies/corsair-sf1000',
        price: 239.97,
        priceNote: 'Newegg and Corsair, in stock, via MaxMyBuild 2026-11-06. It sold for $169.99 in June 2026.',
      },
      {
        id: 'gx750',
        name: 'Seasonic Focus GX-750',
        spec: '750 W ATX, fully modular, the calculator’s default PSU for this machine, standing on end at the rear',
        size: '150 × 86 × 140',
        source: 'https://overclockers.co.uk/seasonic-focus-gx-750-atx-3.1-750w-80-gold-modular-power-supply-pow-ssc-03150.html',
        note: 'Size from retailer listings. Not checked against the A6000’s power draw.',
        url: 'https://slickdeals.net/f/19443312-seasonic-focus-gx-750w-atx-3-1-fully-modular-power-supply-w-10-year-warranty-90-free-s-h',
        price: (s) => s.parts.psu750,
        priceNote: `$90 deal, 2026-04. ${SETTINGS}`,
      },
    ],
  },
  {
    id: 'fans-rear',
    label: 'Rear fans',
    optional: true,
    parts: [{
      id: 'nf-a6x25',
      name: '2 × Noctua NF-A6x25 PWM',
      spec: 'On the rear vent, exhausting',
      size: '60 × 60 × 25 each',
      source: 'https://noctua.at/en/nf-a6x25-pwm/specification',
      note: 'The RackChoice vent’s screw holes are 50 mm apart, which is the 60 mm fan pattern.',
      url: 'https://www.buildcores.com/products/CaseFan/jusask5ic/Noctua-NF-A6x25-PWM-60mm-Brown-PWM-17.19-CFM-1-Pack',
      price: 33.9,
      priceNote: '$16.95 each via Amazon on BuildCores, 2026-11-06.',
      chassis: 'rackchoice',
    }, {
      id: 'p8',
      name: '2 × ARCTIC P8 PWM PST',
      spec: 'On the Rosewill’s rear vents, exhausting',
      size: '80 × 80 × 25 each',
      source: 'https://www.arctic.de/us/P8-PWM-PST/ACFAN00150A',
      url: 'https://aaawave.com/products/arctic-p8-pwm-pst-80mm-case-fan-cable-splitter-black',
      price: 19.98,
      priceNote: '$9.99 each at AAAWave, 2026-11-06.',
      chassis: 'rosewill',
    }, {
      id: 'nf-r8',
      name: '2 × Noctua NF-R8 redux-1800 PWM',
      spec: 'On the Rosewill’s rear vents, exhausting',
      size: '80 × 80 × 25 each',
      source: 'https://pcserverandparts.com/noctua-nf-r8-redux-1800-pwm-80mm-1800rpm-4-pin-pwm-sso-bearing-case-fan/',
      url: 'https://pcserverandparts.com/noctua-nf-r8-redux-1800-pwm-80mm-1800rpm-4-pin-pwm-sso-bearing-case-fan/',
      price: 29.98,
      priceNote: '$14.99 each at PC Server and Parts, search result 2026-11-06.',
      chassis: 'rosewill',
    }],
  },
];

/** The parts each chassis is built with; choosing a chassis sets these, and they can still be changed after. */
const CHASSIS_PARTS: Record<string, Config> = {
  rackchoice: { psu: 'sf1000', 'fans-rear': 'nf-a6x25', 'fans-bracket': null },
  rosewill: { psu: 'gx750', 'fans-rear': 'p8', 'fans-bracket': 'p12-bracket' },
};
export const withChassis = (c: Config, chassis: string): Config => ({ ...c, chassis, ...CHASSIS_PARTS[chassis] });

export const DEFAULT_CONFIG: Config = withChassis(Object.fromEntries(SLOTS.map((s) => [s.id, s.parts[0].id])), 'rackchoice');

/** Problems with the chosen parts that aren't about fit. */
export function buildWarnings(config: Config): string[] {
  const cpu = chosen(config).find((x) => x.slot.id === 'cpu')!.part;
  return !config.gpu && cpu.noIgpu ? [`No GPU, and the ${cpu.name} has no integrated graphics, so this machine has no video output. Add a GPU or pick a CPU with integrated graphics.`] : [];
}

/** The part in each filled slot. */
export function chosen(config: Config): { slot: Slot; part: BuildPart }[] {
  return SLOTS.flatMap((slot) => {
    const part = slot.parts.find((p) => p.id === config[slot.id]);
    return part && (!slot.requires || config[slot.requires]) ? [{ slot, part }] : [];
  });
}

export const partPrice = (p: BuildPart, s: Settings) => (typeof p.price === 'function' ? p.price(s) : p.price);

/** Sum of the priced lines, and how many have no price. */
export function buildTotal(config: Config, s: Settings) {
  const prices = chosen(config).map(({ part }) => partPrice(part, s));
  return { total: prices.reduce<number>((sum, v) => sum + (v ?? 0), 0), unpriced: prices.filter((v) => v == null).length };
}
