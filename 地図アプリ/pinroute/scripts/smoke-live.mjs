/**
 * 実APIに接続する疎通確認(テスト計画の MT-01 / MT-02 / MT-06 相当)。
 *
 *   npm run build && npm run preview   # 別ターミナルで起動しておく
 *   npm run smoke
 *
 * 自動テスト(vitest / playwright test)は外部サーバーに負荷をかけないよう
 * すべてモックで動く。そのぶん「テストは通るのに実際には使えない」状態を
 * 見逃しやすいため、実ブラウザ + 実APIでの確認手段を別に用意している。
 *
 * 判定内容:
 *  - 代表的な検索語で、期待する地点が候補の先頭に来るか
 *  - 3地点のルートで常識的な距離・所要時間が出るか
 *  - 帰属表示が画面に出ているか
 *  - ブラウザのコンソールエラー・リクエスト失敗がないか
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/';
const SHOT_DIR = '.smoke';

/** 期待地点から この距離(km)以内 なら正解とみなす。 */
const CASES = [
  { query: '東京駅', name: /東京駅/, lat: 35.6812, lng: 139.7671, tolKm: 1 },
  { query: '大阪市北区梅田1丁目', name: /梅田/, lat: 34.701, lng: 135.496, tolKm: 2 },
  { query: '札幌市時計台', name: /時計台/, lat: 43.0626, lng: 141.3536, tolKm: 1 },
  { query: '横浜駅', name: /^横浜駅$/, lat: 35.4657, lng: 139.6221, tolKm: 1 },
  { query: '名古屋城', name: /名古屋城/, lat: 35.1856, lng: 136.8997, tolKm: 1 },
  { query: '六本木ヒルズ', name: /六本木ヒルズ/, lat: 35.6604, lng: 139.7292, tolKm: 1 },
];

function distanceKm(a, b) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });
const page = await context.newPage();

const problems = [];
const hosts = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
});
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith('http') || u.includes('localhost')) return;
  const host = new URL(u).host;
  if (!hosts.includes(host)) hosts.push(host);
});
page.on('requestfailed', (r) => {
  if (r.url().includes('cyberjapandata')) return;
  // 連続操作時に古いルート要求を打ち切るのは設計どおりの動作
  if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
  problems.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`);
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

console.log('\n── MT-01 実API疎通: 検索結果の先頭(画面操作で確認) ──');
for (const c of CASES) {
  // Nominatimのレート制御(1req/秒)の待ちを挟まない、単発の検索として測る
  await page.waitForTimeout(1200);

  await page.fill('#addr-input', c.query);
  const started = Date.now();
  await page.click('#add-btn');
  // 検索完了 = 検索ボタンのローディング解除
  await page.waitForSelector('#add-btn:not(.is-loading)', { timeout: 20000 }).catch(() => {});
  const elapsed = Date.now() - started;

  if (!(await page.locator('#candidates').isHidden())) {
    await page.locator('#candidates .candidate button').first().click();
  }
  const row = page.locator('#pin-list .pin-row').first();
  if ((await row.count()) === 0) {
    check(`「${c.query}」`, false, '候補0件');
    continue;
  }
  const name = await row.locator('.pin-name').inputValue();
  const context = await row.locator('.pin-sub').textContent();
  await page.waitForTimeout(500); // 保存デバウンス(300ms)を待つ
  const point = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pinroute:state') ?? '{"pins":[]}');
    return s.pins[0] ?? null;
  });
  const km = point === null ? Infinity : distanceKm(point, c);
  check(
    `「${c.query}」→「${name}」《${context}》 ${km.toFixed(2)}km差`,
    c.name.test(name) && km < c.tolKm,
  );
  check(`  NFR-07: 3秒以内に候補表示`, elapsed < 3000, `${elapsed}ms`);
  await row.locator('.pin-delete').click();
}

console.log('\n── 公開ビルドが外部に何を呼ぶか ──');
{
  // 一般公開するビルドはルート計算(OSRMデモサーバー)を持たない。提供元が公開利用を認めていないため。
  const osrm = hosts.filter((h) => h.includes('project-osrm'));
  check('OSRMデモサーバーに接続しない', osrm.length === 0, osrm.join(','));
  check(
    '地図タイルは地理院タイル',
    hosts.some((h) => h.includes('cyberjapandata.gsi.go.jp')),
    hosts.join(','),
  );
}

console.log('\n── 検索結果の保存(Nominatimの規約が求めるキャッシュ) ──');
{
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const countCalls = () =>
    page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((e) => e.name.includes('nominatim') || e.name.includes('msearch'))
          .length,
    );
  await page.fill('#addr-input', '六本木ヒルズ');
  await page.click('#add-btn');
  await page.waitForSelector('#add-btn:not(.is-loading)', { timeout: 20000 });
  if (!(await page.locator('#candidates').isHidden())) {
    await page.locator('#candidates .candidate button').first().click();
  }
  const first = await countCalls();
  check('1回目は外部に問い合わせる', first > 0, `${first}件`);

  await page.fill('#addr-input', '六本木ヒルズ');
  await page.click('#add-btn');
  await page.waitForSelector('#add-btn:not(.is-loading)', { timeout: 20000 });
  if (!(await page.locator('#candidates').isHidden())) {
    await page.locator('#candidates .candidate button').first().click();
  }
  const second = await countCalls();
  check('2回目は問い合わせない', second === first, `${second - first}件増えた`);
}

console.log('\n── MT-02 実OSRM: 手元用の1ファイル版で確認 ──');
{
  // ルート計算は手元で使う1ファイル版だけが持つ
  const local = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });
  const lp = await local.newPage();
  await lp.goto(`file://${process.cwd()}/dist/PinRoute.html`, { waitUntil: 'load' });
  await lp.evaluate(() => localStorage.clear());
  await lp.reload({ waitUntil: 'load' });
  await lp.waitForTimeout(2000);
  for (const q of ['東京駅', '横浜駅', '鎌倉駅']) {
    await lp.fill('#addr-input', q);
    await lp.click('#add-btn');
    await lp.waitForSelector('#add-btn:not(.is-loading)', { timeout: 25000 }).catch(() => {});
    if (!(await lp.locator('#candidates').isHidden())) {
      await lp.locator('#candidates .candidate button').first().click();
    }
    await lp.waitForTimeout(1200);
  }
  await lp.waitForSelector('#route-bar:not([hidden])', { timeout: 25000 }).catch(() => {});
  await lp.waitForTimeout(1500);
  const distance = Number(await lp.locator('#route-distance').textContent());
  const duration = Number(await lp.locator('#route-duration').textContent());
  check(`総距離 ${distance} km`, distance > 40 && distance < 110);
  check(`所要時間 ${duration} 分`, duration > 30 && duration < 240);
  check('ルート線が描かれている', (await lp.locator('path.route-line').count()) === 1);
  await local.close();
}

console.log('\n── MT-06 帰属表示 ──');
const footer = (await page.locator('#app-footer').textContent()) ?? '';
const attribution = (await page.locator('.leaflet-control-attribution').textContent()) ?? '';
for (const word of ['地理院タイル', '国土地理院', 'Nominatim', 'OpenStreetMap']) {
  check(`フッターに ${word}`, footer.includes(word));
}
check('地図上にも帰属表示', attribution.includes('地理院タイル'));

await page.screenshot({ path: `${SHOT_DIR}/desktop.png` });
const mobile = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ja-JP',
  storageState: await context.storageState(),
});
const mpage = await mobile.newPage();
await mpage.goto(BASE, { waitUntil: 'networkidle' });
await mpage.waitForTimeout(3000);
await mpage.screenshot({ path: `${SHOT_DIR}/mobile.png` });
const overflow = await mpage.evaluate(
  () => document.body.scrollWidth > document.documentElement.clientWidth,
);
check('モバイル375pxで横スクロールが出ない', !overflow);

console.log('\n── ブラウザが報告した問題 ──');
check('コンソールエラー・リクエスト失敗なし', problems.length === 0, problems.join(' / '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n合計 ${results.length} 項目 / 失敗 ${failed.length} 件`);
console.log(`スクリーンショット: ${SHOT_DIR}/desktop.png, ${SHOT_DIR}/mobile.png`);
process.exit(failed.length === 0 ? 0 : 1);
