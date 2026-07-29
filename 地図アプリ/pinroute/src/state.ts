import { newId, type AppState, type Pin } from './types';
import type { MarkerStyle } from './appearance';

export const MAX_PINS = 20;

/** 上限20件。超過時はそのままのstateを返す(呼び出し側で通知)。 */
export function addPin(state: AppState, pin: Omit<Pin, 'id'>): AppState {
  if (state.pins.length >= MAX_PINS) return state;
  return {
    ...state,
    pins: [...state.pins, { ...pin, id: newId() }],
  };
}

export function removePin(state: AppState, id: string): AppState {
  const pins = state.pins.filter((p) => p.id !== id);
  if (pins.length === state.pins.length) return state;
  return { ...state, pins };
}

/** nameはtrim。空文字なら変更しない。 */
export function renamePin(state: AppState, id: string, name: string): AppState {
  const trimmed = name.trim();
  if (trimmed === '') return state;
  return {
    ...state,
    pins: state.pins.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
  };
}

/** 端では変化なし。 */
export function movePin(state: AppState, id: string, dir: -1 | 1): AppState {
  const idx = state.pins.findIndex((p) => p.id === id);
  if (idx < 0) return state;
  const to = idx + dir;
  if (to < 0 || to >= state.pins.length) return state;
  const pins = [...state.pins];
  const [item] = pins.splice(idx, 1);
  pins.splice(to, 0, item);
  return { ...state, pins };
}

/** D&D用。範囲外は変化なし。 */
export function reorderPin(
  state: AppState,
  fromIdx: number,
  toIdx: number,
): AppState {
  const len = state.pins.length;
  if (
    fromIdx < 0 ||
    fromIdx >= len ||
    toIdx < 0 ||
    toIdx >= len ||
    fromIdx === toIdx
  ) {
    return state;
  }
  const pins = [...state.pins];
  const [item] = pins.splice(fromIdx, 1);
  pins.splice(toIdx, 0, item);
  return { ...state, pins };
}

export function clearPins(state: AppState): AppState {
  return { ...state, pins: [] };
}

/**
 * 情報ブロックの位置を更新する。
 * others に渡した分もあわせて確定させ、1つ動かしたときに他が動かないようにする。
 */
export function setLabelOffset(
  state: AppState,
  id: string,
  offset: { x: number; y: number },
  others: { id: string; offset: { x: number; y: number } }[] = [],
): AppState {
  const fixed = new Map(others.map((o) => [o.id, o.offset]));
  fixed.set(id, offset);
  return {
    ...state,
    pins: state.pins.map((p) => {
      const next = fixed.get(p.id);
      return next === undefined ? p : { ...p, labelOffset: next };
    }),
  };
}

/** 情報ブロックの表示・非表示を切り替える。 */
export function setLabelHidden(
  state: AppState,
  id: string,
  hidden: boolean,
): AppState {
  return {
    ...state,
    pins: state.pins.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p };
      if (hidden) next.labelHidden = true;
      else delete next.labelHidden;
      return next;
    }),
  };
}

/** すべての情報ブロックを既定の位置に戻し、隠したものも出す。 */
export function resetLabels(state: AppState): AppState {
  return {
    ...state,
    pins: state.pins.map((p) => {
      const next = { ...p };
      delete next.labelOffset;
      delete next.labelHidden;
      return next;
    }),
  };
}

/** 情報ブロックの項目を1つ前後に動かす。 */
export function moveField(
  state: AppState,
  order: string[],
  field: string,
  dir: -1 | 1,
): AppState {
  const idx = order.indexOf(field);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= order.length) return state;
  const next = [...order];
  const [item] = next.splice(idx, 1);
  next.splice(to, 0, item);
  return { ...state, fieldOrder: next };
}

/** 情報ブロックに出す項目の表示・非表示を切り替える。 */
export function toggleField(
  state: AppState,
  order: string[],
  field: string,
): AppState {
  const hidden = state.hiddenFields ?? [];
  const next = hidden.includes(field)
    ? hidden.filter((f) => f !== field)
    : [...hidden, field];
  return { ...state, fieldOrder: order, hiddenFields: next };
}

/** まとめて入力で取り込んだ地点を追加する。 */
export function addPinsWithFields(
  state: AppState,
  entries: Omit<Pin, 'id'>[],
): AppState {
  const room = MAX_PINS - state.pins.length;
  const accepted = entries.slice(0, Math.max(room, 0));
  if (accepted.length === 0) return state;
  return {
    ...state,
    pins: [...state.pins, ...accepted.map((e) => ({ ...e, id: newId() }))],
  };
}

/** 全体の見た目を変える。地点ごとの指定はそのまま残る。 */
export function setGlobalStyle(state: AppState, style: MarkerStyle): AppState {
  const next = { ...(state.style ?? {}), ...style };
  return { ...state, style: next };
}

/** 全体の見た目に合わせて、地点ごとの指定をすべて外す。 */
export function clearAllPinStyles(state: AppState): AppState {
  return {
    ...state,
    pins: state.pins.map((p) => {
      if (p.style === undefined) return p;
      const next = { ...p };
      delete next.style;
      return next;
    }),
  };
}

/** 地点1つの見た目を変える。 */
export function setPinStyle(
  state: AppState,
  id: string,
  style: MarkerStyle,
): AppState {
  return {
    ...state,
    pins: state.pins.map((p) =>
      p.id === id ? { ...p, style: { ...(p.style ?? {}), ...style } } : p,
    ),
  };
}

/** 地点1つの見た目を全体設定に戻す。 */
export function clearPinStyle(state: AppState, id: string): AppState {
  return {
    ...state,
    pins: state.pins.map((p) => {
      if (p.id !== id || p.style === undefined) return p;
      const next = { ...p };
      delete next.style;
      return next;
    }),
  };
}

/** 情報ブロックの項目をすべて表示する / すべて隠す。 */
export function setAllFieldsVisible(
  state: AppState,
  order: string[],
  visible: boolean,
): AppState {
  return {
    ...state,
    fieldOrder: order,
    hiddenFields: visible ? [] : [...order],
  };
}
