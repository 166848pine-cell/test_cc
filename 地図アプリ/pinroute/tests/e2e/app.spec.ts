import { test, expect } from '@playwright/test';
import {
  stubApis,
  addPinBySearch,
  TOKYO,
  YOKOHAMA,
  KAMAKURA,
  TOKYO_NOISE,
  PROPERTY_ROWS,
  propertyTsv,
  propertyGsiStub,
} from './helpers';

test.describe('PinRoute E2E', () => {
  test('E2E-01: 検索→単一候補→ピン1件表示 @mobile', async ({ page }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('.pin-marker')).toHaveCount(1);
    await expect(page.locator('#route-bar')).toBeHidden();
  });

  test('E2E-02: 複数候補→2番目を選択', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: {
        駅: [TOKYO, YOKOHAMA, KAMAKURA],
      },
    });
    await page.goto('/');
    await addPinBySearch(page, '駅');
    await expect(page.locator('#candidates .candidate')).toHaveCount(3);
    await page.locator('#candidates .candidate button').nth(1).click();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#pin-list .pin-name')).toHaveValue('横浜駅');
  });

  test('E2E-03: 2件登録でルート表示 @mobile', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#route-distance')).toHaveText('65.0');
    await expect(page.locator('#route-duration')).toHaveText('70');
    await expect(page.locator('#gmap-link')).toBeVisible();
    const href = await page.locator('#gmap-link').getAttribute('href');
    expect(href).toContain('https://www.google.com/maps/dir/');
    expect(href).toContain('35.681236,139.767125');
    await expect(page.locator('path.route-line')).toHaveCount(1);
  });

  test('E2E-04: 名称編集 → 一覧とポップアップに反映', async ({ page }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    const nameInput = page.locator('#pin-list .pin-name');
    await nameInput.fill('待ち合わせ場所');
    await nameInput.press('Enter');
    await expect(nameInput).toHaveValue('待ち合わせ場所');
    await page.locator('.pin-marker').click();
    await expect(page.locator('.leaflet-popup-content')).toContainText(
      '待ち合わせ場所',
    );
  });

  test('E2E-05: ▲で並び替え → 番号振り直し・OSRM座標順が入れ替わる', async ({
    page,
  }) => {
    const osrmUrls: string[] = [];
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
      osrmUrls,
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });

    const firstUrl = osrmUrls[osrmUrls.length - 1];
    expect(firstUrl).toContain(
      `${TOKYO.lon},${TOKYO.lat};${YOKOHAMA.lon},${YOKOHAMA.lat}`,
    );

    const beforeCount = osrmUrls.length;
    await page.locator('#pin-list .pin-row').nth(1).locator('.move-up').click();
    await expect(
      page.locator('#pin-list .pin-row').nth(0).locator('.pin-name'),
    ).toHaveValue('横浜駅');
    // 並び替え後のルート再計算(デバウンス500ms)を待つ
    await expect
      .poll(() => osrmUrls.length, { timeout: 10000 })
      .toBeGreaterThan(beforeCount);
    const lastUrl = osrmUrls[osrmUrls.length - 1];
    expect(lastUrl).toContain(
      `${YOKOHAMA.lon},${YOKOHAMA.lat};${TOKYO.lon},${TOKYO.lat}`,
    );
  });

  test('E2E-06: 個別削除→1件になるとルート線・バーが消える', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await page
      .locator('#pin-list .pin-row')
      .nth(1)
      .locator('.pin-delete')
      .click();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#route-bar')).toBeHidden();
    await expect(page.locator('path.route-line')).toHaveCount(0);
  });

  test('E2E-07: 全削除(confirm=OK) → 一覧空・localStorageも空状態', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    page.on('dialog', (d) => d.accept());
    await page.click('#clear-btn');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(0);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem('pinroute:state');
          if (raw === null) return 0;
          return (JSON.parse(raw) as { pins: unknown[] }).pins.length;
        }),
      )
      .toBe(0);
  });

  test('E2E-08: リロード復元(3件+ルート)', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA], 鎌倉駅: [KAMAKURA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await addPinBySearch(page, '鎌倉駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(3);
    // 保存デバウンス(300ms)を待つ
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(3);
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('path.route-line')).toHaveCount(1);
  });

  test('E2E-09: 共有URL復元(新規コンテキスト・フラグメント除去)', async ({
    page,
    browser,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await page.click('#share-btn');
    await expect(page.locator('#toast')).toBeVisible();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('#s=');

    const ctx = await browser.newContext();
    const page2 = await ctx.newPage();
    await stubApis(page2, {});
    await page2.goto(url);
    await expect(page2.locator('#pin-list .pin-row')).toHaveCount(2);
    await expect(page2.locator('#pin-list .pin-name').first()).toHaveValue(
      '東京駅',
    );
    expect(new URL(page2.url()).hash).toBe('');
    await ctx.close();
  });

  test('E2E-10: ルートAPI障害 → E3メッセージ・ピン操作は継続可能', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
      osrmStatus: 500,
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#msg-area')).toContainText(
      'ルートを計算できませんでした',
      {
        timeout: 10000,
      },
    );
    await expect(page.locator('#route-bar')).toBeHidden();
    // ピン操作は継続できる
    await page
      .locator('#pin-list .pin-row')
      .nth(0)
      .locator('.pin-delete')
      .click();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
  });

  test('E2E-11: 検索0件 → E1メッセージ', async ({ page }) => {
    await stubApis(page, {}); // 全クエリ0件(Nominatimも空)
    await page.goto('/');
    await addPinBySearch(page, '存在しない場所xyz');
    await expect(page.locator('#msg-area')).toContainText(
      '見つかりませんでした',
      {
        timeout: 15000,
      },
    );
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(0);
  });

  test('E2E-12: ピン20件で追加試行 → E4メッセージ・21件目なし', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    // localStorage経由で20件を準備(検索20回はテスト時間がかかるため)
    await page.evaluate(() => {
      const pins = Array.from({ length: 20 }, (_, i) => ({
        id: `id-${i}`,
        name: `ピン${i + 1}`,
        query: `q${i + 1}`,
        lat: 35 + i * 0.01,
        lng: 139 + i * 0.01,
      }));
      localStorage.setItem('pinroute:state', JSON.stringify({ v: 1, pins }));
    });
    await page.reload();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(20);
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#msg-area')).toContainText(
      'ピンは最大20件までです',
    );
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(20);
  });

  test('E2E-13: モバイル(375x667)で追加・ルート表示が完了できる @mobileonly', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    // 縦積みレイアウト(地図がパネルの上)
    const mapBox = await page.locator('#map').boundingBox();
    const panelBox = await page.locator('#panel').boundingBox();
    expect(mapBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(mapBox!.y).toBeLessThan(panelBox!.y);

    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#route-distance')).toHaveText('65.0');
  });

  test('E2E-14: XSS 名称に<img onerror> → スクリプト非実行・文字列表示', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    let dialogFired = false;
    page.on('dialog', (d) => {
      dialogFired = true;
      void d.dismiss();
    });
    await addPinBySearch(page, '東京駅');
    const payload = '<img src=x onerror=alert(1)>';
    const nameInput = page.locator('#pin-list .pin-name');
    await nameInput.fill(payload);
    await nameInput.press('Enter');
    await expect(nameInput).toHaveValue(payload);
    // ポップアップ(escapeHtml経由)でも実行されないこと
    await page.locator('.pin-marker').click();
    await expect(page.locator('.leaflet-popup-content')).toContainText(payload);
    await page.waitForTimeout(500);
    expect(dialogFired).toBe(false);
    // 画像要素として注入されていないこと
    expect(await page.locator('.leaflet-popup-content img').count()).toBe(0);
    expect(await page.locator('#pin-list img').count()).toBe(0);
  });
  /**
   * 国土地理院APIは関連度順に並ばず、「東京駅」でも先頭は「北海道札幌市東区」等になる。
   * 素朴に先頭から採ると無関係な地点がピンになるため、並べ替えが効いていることを確かめる。
   */
  test('E2E-15: 検索結果の並びが関連度順になる(本命が末尾にあっても確定できる)', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: TOKYO_NOISE } });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#pin-list .pin-name')).toHaveValue('東京駅');
    await expect(page.locator('#pin-list .pin-sub')).toHaveText(
      '東京都千代田区',
    );
  });

  test('E2E-16: ピン間に区間の距離・所要時間が表示される', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#pin-list .leg-row')).toHaveCount(1);
    await expect(page.locator('#pin-list .leg-row')).toContainText('65.0 km');
  });

  test('E2E-17: 候補は↑↓とEnterでも選べる', async ({ page }) => {
    await stubApis(page, { gsiByQuery: { 駅: [TOKYO, YOKOHAMA, KAMAKURA] } });
    await page.goto('/');
    await addPinBySearch(page, '駅');
    await expect(page.locator('#candidates .candidate')).toHaveCount(3);
    await page.locator('#addr-input').press('ArrowDown');
    await page.locator('#addr-input').press('ArrowDown');
    await page.locator('#addr-input').press('Enter');
    await expect(page.locator('#pin-list .pin-name')).toHaveValue('横浜駅');
  });

  test('E2E-18: 一覧の番号を押すと地図でその地点を表示する', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await page.locator('#pin-list .pin-row').nth(1).locator('.pin-num').click();
    await expect(page.locator('.leaflet-popup-content')).toContainText(
      '横浜駅',
    );
  });

  test('E2E-19: ピンが0件のときはルート概要も空状態案内も正しく出し分ける', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#route-bar')).toBeHidden();
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#empty-state')).toBeHidden();
    await expect(page.locator('#pin-count')).toHaveText('1 / 20 件');
  });
  test('E2E-20: ドラッグ&ドロップで並び替えできる', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA], 鎌倉駅: [KAMAKURA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await addPinBySearch(page, '鎌倉駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(3);

    // 3番目(鎌倉駅)を先頭へ移す。
    // ブラウザのドラッグ開始判定は実行環境の負荷で取りこぼすことがあるため、
    // ここではHTML5のドラッグイベントを直接発火して並び替え処理そのものを確かめる。
    await page.evaluate(() => {
      const rows = document.querySelectorAll<HTMLElement>('#pin-list .pin-row');
      const source = rows[2];
      const target = rows[0];
      const dataTransfer = new DataTransfer();
      const fire = (el: HTMLElement, type: string): void => {
        el.dispatchEvent(
          new DragEvent(type, {
            dataTransfer,
            bubbles: true,
            cancelable: true,
          }),
        );
      };
      fire(source, 'dragstart');
      fire(target, 'dragover');
      fire(target, 'drop');
      fire(source, 'dragend');
    });
    await expect(
      page.locator('#pin-list .pin-row').nth(0).locator('.pin-name'),
    ).toHaveValue('鎌倉駅');
    await expect(
      page.locator('#pin-list .pin-row').nth(0).locator('.pin-num'),
    ).toHaveText('1');
  });
  test('E2E-21: 一覧の行にポインタを乗せると地図のマーカーが強調される', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);

    await expect(page.locator('.pin-marker-wrap.is-highlighted')).toHaveCount(
      0,
    );
    await page.locator('#pin-list .pin-row').nth(1).hover();
    await expect(page.locator('.pin-marker-wrap.is-highlighted')).toHaveCount(
      1,
    );
    await page.locator('#app-header').hover();
    await expect(page.locator('.pin-marker-wrap.is-highlighted')).toHaveCount(
      0,
    );
  });
  /** 受け入れ基準6 / MT-07 相当: 通信できない状態でもクラッシュせず案内が出る。 */
  test('E2E-22: ネットワーク遮断中でもクラッシュせずE2メッセージを出し、操作を継続できる', async ({
    page,
  }) => {
    await stubApis(page, { gsiByQuery: { 東京駅: [TOKYO] } });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);

    const crashes: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));

    // 以降すべての外部通信を失敗させる
    await page.route('https://msearch.gsi.go.jp/**', (route) =>
      route.abort('failed'),
    );
    await page.route('https://nominatim.openstreetmap.org/**', (route) =>
      route.abort('failed'),
    );
    await page.route('https://router.project-osrm.org/**', (route) =>
      route.abort('failed'),
    );

    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#msg-area')).toContainText(
      '検索サーバーに接続できません',
      {
        timeout: 20000,
      },
    );

    // ピンは残り、削除・並び替えなどの操作は続けられる
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await page.locator('#pin-list .pin-name').fill('通信断でも編集できる');
    await page.locator('#pin-list .pin-name').press('Enter');
    await expect(page.locator('#pin-list .pin-name')).toHaveValue(
      '通信断でも編集できる',
    );
    await page.locator('#pin-list .pin-delete').click();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(0);
    await expect(page.locator('#empty-state')).toBeVisible();
    expect(crashes).toEqual([]);
  });
  /** まとめて入力〜情報ブロックまでを通しで確かめる。 */
  async function importProperties(
    page: import('@playwright/test').Page,
  ): Promise<void> {
    await stubApis(page, { gsiByQuery: propertyGsiStub() });
    await page.goto('/');
    await page.locator('#bulk-panel summary').click();
    await page.locator('#bulk-input').fill(propertyTsv());
    await expect(page.locator('#bulk-preview table')).toBeVisible();
    // 住所・名称の列が見出しから自動で選ばれている
    await expect(page.locator('#bulk-address')).toHaveValue('1');
    await expect(page.locator('#bulk-name')).toHaveValue('0');
    await page.locator('#bulk-run').click();
    await expect(page.locator('#bulk-progress')).toContainText('追加しました', {
      timeout: 30000,
    });
  }

  test('E2E-23: まとめて入力で複数の物件を取り込み、情報ブロックと引き出し線が出る', async ({
    page,
  }) => {
    await importProperties(page);

    await expect(page.locator('#pin-list .pin-row')).toHaveCount(
      PROPERTY_ROWS.length,
    );
    await expect(page.locator('.callout')).toHaveCount(PROPERTY_ROWS.length);
    await expect(page.locator('path.callout-line')).toHaveCount(
      PROPERTY_ROWS.length,
    );

    const first = page.locator('.callout').first();
    await expect(first.locator('.callout-title')).toHaveText(
      PROPERTY_ROWS[0].name,
    );
    await expect(first).toContainText(PROPERTY_ROWS[0].walk);
    await expect(first).toContainText(PROPERTY_ROWS[0].rent);
    // 名称は見出しに出るので中では繰り返さない
    await expect(first.locator('.callout-body')).not.toContainText('物件名');

    // 引き出し線が実際に引かれている
    const d = await page.locator('path.callout-line').first().getAttribute('d');
    expect(d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  test('E2E-24: 情報ブロックをドラッグすると位置が保存される', async ({
    page,
  }) => {
    await importProperties(page);
    const head = page.locator('.callout').first().locator('.callout-head');
    const box = await head.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 - 150,
      box!.y + box!.height / 2 + 120,
      {
        steps: 12,
      },
    );
    await page.mouse.up();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem('pinroute:state');
          if (raw === null) return null;
          return (JSON.parse(raw) as { pins: { labelOffset?: unknown }[] })
            .pins[0].labelOffset;
        }),
      )
      .not.toBeNull();
  });

  test('E2E-25: 情報ブロックの項目は並べ替え・非表示にできる', async ({
    page,
  }) => {
    await importProperties(page);
    await page.locator('#label-panel summary').click();
    await expect(page.locator('#field-order .field-row')).toHaveCount(3);

    // 「賃料」を先頭へ
    const rentRow = page.locator('#field-order .field-row', {
      hasText: '賃料',
    });
    await rentRow.locator('.field-up').click();
    await rentRow.locator('.field-up').click();
    await expect(page.locator('#field-order .field-row').first()).toContainText(
      '賃料',
    );
    const labels = await page
      .locator('.callout')
      .first()
      .locator('dt')
      .allTextContents();
    expect(labels[0]).toBe('賃料');

    // 「住所」を非表示に
    await page
      .locator('#field-order .field-row', { hasText: '住所' })
      .locator('input[type=checkbox]')
      .uncheck();
    await expect(
      page.locator('.callout').first().locator('.callout-body'),
    ).not.toContainText('住所');
  });

  test('E2E-26: ブロックは個別に隠せ、まとめて表示を切り替えられ、配置を戻せる', async ({
    page,
  }) => {
    await importProperties(page);
    const total = PROPERTY_ROWS.length;

    await page.locator('.callout').first().locator('.callout-close').click();
    await expect(page.locator('.callout')).toHaveCount(total - 1);

    await page.locator('#label-panel summary').click();
    await page.locator('#labels-reset').click();
    await expect(page.locator('.callout')).toHaveCount(total);

    await page.locator('#labels-visible').uncheck();
    await expect(page.locator('.callout')).toHaveCount(0);
    await page.locator('#labels-visible').check();
    await expect(page.locator('.callout')).toHaveCount(total);
  });

  test('E2E-27: 共有URLで情報ブロックごと再現できる', async ({
    page,
    browser,
  }) => {
    await importProperties(page);
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#label-panel summary').click();
    await page
      .locator('#field-order .field-row', { hasText: '住所' })
      .locator('input[type=checkbox]')
      .uncheck();
    await page.waitForTimeout(500);
    await page.click('#share-btn');
    const url = await page.evaluate(() => navigator.clipboard.readText());

    const ctx = await browser.newContext();
    const page2 = await ctx.newPage();
    await stubApis(page2, {});
    await page2.goto(url);
    await expect(page2.locator('.callout')).toHaveCount(PROPERTY_ROWS.length);
    await expect(page2.locator('.callout').first()).toContainText(
      PROPERTY_ROWS[0].rent,
    );
    await expect(
      page2.locator('.callout').first().locator('.callout-body'),
    ).not.toContainText('住所');
    await ctx.close();
  });

  test('E2E-28: 郵便番号や建物名が付いた住所でもピンが立つ', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: {
        '東京都新宿区西新宿2-8-1': [
          {
            title: '東京都新宿区西新宿二丁目8番',
            lon: 139.69177,
            lat: 35.68963,
            addressCode: '13104',
          },
        ],
      },
    });
    await page.goto('/');
    // 〒付き・建物名付きでも、切り詰めて再検索して見つける
    await addPinBySearch(
      page,
      '〒160-0023 東京都新宿区西新宿2-8-1 都庁第一本庁舎',
    );
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#pin-list .pin-sub')).toHaveText('東京都新宿区');
  });
  test('E2E-29: 情報ブロックは自動配置で重ならない', async ({ page }) => {
    await importProperties(page);
    await page.waitForTimeout(800);
    const rects = await page.$$eval('.callout', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    expect(rects.length).toBeGreaterThan(1);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const hit =
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h;
        expect(hit, `ブロック${i + 1}と${j + 1}が重なっている`).toBe(false);
      }
    }
  });
  test('E2E-30: ルート表示のチェックを外すと線も計算も止まる', async ({
    page,
  }) => {
    const osrmUrls: string[] = [];
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA], 鎌倉駅: [KAMAKURA] },
      osrmUrls,
    });
    await page.goto('/');

    // 1件だけのうちは切り替え欄も出さない
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await expect(page.locator('#route-control')).toBeHidden();

    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-control')).toBeVisible();
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('path.route-line')).toHaveCount(1);
    await expect(page.locator('#pin-list .leg-row')).toHaveCount(1);

    // 外すと線・概要・区間表示が消える
    await page.locator('#route-visible').uncheck();
    await expect(page.locator('path.route-line')).toHaveCount(0);
    await expect(page.locator('#route-bar')).toBeHidden();
    await expect(page.locator('#pin-list .leg-row')).toHaveCount(0);
    // Googleマップのリンクはルート線とは別なので残る
    await expect(page.locator('#gmap-link')).toBeVisible();

    // 外している間はピンを足してもルートを問い合わせない
    const before = osrmUrls.length;
    await addPinBySearch(page, '鎌倉駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(3);
    await page.waitForTimeout(1500);
    expect(osrmUrls.length).toBe(before);

    // 戻すと計算し直す
    await page.locator('#route-visible').check();
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('path.route-line')).toHaveCount(1);
    expect(osrmUrls.length).toBeGreaterThan(before);
  });

  test('E2E-31: ルート非表示の設定は再読み込みしても残る', async ({ page }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
    });
    await page.goto('/');
    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#route-bar')).toBeVisible({ timeout: 10000 });
    await page.locator('#route-visible').uncheck();
    await page.waitForTimeout(600);

    await page.reload();
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await expect(page.locator('#route-visible')).not.toBeChecked();
    await expect(page.locator('#route-bar')).toBeHidden();
    await expect(page.locator('path.route-line')).toHaveCount(0);
  });
  test('E2E-32: ブロックを1つ動かしても他のブロックは動かない', async ({
    page,
  }) => {
    await importProperties(page);
    await page.waitForTimeout(600);

    const positions = async (): Promise<
      { id: string; x: number; y: number }[]
    > =>
      page.$$eval('.callout', (els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return {
            id: (e as HTMLElement).dataset.id ?? '',
            x: Math.round(r.x),
            y: Math.round(r.y),
          };
        }),
      );

    const before = await positions();
    expect(before.length).toBeGreaterThan(2);

    const head = page.locator('.callout').first().locator('.callout-head');
    const box = await head.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 180,
      box!.y + box!.height / 2 + 140,
      {
        steps: 12,
      },
    );
    await page.mouse.up();
    await page.waitForTimeout(800);

    const after = await positions();
    const movedId = before[0].id;
    for (const now of after) {
      if (now.id === movedId) continue;
      const was = before.find((b) => b.id === now.id);
      expect(was, '同じブロックが見つかる').not.toBeUndefined();
      expect(now.x, `${now.id} が横に動いていない`).toBe(was!.x);
      expect(now.y, `${now.id} が縦に動いていない`).toBe(was!.y);
    }
  });

  test('E2E-33: 色と大きさを全体と個別で変えられる', async ({ page }) => {
    await importProperties(page);
    await page.locator('#appearance-panel summary').click();

    const look = async (): Promise<{ color: string; width: string }> =>
      page.evaluate(() => {
        const c = document.querySelector('.callout') as HTMLElement;
        const head = c.querySelector('.callout-head') as HTMLElement;
        return {
          color: getComputedStyle(head).backgroundColor,
          width: getComputedStyle(c).width,
        };
      });

    const initial = await look();

    // 全体をブルー・大に
    await page.locator('#global-colors .swatch').nth(1).click();
    await page.locator('#global-sizes button').nth(2).click();
    await page.waitForTimeout(500);
    const global = await look();
    expect(global.color).not.toBe(initial.color);
    expect(parseFloat(global.width)).toBeGreaterThan(parseFloat(initial.width));
    // マーカーと引き出し線にも同じ色が乗る
    await expect(page.locator('path.callout-line').first()).toHaveAttribute(
      'stroke',
      '#2f6fd0',
    );

    // 1件だけグリーン・小に
    await page
      .locator('#pin-list .pin-row')
      .first()
      .locator('.pin-style-btn')
      .click();
    await page.locator('.pin-style-panel .swatch').nth(2).click();
    await page.waitForTimeout(400);
    await page.locator('.pin-style-panel .size-buttons button').first().click();
    await page.waitForTimeout(500);

    const each = await page.$$eval('.callout', (els) =>
      els.slice(0, 2).map((e) => ({
        color: getComputedStyle(e.querySelector('.callout-head') as HTMLElement)
          .backgroundColor,
        width: getComputedStyle(e).width,
      })),
    );
    expect(each[0].color).not.toBe(each[1].color);
    expect(parseFloat(each[0].width)).toBeLessThan(parseFloat(each[1].width));
    // 2件目は全体設定のまま
    expect(each[1].color).toBe(global.color);

    // 個別の設定を解除すると全体に戻る
    await page.locator('#style-reset-all').click();
    await page.waitForTimeout(500);
    const reset = await page.$$eval('.callout', (els) =>
      els
        .slice(0, 2)
        .map(
          (e) =>
            getComputedStyle(e.querySelector('.callout-head') as HTMLElement)
              .backgroundColor,
        ),
    );
    expect(reset[0]).toBe(reset[1]);
  });

  test('E2E-34: 情報ブロックの項目をまとめて表示・非表示にできる', async ({
    page,
  }) => {
    await importProperties(page);
    await page.locator('#label-panel summary').click();
    const total = await page.locator('#field-order .field-row').count();
    expect(total).toBeGreaterThan(1);

    await page.locator('#fields-none').click();
    await expect(page.locator('#field-order input:checked')).toHaveCount(0);
    await expect(page.locator('.callout').first().locator('dt')).toHaveCount(0);

    await page.locator('#fields-all').click();
    await expect(page.locator('#field-order input:checked')).toHaveCount(total);
    await expect(page.locator('.callout').first().locator('dt')).toHaveCount(
      total,
    );
  });
  test('E2E-35: Googleマップのリンクはルート表示に関わらず使える', async ({
    page,
  }) => {
    await stubApis(page, {
      gsiByQuery: { 東京駅: [TOKYO], 横浜駅: [YOKOHAMA] },
      osrmStatus: 500, // ルート計算が失敗してもリンクは出る
    });
    await page.goto('/');

    await addPinBySearch(page, '東京駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(1);
    // 1件のうちは出さない
    await expect(page.locator('#gmap-link')).toBeHidden();

    await addPinBySearch(page, '横浜駅');
    await expect(page.locator('#pin-list .pin-row')).toHaveCount(2);
    await expect(page.locator('#msg-area')).toContainText(
      'ルートを計算できませんでした',
      {
        timeout: 10000,
      },
    );
    // ルートが出せなくてもGoogleマップへは行ける
    await expect(page.locator('#gmap-link')).toBeVisible();
    const href = await page.locator('#gmap-link').getAttribute('href');
    expect(href).toContain(`${TOKYO.lat},${TOKYO.lon}`);
    expect(href).toContain(`${YOKOHAMA.lat},${YOKOHAMA.lon}`);

    // 並び替えるとリンクの順番も変わる
    await page.locator('#pin-list .pin-row').nth(1).locator('.move-up').click();
    await expect
      .poll(async () => page.locator('#gmap-link').getAttribute('href'))
      .toContain(`dir/${YOKOHAMA.lat},${YOKOHAMA.lon}`);
  });
});
