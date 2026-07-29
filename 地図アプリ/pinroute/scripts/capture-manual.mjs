/**
 * 操作マニュアル(docs/manual.html)用のスクリーンショットを撮る。
 *
 *   npm run build
 *   npm run manual
 *
 * 実際の国土地理院・Nominatim・OSRM に接続し、1ファイル版を file:// で開いて撮影する。
 * 利用者が実際に目にする画面と同じものを載せるため。
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const APP = `file://${resolve(ROOT, 'dist/PinRoute.html')}`;
const OUT = resolve(ROOT, 'docs/images');
mkdirSync(OUT, { recursive: true });

const shots = {};

async function shot(page, name, options = {}) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 72, ...options });
  writeFileSync(resolve(OUT, `${name}.jpg`), buf);
  shots[name] = buf.toString('base64');
  console.log(`  撮影: ${name}.jpg (${Math.round(buf.length / 1024)}KB)`);
}

/**
 * パネル部分だけを切り出すための領域。
 * パネルは画面の高さいっぱいに伸びるので、中身のある範囲までで切る
 * (下に大きな余白が入ると誌面が間延びして読みにくい)。
 */
async function panelBox(page, pad = 8) {
  return page.evaluate((padding) => {
    const panel = document.getElementById('panel');
    const rect = panel.getBoundingClientRect();
    let bottom = rect.top;
    for (const child of panel.children) {
      if (child.hidden) continue;
      const r = child.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return {
      x: rect.x,
      y: Math.max(rect.y - padding, 0),
      width: rect.width,
      height: Math.min(bottom - rect.y + padding * 2, rect.height + padding),
    };
  }, pad);
}

/**
 * パネルだけを撮る。
 * パネルは画面より縦に長くなることがあるので、撮影の間だけ画面を高くして全体を収める。
 */
async function panelShot(page, name) {
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.waitForTimeout(500);
  await shot(page, name, { clip: await panelBox(page) });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
}

/**
 * 指定した要素だけを囲む範囲を撮る。
 * 説明したい操作部分だけを載せたほうが、マニュアルとして見やすい。
 * maxHeight を渡すと、その高さまでで切る(長い一覧を全部載せない)。
 */
async function regionShot(page, name, selectors, maxHeight) {
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.waitForTimeout(500);
  const clip = await page.evaluate(
    ({ list, pad }) => {
      let top = Infinity;
      let bottom = -Infinity;
      let left = Infinity;
      let right = -Infinity;
      for (const sel of list) {
        const el = document.querySelector(sel);
        if (el === null || el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
      return {
        x: Math.max(left - pad, 0),
        y: Math.max(top - pad, 0),
        width: right - left + pad * 2,
        height: bottom - top + pad * 2,
      };
    },
    { list: selectors, pad: 8 },
  );
  if (maxHeight !== undefined) clip.height = Math.min(clip.height, maxHeight);
  await shot(page, name, { clip });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
}

async function search(page, query, { pickFirst = true } = {}) {
  await page.fill('#addr-input', query);
  await page.click('#add-btn');
  await page.waitForSelector('#add-btn:not(.is-loading)', { timeout: 25000 });
  if (pickFirst && !(await page.locator('#candidates').isHidden())) {
    await page.locator('#candidates .candidate button').first().click();
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'ja-JP',
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();

console.log('スクリーンショットを撮影します(実APIに接続)');

await page.goto(APP, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

// 1. 起動直後
await shot(page, '01-start');

// 2. 入力〜1件目
await page.fill('#addr-input', '東京駅');
await regionShot(page, '03-typing', ['#search-row']);
await search(page, '東京駅');
await page.waitForTimeout(1200);
await shot(page, '04-one-pin');

// 3. 3地点でルート
await page.waitForTimeout(1200);
await search(page, '横浜駅');
await page.waitForTimeout(1500);
await search(page, '鎌倉駅');
await page.waitForSelector('#route-bar:not([hidden])', { timeout: 25000 });
await page.waitForTimeout(2500);
await shot(page, '05-route');
await regionShot(page, '06-pin-list', ['#pins-header', '#pin-list'], 340);

await regionShot(page, '07-route-bar', ['#route-control', '#route-bar']);

// 4. 並び替え(3番目を先頭へ)
await page.locator('#pin-list .pin-row').nth(2).locator('.move-up').click();
await page.locator('#pin-list .pin-row').nth(1).locator('.move-up').click();
await page.waitForTimeout(3000);
await regionShot(page, '08-reordered', ['#pins-header', '#pin-list'], 340);

// 5. 一覧の番号で地図の地点を表示
await page.locator('#pin-list .pin-row').nth(0).locator('.pin-num').click();
await page.waitForTimeout(1200);
const mapBox = await page.locator('#map').boundingBox();
await shot(page, '09-popup', {
  clip: { x: mapBox.x, y: mapBox.y, width: mapBox.width, height: Math.min(mapBox.height, 520) },
});

// 6. 共有URL
await page.click('#share-btn');
await page.waitForTimeout(600);
await shot(page, '10-share');

// 7. 候補が複数のとき
await page.waitForTimeout(1500);
await search(page, '富士山', { pickFirst: false });
await page.waitForTimeout(600);
await regionShot(page, '11-candidates', ['#search-row', '#candidates']);
await page.keyboard.press('Escape');

// 8. 見つからないとき
await page.waitForTimeout(1500);
await search(page, 'ここには無い場所ざざざ', { pickFirst: false });
await page.waitForTimeout(600);
await regionShot(page, '12-not-found', ['#search-row', '#msg-area']);

// 9. まとめて入力と情報ブロック
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);

// 同梱のサンプルCSV(神保町駅から500m圏の10件)をそのまま使う
const PROPERTY_TSV = readFileSync(resolve(ROOT, 'docs/sample-properties.csv'), 'utf-8');

await page.locator('#bulk-panel summary').click();
await page.locator('#bulk-input').fill(PROPERTY_TSV);
await page.waitForTimeout(600);
await regionShot(page, '14-bulk-input', ['#bulk-panel']);

await page.locator('#bulk-run').click();
await page
  .waitForFunction(
    () => (document.getElementById('bulk-progress')?.textContent ?? '').includes('追加しました'),
    undefined,
    { timeout: 90000 },
  )
  .catch(() => {});
await page.waitForTimeout(3500);
await shot(page, '15-callouts');

// ブロックを1つドラッグして見せる
{
  const head = page.locator('.callout').first().locator('.callout-head');
  const b = await head.boundingBox();
  if (b !== null) {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 - 120, b.y + b.height / 2 + 170, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
}
await shot(page, '16-callout-dragged');

await page.locator('#label-panel summary').click();
await page.waitForTimeout(400);
await regionShot(page, '17-field-settings', ['#label-panel']);

// 9. モバイル
const mobile = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ja-JP',
  storageState: await context.storageState(),
});
const mpage = await mobile.newPage();
await mpage.goto(APP, { waitUntil: 'load' });
await mpage.waitForTimeout(3500);
await shot(mpage, '13-mobile');

await browser.close();

// マニュアルHTMLに画像を埋め込む(1ファイルで持ち運べるように)
const template = readFileSync(resolve(ROOT, 'docs/manual.template.html'), 'utf-8');
const filled = template.replace(/\{\{([\w-]+)\}\}/g, (m, key) => {
  const b64 = shots[key];
  if (b64 === undefined) {
    console.error(`  テンプレートの ${m} に対応する画像がありません`);
    return m;
  }
  return `data:image/jpeg;base64,${b64}`;
});
const outPath = resolve(ROOT, 'docs/manual.html');
writeFileSync(outPath, filled, 'utf-8');
console.log(`\n作成: docs/manual.html (${Math.round(filled.length / 1024)}KB)`);
