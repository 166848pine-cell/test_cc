import { describe, it, expect } from 'vitest';
import { encodeShareUrl, decodeSharePayload } from '../../src/share';
import type { AppState } from '../../src/types';

const BASE = 'https://example.com/pinroute/';

function payloadOf(url: string): string {
  const m = /#s=(.+)$/.exec(url);
  if (m === null) throw new Error('no payload');
  return m[1];
}

describe('share.ts', () => {
  it('UT-H01: encode→decode ラウンドトリップ(日本語・絵文字)', () => {
    const state: AppState = {
      v: 1,
      pins: [
        {
          id: 'orig-1',
          name: '東京駅🗼',
          query: '東京駅',
          lat: 35.681236,
          lng: 139.767125,
        },
        {
          id: 'orig-2',
          name: 'カフェ☕(候補)',
          query: '梅田1丁目',
          lat: 34.7,
          lng: 135.49,
        },
      ],
    };
    const { url } = encodeShareUrl(state, BASE);
    const decoded = decodeSharePayload(payloadOf(url));
    expect(decoded).not.toBeNull();
    expect(decoded!.pins).toHaveLength(2);
    decoded!.pins.forEach((p, i) => {
      expect(p.name).toBe(state.pins[i].name);
      expect(p.query).toBe(state.pins[i].query);
      expect(p.lat).toBe(state.pins[i].lat);
      expect(p.lng).toBe(state.pins[i].lng);
      expect(p.id).not.toBe(state.pins[i].id); // idは再発行
      expect(p.id).toBeTruthy();
    });
  });

  it('UT-H01b: 所在地(context)も往復し、idはpayloadに含めない', () => {
    const state: AppState = {
      v: 1,
      pins: [
        {
          id: 'orig-1',
          name: '富士山',
          query: '富士山',
          lat: 35.3628,
          lng: 138.7308,
          context: '静岡県駿東郡小山町',
        },
      ],
    };
    const { url } = encodeShareUrl(state, BASE);
    expect(url).not.toContain('orig-1');
    const decoded = decodeSharePayload(payloadOf(url));
    expect(decoded!.pins[0].context).toBe('静岡県駿東郡小山町');
    expect(decoded!.pins[0].id).toBeTruthy();
  });

  it('UT-H02: decode 不正base64 → null(throwしない)', () => {
    expect(decodeSharePayload('!!!not-base64!!!')).toBeNull();
    expect(decodeSharePayload('')).toBeNull();
  });

  it('UT-H03: decode JSONだが型不一致 → null', () => {
    const enc = (obj: unknown): string => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    };
    expect(decodeSharePayload(enc({ pins: [] }))).toBeNull(); // vなし
    expect(decodeSharePayload(enc({ v: 2, pins: [] }))).toBeNull(); // v不一致
    expect(decodeSharePayload(enc({ v: 1, pins: 'x' }))).toBeNull();
    expect(decodeSharePayload(enc({ v: 1, pins: [{ name: 'a' }] }))).toBeNull();
    expect(decodeSharePayload(enc([1, 2, 3]))).toBeNull();
  });

  it('UT-H04: encode 20件フル(長い名称) → tooLong判定', () => {
    const longName = 'とても長い施設名称テスト'.repeat(5);
    const full: AppState = {
      v: 1,
      pins: Array.from({ length: 20 }, (_, i) => ({
        id: `id-${i}`,
        name: `${longName}${i}`,
        query: `検索クエリ${i} 大阪市北区梅田1丁目`,
        lat: 35.123456 + i,
        lng: 139.654321 + i,
      })),
    };
    const { url, tooLong } = encodeShareUrl(full, BASE);
    expect(tooLong).toBe(url.length > 2000);
    expect(tooLong).toBe(true); // このデータ量なら2000字を超えるはず

    const small: AppState = { v: 1, pins: [] };
    const r2 = encodeShareUrl(small, BASE);
    expect(r2.tooLong).toBe(false);
  });

  it('UT-H05: encode 0件 → 有効URL、decodeで空pins', () => {
    const { url, tooLong } = encodeShareUrl({ v: 1, pins: [] }, BASE);
    expect(url.startsWith(`${BASE}#s=`)).toBe(true);
    expect(tooLong).toBe(false);
    const decoded = decodeSharePayload(payloadOf(url));
    expect(decoded).not.toBeNull();
    expect(decoded!.pins).toEqual([]);
  });
  it('UT-H06: 旧形式(pinsをそのまま並べたpayload)も読める', () => {
    const enc = (obj: unknown): string => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    };
    const decoded = decodeSharePayload(
      enc({
        v: 1,
        pins: [
          { id: 'x', name: '東京駅', query: '東京駅', lat: 35.68, lng: 139.76 },
        ],
      }),
    );
    expect(decoded!.pins).toHaveLength(1);
    expect(decoded!.pins[0].name).toBe('東京駅');
  });

  it('UT-H07: 現実的な20件なら共有URLが2,000文字に収まる', () => {
    // 駅名・施設名の一般的な長さを想定した20件
    const state: AppState = {
      v: 1,
      pins: Array.from({ length: 20 }, (_, i) => ({
        id: `id-${i}`,
        name: `新宿三丁目${i}`,
        query: `新宿三丁目${i}`,
        lat: 35.689487 + i * 0.01,
        lng: 139.691706 + i * 0.01,
        context: '東京都新宿区',
      })),
    };
    const { url, tooLong } = encodeShareUrl(
      state,
      'https://example.github.io/pinroute/',
    );
    expect(url.length).toBeLessThan(2000);
    expect(tooLong).toBe(false);
    const decoded = decodeSharePayload(payloadOf(url));
    expect(decoded!.pins).toHaveLength(20);
    expect(decoded!.pins[3].context).toBe('東京都新宿区');
    // 検索語が名称と同じ場合は畳んで保存し、復元時に埋め戻す
    expect(decoded!.pins[3].query).toBe('新宿三丁目3');
    expect(decoded!.pins[3].lat).toBeCloseTo(35.719487, 6);
  });
  it('UT-H08: 列の値・ブロック位置・項目設定も共有URLで往復する', () => {
    const state: AppState = {
      v: 1,
      pins: [
        {
          id: 'a',
          name: 'グランドメゾン新宿',
          query: '東京都新宿区西新宿2-8-1',
          lat: 35.68963,
          lng: 139.69177,
          context: '東京都新宿区',
          fields: { 住所: '東京都新宿区西新宿2-8-1', 賃料: '24.8万円' },
          labelOffset: { x: -120, y: 40 },
          labelHidden: true,
        },
      ],
      fieldOrder: ['賃料', '住所'],
      hiddenFields: ['住所'],
      labelsVisible: false,
    };
    const { url } = encodeShareUrl(state, BASE);
    const decoded = decodeSharePayload(payloadOf(url));
    expect(decoded).not.toBeNull();
    const p = decoded!.pins[0];
    expect(p.fields).toEqual({
      住所: '東京都新宿区西新宿2-8-1',
      賃料: '24.8万円',
    });
    expect(p.labelOffset).toEqual({ x: -120, y: 40 });
    expect(p.labelHidden).toBe(true);
    expect(decoded!.fieldOrder).toEqual(['賃料', '住所']);
    expect(decoded!.hiddenFields).toEqual(['住所']);
    expect(decoded!.labelsVisible).toBe(false);
  });

  it('UT-H09: ルート非表示の設定も共有URLで往復する', () => {
    const state: AppState = {
      v: 1,
      pins: [{ id: 'a', name: 'A', query: 'a', lat: 35, lng: 139 }],
      routeVisible: false,
    };
    const { url } = encodeShareUrl(state, BASE);
    expect(decodeSharePayload(payloadOf(url))!.routeVisible).toBe(false);

    const shown = encodeShareUrl({ v: 1, pins: state.pins }, BASE);
    expect(
      decodeSharePayload(payloadOf(shown.url))!.routeVisible,
    ).toBeUndefined();
  });
});
