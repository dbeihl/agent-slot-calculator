import { test, expect, type Page } from '@playwright/test';

const url = '/agent-slot-calculator/build/';

// CI renders this scene with software WebGL at about 1 frame/s.
test.describe.configure({ timeout: 60_000 });

test('builder sees the model, the fit check and a part’s details', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#view canvas')).toBeVisible();
  await expect(page.locator('#no-webgl')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Fit check' })).toBeVisible();
  await expect(page.locator('.pill')).toHaveText('Nothing overlaps');
  await page.getByRole('button', { name: 'Corsair SF1000 Platinum' }).click();
  await expect(page.locator('#part-info')).toContainText('125 × 100 × 63.5 mm');
  await expect(page.locator('#parts-body')).toContainText('$630');
  await expect(page.locator('#parts-body')).toContainText('In the bundle');
  await expect(page.locator('#build-total')).toContainText('total');
  await page.getByRole('button', { name: 'Rear', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Corsair SF1000 Platinum' })).toHaveAttribute('aria-pressed', 'true');
});

test('swapping parts updates the model, the fit check and the prices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  const boxes = () => page.evaluate(() => {
    const parts = new Set<string>();
    (window as any).__build.model().group.traverse((o: any) => o.userData.part && parts.add(o.userData.part));
    return [...parts];
  });
  const total = page.locator('#build-total');
  const before = await total.textContent();

  await page.getByLabel('GPU').selectOption('');
  expect(await boxes()).not.toContain('gpu');
  await expect(page.getByRole('button', { name: 'NVIDIA RTX A6000' })).toHaveCount(0);
  await expect(page.locator('#fit-flags')).not.toContainText('GPU');
  await expect(total).not.toHaveText(before!);
  await page.getByLabel('GPU').selectOption('a6000');
  expect(await boxes()).toContain('gpu');
  await expect(total).toHaveText(before!);

  await page.getByLabel('Power supply').selectOption('gx750');
  await expect(page.locator('.pill')).toHaveText('1 problem');
  await expect(page.locator('#fit-flags')).toContainText('psu pokes outside the chassis');

  await page.getByLabel('Chassis').selectOption('rosewill');
  await expect(page.locator('.pill')).toHaveText('Nothing overlaps');
  await expect(page.getByLabel('Power supply')).toHaveValue('gx750');
  await expect(page.getByLabel('Rear fans')).toHaveValue('p8');
  await expect(page.getByLabel('Rear fans').locator('option[value="nf-a6x25"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: '3 × ARCTIC P12 Pro PST, intermediary bracket' })).toBeVisible();
  await page.getByLabel('Rear fans').selectOption('nf-r8');
  await expect(page.getByRole('button', { name: '2 × Noctua NF-R8 redux-1800 PWM' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Rosewill RSV-L4620 4U rackmount chassis' })).toHaveAttribute('href', 'https://www.amazon.com/dp/B0FZ2VL2P7');
  // A chassis swap reframes the camera on the taller case.
  expect(await page.evaluate(() => (window as any).__build.controls.target.y)).toBe(80);

  await page.getByLabel('Chassis').selectOption('rackchoice');
  await expect(page.getByLabel('Power supply')).toHaveValue('sf1000');
  await expect(page.getByLabel('Rear fans')).toHaveValue('nf-a6x25');
  await expect(page.getByRole('button', { name: '3 × ARCTIC P12 Pro PST, intermediary bracket' })).toHaveCount(0);
  await expect(page.getByLabel('Bracket fans')).toBeDisabled();
});

test('Rosewill cooler tubes run past the bracket fans, inside the wall', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await page.getByLabel('Chassis').selectOption('rosewill');
  const { inFans, maxX } = await page.evaluate(() => {
    const { byPart } = (window as any).__build.model();
    const fans = byPart.get('fans-bracket').map((o: any) => o.position);
    let inFans = 0, maxX = 0;
    for (const t of byPart.get('cooler').filter((o: any) => o.geometry?.type === 'TubeGeometry')) {
      const p = t.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
        maxX = Math.max(maxX, x);
        if (fans.some((f: any) => Math.abs(x - f.x) < 60 && Math.abs(y - f.y) < 60 && Math.abs(z - f.z) < 12.5)) inFans++;
      }
    }
    return { inFans, maxX };
  });
  expect(inFans).toBe(0);
  expect(maxX).toBeLessThan(215);
});

test('leaving out the GPU warns only with a CPU that has no integrated graphics', async ({ page }) => {
  await page.goto(url);
  const warnings = page.locator('#swap-warnings');
  await expect(page.getByLabel('Chassis')).toHaveValue('rackchoice');
  await page.getByLabel('GPU').selectOption('');
  await expect(warnings).toBeEmpty();
  await page.getByLabel('CPU').selectOption('250kf-plus');
  await expect(warnings).toContainText('no integrated graphics');
  await page.getByLabel('GPU').selectOption('a6000');
  await expect(warnings).toBeEmpty();
});

test('the shroud follows the network card', async ({ page }) => {
  await page.goto(url);
  const shroud = page.getByRole('button', { name: /shroud/ });
  await expect(shroud).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dell Mellanox ConnectX-4 Lx CX4121C' })).toHaveAttribute('href', 'https://www.ebay.com/itm/298740750660');
  await page.getByLabel('Network card', { exact: true }).selectOption('');
  await expect(shroud).toHaveCount(0);
  await expect(page.getByLabel('Network card shroud')).toBeDisabled();
  await page.getByLabel('Network card', { exact: true }).selectOption('cx4121c');
  await expect(shroud).toBeVisible();
});

test('a chosen part stays selected across a swap of another part, and clears when removed', async ({ page }) => {
  await page.goto(url);
  const gpu = page.getByRole('button', { name: 'NVIDIA RTX A6000' });
  await gpu.click();
  await expect(page.locator('#part-info')).toContainText('Lowest new US price');
  await page.getByLabel('Chassis').selectOption('rosewill');
  await expect(gpu).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('GPU').selectOption('');
  await expect(page.locator('#part-info')).toContainText('Click a part');
});

test('going back to the page shows the default parts in the dropdowns as well as the table', async ({ page }) => {
  await page.goto(url);
  const total = page.locator('#build-total');
  const before = await total.textContent();
  await page.getByLabel('Chassis').selectOption('rosewill');
  await page.getByLabel('GPU').selectOption('');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/settings/);
  await page.goBack();
  await expect(total).toHaveText(before!);
  await expect(page.getByLabel('Chassis')).toHaveValue('rackchoice');
  await expect(page.getByLabel('GPU')).toHaveValue('a6000');
  await expect(page.getByLabel('Power supply')).toHaveValue('sf1000');
});

test('without WebGL the parts table still shows and the swaps are hidden', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto(url);
  await expect(page.locator('#no-webgl')).toBeVisible();
  await expect(page.locator('#swaps')).toBeHidden();
  await expect(page.locator('#parts-body')).toContainText('NVIDIA RTX A6000');
});

test('build page has no horizontal scroll at 400px', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(url);
  await expect(page.locator('#view canvas')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide).toBe(false);
});

// Camera position and orbit target, read two frames on so a resize or drag has reached them.
function cameraState(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const { camera, controls } = (window as any).__build;
    return [...camera.position.toArray(), ...controls.target.toArray()];
  });
}

// A pan glides for hundreds of frames, so tests check one mid-glide with cameraState rather than wait here.
async function settled(page: Page) {
  let last = await cameraState(page);
  await expect(async () => {
    await page.waitForTimeout(150);
    const next = await cameraState(page);
    const same = next.every((v, i) => Math.abs(v - last[i]) < 0.01);
    last = next;
    expect(same).toBe(true);
  }).toPass({ timeout: 30_000, intervals: [0] });
  return last;
}

const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.5);

async function zoom(page: Page, deltaY: number) {
  await page.locator('#view canvas').hover();
  await page.mouse.wheel(0, deltaY);
}

for (const preset of ['Front', 'Rear', 'Top']) {
  test(`${preset} view keeps its zoom after narrowing and widening the window`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(url);
    await page.getByRole('button', { name: preset, exact: true }).click();
    const before = await settled(page);
    await page.setViewportSize({ width: 400, height: 800 });
    await settled(page);
    await page.setViewportSize({ width: 1400, height: 1000 });
    expect(near(await settled(page), before)).toBe(true);
  });
}

test('a zoomed-in phone view survives rotating and rotating back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(url);
  await zoom(page, -20_000);
  const before = await settled(page);
  await page.setViewportSize({ width: 800, height: 400 });
  await settled(page);
  await page.setViewportSize({ width: 400, height: 800 });
  expect(near(await settled(page), before)).toBe(true);
});

test('the model stays drawn when fully zoomed out on a narrow phone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(url);
  await zoom(page, 20_000);
  await settled(page);
  const png = await page.locator('#view canvas').screenshot();
  const darkPixels = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 300) n++;
    return n;
  }, png.toString('base64'));
  expect(darkPixels).toBeGreaterThan(100);
});

async function frontPreset(page: Page) {
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  return settled(page);
}

async function rightDrag(page: Page) {
  const box = (await page.locator('#view canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 150);
  await page.mouse.up({ button: 'right' });
}

test('a view button brings a panned model back to the clean preset', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(url);
  const clean = await frontPreset(page);
  await rightDrag(page);
  expect(near(await cameraState(page), clean)).toBe(false);
  expect(near(await frontPreset(page), clean)).toBe(true);
});

test('a view button pressed straight after a pan leaves no drift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(url);
  const clean = await frontPreset(page);
  await rightDrag(page);
  expect(near(await frontPreset(page), clean)).toBe(true);
});

test.describe('on a touch phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 800 } });

  test('a view button brings the model back after a pinch whose fingers drift', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    const clean = await frontPreset(page);
    const box = (await page.locator('#view canvas').boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: points });
    const fingers = (spread: number, drift: number) => [
      { x: cx - spread + drift, y: cy + drift },
      { x: cx + spread + drift, y: cy + drift },
    ];
    await touch('touchStart', fingers(40, 0));
    for (let i = 1; i <= 2; i++) await touch('touchMove', fingers(40 + i * 25, i * 30));
    await touch('touchEnd', []);
    expect(near(await cameraState(page), clean)).toBe(false);
    expect(near(await frontPreset(page), clean)).toBe(true);
  });
});
