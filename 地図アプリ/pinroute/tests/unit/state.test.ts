import { describe, it, expect } from 'vitest';
import {
  addPin,
  removePin,
  renamePin,
  movePin,
  reorderPin,
  clearPins,
  MAX_PINS,
} from '../../src/state';
import type { AppState, Pin } from '../../src/types';

function makePin(n: number): Pin {
  return {
    id: `id-${n}`,
    name: `pin${n}`,
    query: `q${n}`,
    lat: 35 + n,
    lng: 139 + n,
  };
}

function makeState(count: number): AppState {
  return { v: 1, pins: Array.from({ length: count }, (_, i) => makePin(i)) };
}

function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  for (const v of Object.values(obj as object)) {
    if (typeof v === 'object' && v !== null && !Object.isFrozen(v))
      deepFreeze(v);
  }
  return obj;
}

describe('state.ts', () => {
  it('UT-S01: addPin 空状態に1件追加 → length=1, id付与', () => {
    const s = addPin(makeState(0), {
      name: 'A',
      query: 'a',
      lat: 35,
      lng: 139,
    });
    expect(s.pins).toHaveLength(1);
    expect(s.pins[0].id).toBeTruthy();
    expect(typeof s.pins[0].id).toBe('string');
  });

  it('UT-S02: addPin 20件の状態に追加 → 変化なし', () => {
    const full = makeState(MAX_PINS);
    const s = addPin(full, { name: 'X', query: 'x', lat: 35, lng: 139 });
    expect(s.pins).toHaveLength(MAX_PINS);
    expect(s).toBe(full);
  });

  it('UT-S03: removePin 存在するid → 該当のみ削除・順序維持', () => {
    const s = removePin(makeState(3), 'id-1');
    expect(s.pins.map((p) => p.id)).toEqual(['id-0', 'id-2']);
  });

  it('UT-S04: removePin 存在しないid → 変化なし', () => {
    const before = makeState(3);
    const s = removePin(before, 'nope');
    expect(s.pins).toHaveLength(3);
    expect(s.pins.map((p) => p.id)).toEqual(['id-0', 'id-1', 'id-2']);
  });

  it('UT-S05: renamePin 通常文字列 → nameのみ更新', () => {
    const s = renamePin(makeState(2), 'id-1', '新しい名前');
    expect(s.pins[1].name).toBe('新しい名前');
    expect(s.pins[1].query).toBe('q1');
    expect(s.pins[0].name).toBe('pin0');
  });

  it('UT-S06: renamePin 空文字・空白のみ → 変化なし', () => {
    const before = makeState(2);
    expect(renamePin(before, 'id-1', '').pins[1].name).toBe('pin1');
    expect(renamePin(before, 'id-1', '   ').pins[1].name).toBe('pin1');
  });

  it('UT-S07: movePin 中間要素を-1 → 1つ前と入れ替わる', () => {
    const s = movePin(makeState(3), 'id-1', -1);
    expect(s.pins.map((p) => p.id)).toEqual(['id-1', 'id-0', 'id-2']);
  });

  it('UT-S08: movePin 先頭を-1/末尾を+1 → 変化なし', () => {
    const before = makeState(3);
    expect(movePin(before, 'id-0', -1).pins.map((p) => p.id)).toEqual([
      'id-0',
      'id-1',
      'id-2',
    ]);
    expect(movePin(before, 'id-2', 1).pins.map((p) => p.id)).toEqual([
      'id-0',
      'id-1',
      'id-2',
    ]);
  });

  it('UT-S09: reorderPin 0→2(3件) → [B,C,A]', () => {
    const s = reorderPin(makeState(3), 0, 2);
    expect(s.pins.map((p) => p.id)).toEqual(['id-1', 'id-2', 'id-0']);
  });

  it('UT-S10: clearPins → pins=[]', () => {
    expect(clearPins(makeState(5)).pins).toEqual([]);
  });

  it('UT-S11: 全関数の不変性(引数stateが変異しない)', () => {
    const frozen = deepFreeze(makeState(3));
    expect(() => {
      addPin(frozen, { name: 'X', query: 'x', lat: 1, lng: 2 });
      removePin(frozen, 'id-1');
      renamePin(frozen, 'id-1', 'Y');
      movePin(frozen, 'id-1', 1);
      reorderPin(frozen, 0, 2);
      clearPins(frozen);
    }).not.toThrow();
    expect(frozen.pins.map((p) => p.id)).toEqual(['id-0', 'id-1', 'id-2']);
    expect(frozen.pins[1].name).toBe('pin1');
  });
});
