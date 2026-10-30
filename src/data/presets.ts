/**
 * Preset machines and default assumptions.
 *
 * Source: the October 2026 research report (docs/research-report.md), except the
 * _AB entries, which are Aaron's own machines with PassMark sources.
 * Scores are PassMark (single-thread rating, CPU Mark). Mac scores are
 * estimates converted into PassMark terms. "est." figures are flagged in `note`.
 * Ported 1:1 from prototype/agent-slot-calculator.html.
 */
import type { Assumptions, Machine } from '../lib/model';

export const REFERENCE_ID = '270k128';

export const DEFAULTS: Assumptions = {
  p: 0.30,
  slotGB: 12,
  threads: 4,
  residentGB: 1,
  serial: 0.5,
  rate: 0.35,
  loadShare: 0.35,
  years: 3,
  target: 20,
  refPrice: 3000,
};

export const PRESETS: Machine[] = [
  { id: 'm920q', group: 'Used small PCs', name: 'Lenovo M920q · i5-8500T · 16 GB (used)', price: 225, ram: 16, st: 1997, mt: 7880, idle: 13, load: 65, reserve: 6, upGB: 32, upCost: 390, note: 'Used price $210–240. Load watts estimated. 32 GB of SO-DIMM is about $390.' },
  { id: 'm720q', group: 'Used small PCs', name: 'Lenovo M720q · i7-8700T · 32 GB (used)', price: 363, ram: 32, st: 2320, mt: 10510, idle: 12, load: 65, reserve: 6, upGB: 0, upCost: 0, note: 'Price from one listing. Load watts estimated.' },
  { id: 't10500', group: 'Used small PCs', name: '1-litre i5-10500T · 16 GB (used)', price: 320, ram: 16, st: 2270, mt: 10510, idle: 11, load: 65, reserve: 6, upGB: 64, upCost: 650, note: 'ThinkCentre M90q / OptiPlex 7080 / EliteDesk 800 G6 class, $289–350. Upgrade cost estimated.' },
  { id: 't12500', group: 'Used small PCs', name: 'ThinkCentre Gen 3+ · i5-12500T · 16 GB (used)', price: 400, ram: 16, st: 3440, mt: 16312, idle: 11, load: 65, reserve: 6, upGB: 64, upCost: 650, note: 'PassMark scores are real. The price is a placeholder: enter the listing you found. Power and upgrade cost estimated.' },
  { id: 'ser8', group: 'New mini PCs', name: 'Beelink SER8 · Ryzen 7 8845HS · 64 GB', price: 1750, ram: 64, st: 3730, mt: 28250, idle: 9, load: 78, reserve: 6, upGB: 0, upCost: 0, note: '$799 with 24 GB; about $1,000 more for 64 GB of SO-DIMM.' },
  { id: 'ser9', group: 'New mini PCs', name: 'Beelink SER9 · Ryzen AI 9 HX 370 · 32 GB', price: 1075, ram: 32, st: 3920, mt: 34820, idle: 8, load: 77, reserve: 6, upGB: 0, upCost: 0, note: 'RAM is soldered, so it can’t be upgraded.' },
  { id: 'evox2', group: 'New mini PCs', name: 'GMKtec EVO-X2 · Ryzen AI Max+ 395 · 128 GB', price: 3575, ram: 128, st: 4160, mt: 54530, idle: 11, load: 165, reserve: 6, upGB: 0, upCost: 0, note: 'RAM is soldered. $3,499–3,649.' },
  { id: '5950x', group: 'Desktops', name: 'Ryzen 9 5950X · 128 GB DDR4 (used build)', price: 1875, ram: 128, st: 3500, mt: 45330, idle: 70, load: 225, reserve: 6, upGB: 0, upCost: 0, note: 'Build price estimated from one CPU listing. Power estimated. AM4 is a dead platform.' },
  { id: '270k64', group: 'Desktops', name: 'Core Ultra 7 270K Plus · 64 GB (new build)', price: 2050, ram: 64, st: 5073, mt: 68506, idle: 77, load: 252, reserve: 6, upGB: 128, upCost: 930, note: 'Includes an estimated $400–450 for board, PSU, case and cooler. A second 64 GB kit is about $930.' },
  { id: '270k128', group: 'Desktops', name: 'Core Ultra 7 270K Plus · 128 GB (new build)', price: 3000, ram: 128, st: 5073, mt: 68506, idle: 77, load: 252, reserve: 6, upGB: 0, upCost: 0, note: 'The reference box. $2.8–3.2k including an estimated $400–450 for board, PSU, case and cooler.' },
  { id: '9950x64', group: 'Desktops', name: 'Ryzen 9 9950X · 64 GB (new build)', price: 2400, ram: 64, st: 4726, mt: 65693, idle: 80, load: 300, reserve: 6, upGB: 128, upCost: 930, note: 'Load watts estimated. Board allowance estimated.' },
  { id: '9950x128', group: 'Desktops', name: 'Ryzen 9 9950X · 128 GB (new build)', price: 3400, ram: 128, st: 4726, mt: 65693, idle: 80, load: 300, reserve: 6, upGB: 192, upCost: 2050, note: '$3.1–3.7k. AM5 has a verified path to 192 GB.' },
  { id: '9950x192', group: 'Desktops', name: 'Ryzen 9 9950X · 192 GB (new build)', price: 5600, ram: 192, st: 4726, mt: 65693, idle: 80, load: 300, reserve: 6, upGB: 0, upCost: 0, note: 'Memory above 128 GB costs more per GB.' },
  { id: 'epyc', group: 'Servers and Threadripper', name: 'EPYC 7B13 · 64 cores · 256 GB DDR4 (used)', price: 4600, ram: 256, st: 2550, mt: 80800, idle: 110, load: 350, reserve: 6, upGB: 0, upCost: 0, note: 'Listings are mostly engineering samples or vendor-locked parts. Loud. Power estimated.' },
  { id: 'tr9970', group: 'Servers and Threadripper', name: 'Threadripper 9970X · 128 GB RDIMM', price: 8950, ram: 128, st: 4537, mt: 107740, idle: 128, load: 500, reserve: 6, upGB: 256, upCost: 3780, note: 'Needs registered ECC memory at $35–46/GB.' },
  { id: 'tr9980', group: 'Servers and Threadripper', name: 'Threadripper 9980X · 128 GB RDIMM', price: 10800, ram: 128, st: 4537, mt: 143870, idle: 140, load: 534, reserve: 6, upGB: 256, upCost: 3800, note: 'Needs registered ECC memory at $35–46/GB.' },
  { id: 'tr9980b', group: 'Servers and Threadripper', name: 'Threadripper 9980X · 256 GB RDIMM', price: 14600, ram: 256, st: 4537, mt: 143870, idle: 140, load: 534, reserve: 6, upGB: 0, upCost: 0, note: 'Needs registered ECC memory at $35–46/GB.' },
  { id: 'm6', group: 'New Macs', name: 'Mac mini M6 · 32 GB', price: 1299, ram: 32, st: 4726, mt: 44010, idle: 4, load: 70, reserve: 8, upGB: 0, upCost: 0, note: 'Mac scores are estimates in PassMark terms. RAM is fixed at purchase.' },
  { id: 'm5pro', group: 'New Macs', name: 'Mac mini M5 Pro 18-core · 64 GB', price: 2899, ram: 64, st: 4726, mt: 60440, idle: 6, load: 145, reserve: 8, upGB: 0, upCost: 0, note: 'Mac scores are estimates in PassMark terms. RAM is fixed at purchase.' },
  { id: 'm5max', group: 'New Macs', name: 'Mac Studio M5 Max · 128 GB', price: 4799, ram: 128, st: 4726, mt: 62410, idle: 7, load: 200, reserve: 8, upGB: 0, upCost: 0, note: 'Mac scores are estimates in PassMark terms. Worth it mainly if you need macOS lanes anyway.' },
  { id: 'ab-pve', group: 'Already yours', owned: true, name: 'pve (Proxmox) · Core Ultra 9 285K · 64 GB_AB', price: 0, ram: 64, st: 5087, mt: 67229, idle: 70, load: 253, reserve: 6, upGB: 0, upCost: 0, note: 'Your main Proxmox host. It already runs CT100 and other guests, so less memory is free than shown. Power estimated.' },
  { id: 'ab-base-desk', group: 'Already yours', owned: true, name: 'base-desk · Ryzen 7 5800X · 64 GB_AB', price: 0, ram: 64, st: 3448, mt: 27662, idle: 70, load: 227, reserve: 6, upGB: 0, upCost: 0, note: 'Tdarr CPU node; suspends when idle. Power estimated.' },
  { id: 'ab-pve-shop', group: 'Already yours', owned: true, name: 'pve-shop (Proxmox) · Ryzen 5 5600G · 48 GB_AB', price: 0, ram: 48, st: 3179, mt: 19618, idle: 70, load: 175, reserve: 6, upGB: 0, upCost: 0, note: 'Shared with Tdarr SHOP-Node and the shop-agents container. Power estimated.' },
  { id: 'ab-shop-desk', group: 'Already yours', owned: true, name: 'shop-desk · NUC 11 · i5-1145G7 · 32 GB_AB', price: 0, ram: 32, st: 2661, mt: 9198, idle: 10, load: 79, reserve: 6, upGB: 0, upCost: 0, note: 'QSV Tdarr node. Power estimated.' },
  { id: 'ab-hp640', group: 'Already yours', owned: true, name: 'HP EliteBook 640 G11 · Core Ultra 7 165U · 32 GB_AB', price: 0, ram: 32, st: 3396, mt: 17535, idle: 10, load: 79, reserve: 6, upGB: 0, upCost: 0, note: 'Your daily laptop. Power estimated.' },
  { id: 'ab-yoga9', group: 'Already yours', owned: true, name: 'Yoga 910 · i7-7500U · 16 GB_AB', price: 0, ram: 16, st: 1899, mt: 3634, idle: 10, load: 79, reserve: 6, upGB: 0, upCost: 0, note: 'Wi-Fi only, no wake-on-LAN. Power estimated.' },
  { id: 'ab-pve-tiny', group: 'Already yours', owned: true, name: 'pve-tiny · ThinkCentre M93p Tiny · i5-4570T · 8 GB_AB', price: 0, ram: 8, st: 1885, mt: 3216, idle: 10, load: 66, reserve: 6, upGB: 0, upCost: 0, note: 'Proxmox node on a 5400 rpm HDD. Power estimated.' },
  { id: 'mbp', group: 'Already yours', owned: true, name: 'Your MacBook Pro M1 Max', price: 0, ram: 32, st: 3690, mt: 26930, idle: 11, load: 115, reserve: 8, upGB: 0, upCost: 0, note: 'Set RAM to 64 if yours has it. Scores and power are estimates.' },
  { id: 'imac', group: 'Already yours', owned: true, name: 'Workplace iMac M4 · 16 GB', price: 0, ram: 16, st: 4726, mt: 28900, idle: 43, load: 100, reserve: 8, upGB: 0, upCost: 0, note: 'Power includes the display. Scores are estimates. Only if your workplace agrees.' },
  { id: 'xeon', group: 'Already yours', owned: true, name: '2015 Proxmox box (if dual Xeon E5 v4, 128 GB)', price: 0, ram: 128, st: 1610, mt: 28900, idle: 75, load: 272, reserve: 6, upGB: 0, upCost: 0, note: 'Assumes dual E5 v4 with 128 GB; run lscpu and free -g to check. Idle ranges 47 to 100+ W.' },
];
