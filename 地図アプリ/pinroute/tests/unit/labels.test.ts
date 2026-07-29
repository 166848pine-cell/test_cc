import { describe, it, expect } from 'vitest';
import {
  collectFieldNames,
  resolveFieldOrder,
  visibleFieldOrder,
  normalizeState,
  type AppState,
  type Pin,
} from '../../src/types';
import {
  setLabelOffset,
  setLabelHidden,
  resetLabels,
  moveField,
  toggleField,
  addPinsWithFields,
  MAX_PINS,
} from '../../src/state';

function pin(name: string, fields?: Record<string, string>): Pin {
  return {
    id: `id-${name}`,
    name,
    query: name,
    lat: 35,
    lng: 139,
    ...(fields === undefined ? {} : { fields }),
  };
}

const base: AppState = {
  v: 1,
  pins: [
    pin('A', { 住所: '東京都港区北青山3-6-1', 賃料: '19.5万円' }),
    pin('B', { 住所: '東京都新宿区西新宿2-8-1', 駅徒歩: '徒歩8分' }),
  ],
};

describe('情報ブロックの項目', () => {
  it('UT-L01: 全ピンの列名を出現順に集める', () => {
    expect(collectFieldNames(base.pins)).toEqual(['住所', '賃料', '駅徒歩']);
  });

  it('UT-L02: 保存した並び順を保ち、新しい列は後ろに足す', () => {
    expect(resolveFieldOrder(base.pins, ['賃料', '住所'])).toEqual([
      '賃料',
      '住所',
      '駅徒歩',
    ]);
  });

  it('UT-L03: 無くなった列は並び順から落とす', () => {
    expect(resolveFieldOrder(base.pins, ['面積', '賃料'])).toEqual([
      '賃料',
      '住所',
      '駅徒歩',
    ]);
  });

  it('UT-L04: 非表示の項目を除いたものが実際の表示内容', () => {
    expect(visibleFieldOrder(['住所', '賃料', '駅徒歩'], ['賃料'])).toEqual([
      '住所',
      '駅徒歩',
    ]);
    expect(visibleFieldOrder(['住所'], undefined)).toEqual(['住所']);
  });

  it('UT-L05: moveField で並び順を入れ替える', () => {
    const order = ['住所', '賃料', '駅徒歩'];
    expect(moveField(base, order, '駅徒歩', -1).fieldOrder).toEqual([
      '住所',
      '駅徒歩',
      '賃料',
    ]);
    // 端では変化なし
    expect(moveField(base, order, '住所', -1)).toBe(base);
  });

  it('UT-L06: toggleField で表示・非表示を切り替える', () => {
    const order = ['住所', '賃料'];
    const hidden = toggleField(base, order, '賃料');
    expect(hidden.hiddenFields).toEqual(['賃料']);
    const shown = toggleField(hidden, order, '賃料');
    expect(shown.hiddenFields).toEqual([]);
  });
});

describe('情報ブロックの配置', () => {
  it('UT-L07: setLabelOffset で位置を記録する', () => {
    const next = setLabelOffset(base, 'id-A', { x: -120, y: 40 });
    expect(next.pins[0].labelOffset).toEqual({ x: -120, y: 40 });
    expect(next.pins[1].labelOffset).toBeUndefined();
    expect(base.pins[0].labelOffset).toBeUndefined(); // 元は変えない
  });

  it('UT-L08: setLabelHidden で個別に隠す・戻す', () => {
    const hidden = setLabelHidden(base, 'id-B', true);
    expect(hidden.pins[1].labelHidden).toBe(true);
    const shown = setLabelHidden(hidden, 'id-B', false);
    expect(shown.pins[1].labelHidden).toBeUndefined();
  });

  it('UT-L09: resetLabels で位置と表示をすべて初期化する', () => {
    const moved = setLabelHidden(
      setLabelOffset(base, 'id-A', { x: 1, y: 2 }),
      'id-B',
      true,
    );
    const reset = resetLabels(moved);
    expect(reset.pins[0].labelOffset).toBeUndefined();
    expect(reset.pins[1].labelHidden).toBeUndefined();
  });
});

describe('まとめて追加', () => {
  it('UT-L10: 列の値つきでまとめて追加する', () => {
    const next = addPinsWithFields({ v: 1, pins: [] }, [
      { name: 'X', query: 'x', lat: 35, lng: 139, fields: { 賃料: '10万円' } },
      { name: 'Y', query: 'y', lat: 36, lng: 140 },
    ]);
    expect(next.pins).toHaveLength(2);
    expect(next.pins[0].fields).toEqual({ 賃料: '10万円' });
    expect(next.pins[0].id).not.toBe(next.pins[1].id);
  });

  it('UT-L11: 上限を超える分は追加しない', () => {
    const full: AppState = {
      v: 1,
      pins: Array.from({ length: MAX_PINS - 1 }, (_, i) => pin(`p${i}`)),
    };
    const next = addPinsWithFields(full, [
      { name: 'X', query: 'x', lat: 35, lng: 139 },
      { name: 'Y', query: 'y', lat: 36, lng: 140 },
    ]);
    expect(next.pins).toHaveLength(MAX_PINS);
    expect(next.pins[MAX_PINS - 1].name).toBe('X');
  });
});

describe('保存データの検証', () => {
  it('UT-L12: 列の値・ブロック位置・並び順を読み戻す', () => {
    const restored = normalizeState(
      {
        v: 1,
        pins: [
          {
            id: 'a',
            name: 'A',
            query: 'a',
            lat: 35,
            lng: 139,
            fields: { 賃料: '19.5万円', 空: '' },
            labelOffset: { x: -10, y: 20 },
            labelHidden: true,
          },
        ],
        fieldOrder: ['賃料', 123],
        hiddenFields: ['住所'],
        labelsVisible: false,
      },
      false,
    );
    expect(restored).not.toBeNull();
    expect(restored!.pins[0].fields).toEqual({ 賃料: '19.5万円' }); // 空の値は落とす
    expect(restored!.pins[0].labelOffset).toEqual({ x: -10, y: 20 });
    expect(restored!.pins[0].labelHidden).toBe(true);
    expect(restored!.fieldOrder).toEqual(['賃料']); // 文字列以外は落とす
    expect(restored!.hiddenFields).toEqual(['住所']);
    expect(restored!.labelsVisible).toBe(false);
  });

  it('UT-L14: ルート表示の設定を読み戻す(既定は表示)', () => {
    const base = { v: 1, pins: [] };
    expect(normalizeState(base, false)!.routeVisible).toBeUndefined();
    expect(
      normalizeState({ ...base, routeVisible: false }, false)!.routeVisible,
    ).toBe(false);
    expect(
      normalizeState({ ...base, routeVisible: true }, false)!.routeVisible,
    ).toBeUndefined();
  });

  it('UT-L13: 壊れた位置・列の値は無かったことにする(落ちない)', () => {
    const restored = normalizeState(
      {
        v: 1,
        pins: [
          {
            name: 'A',
            query: 'a',
            lat: 35,
            lng: 139,
            fields: 'not-an-object',
            labelOffset: { x: 'x', y: 1 },
          },
        ],
      },
      true,
    );
    expect(restored!.pins[0].fields).toBeUndefined();
    expect(restored!.pins[0].labelOffset).toBeUndefined();
  });
});
