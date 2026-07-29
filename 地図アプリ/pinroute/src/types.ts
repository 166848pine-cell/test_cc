import { normalizeStyle, type MarkerStyle } from './appearance';

/** 情報ブロックのピンからの位置(画面上のピクセル)。 */
export interface LabelOffset {
  x: number;
  y: number;
}

export interface Pin {
  id: string; // 一意なID(保存・共有時に再発行される)
  name: string; // 表示名(編集可)
  query: string; // 検索時の元入力
  lat: number;
  lng: number;
  /** 「東京都千代田区」など確定時の所在地。同名地点の区別と一覧表示に使う。 */
  context?: string;
  /** まとめて入力した表の値(列名→値)。情報ブロックに表示する。 */
  fields?: Record<string, string>;
  /** 情報ブロックの位置。未設定なら既定の位置に置く。 */
  labelOffset?: LabelOffset;
  /** この地点の情報ブロックだけ隠す。 */
  labelHidden?: boolean;
  /** この地点だけの見た目(色・大きさ)。未設定なら全体の設定に従う。 */
  style?: MarkerStyle;
}

export interface AppState {
  v: 1; // スキーマバージョン
  pins: Pin[]; // 並び順=ルート順
  /** 情報ブロックの項目の並び順(非表示のものも含む全列名)。 */
  fieldOrder?: string[];
  /** 情報ブロックに出さない項目。 */
  hiddenFields?: string[];
  /** 情報ブロック全体の表示。 */
  labelsVisible?: boolean;
  /** 車ルートの表示。false のときは計算も行わない。 */
  routeVisible?: boolean;
  /** ピンと情報ブロックの見た目の既定値。 */
  style?: MarkerStyle;
}

export function emptyState(): AppState {
  return { v: 1, pins: [] };
}

/** 全ピンに含まれる列名を、出現順に重複なく集める。 */
export function collectFieldNames(pins: Pin[]): string[] {
  const out: string[] = [];
  for (const pin of pins) {
    for (const key of Object.keys(pin.fields ?? {})) {
      if (!out.includes(key)) out.push(key);
    }
  }
  return out;
}

/**
 * 項目の並び順を決める。
 * 保存された並び順のうち今も存在するものを先に、まだ並び順に無い列を後ろに足す。
 * 非表示の項目もここには含まれる(設定画面で並べ替えるため)。
 */
export function resolveFieldOrder(
  pins: Pin[],
  saved: string[] | undefined,
): string[] {
  const available = collectFieldNames(pins);
  if (saved === undefined) return available;
  const kept = saved.filter((f) => available.includes(f));
  return [...kept, ...available.filter((f) => !saved.includes(f))];
}

/** 情報ブロックに実際に出す項目(非表示を除いたもの)。 */
export function visibleFieldOrder(
  order: string[],
  hidden: string[] | undefined,
): string[] {
  if (hidden === undefined || hidden.length === 0) return order;
  return order.filter((f) => !hidden.includes(f));
}

function isValidPinShape(
  u: unknown,
): u is { name: string; query: string; lat: number; lng: number } {
  if (typeof u !== 'object' || u === null) return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.query === 'string' &&
    typeof o.lat === 'number' &&
    Number.isFinite(o.lat) &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lng)
  );
}

/** 文字列だけを値に持つ辞書として受け取る。それ以外は undefined。 */
function normalizeFields(u: unknown): Record<string, string> | undefined {
  if (typeof u !== 'object' || u === null || Array.isArray(u)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(u as Record<string, unknown>)) {
    if (key === '' || typeof value !== 'string' || value === '') continue;
    out[key] = value;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function normalizeOffset(u: unknown): LabelOffset | undefined {
  if (typeof u !== 'object' || u === null) return undefined;
  const o = u as Record<string, unknown>;
  if (typeof o.x !== 'number' || !Number.isFinite(o.x)) return undefined;
  if (typeof o.y !== 'number' || !Number.isFinite(o.y)) return undefined;
  return { x: o.x, y: o.y };
}

/**
 * unknown値をAppStateとして検証する。
 * reissueIds=trueならidを再発行、falseなら既存の文字列idを維持(なければ発行)。
 * 不正形状はnull。
 */
export function normalizeState(
  u: unknown,
  reissueIds: boolean,
): AppState | null {
  if (typeof u !== 'object' || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.pins)) return null;
  const pins: Pin[] = [];
  for (const p of o.pins) {
    if (!isValidPinShape(p)) return null;
    const rec = p as Record<string, unknown>;
    const keepId = !reissueIds && typeof rec.id === 'string' && rec.id !== '';
    const context =
      typeof rec.context === 'string' && rec.context !== ''
        ? rec.context
        : undefined;
    const fields = normalizeFields(rec.fields);
    const labelOffset = normalizeOffset(rec.labelOffset);
    const style = normalizeStyle(rec.style);
    pins.push({
      id: keepId ? (rec.id as string) : newId(),
      name: p.name,
      query: p.query,
      lat: p.lat,
      lng: p.lng,
      ...(context === undefined ? {} : { context }),
      ...(fields === undefined ? {} : { fields }),
      ...(labelOffset === undefined ? {} : { labelOffset }),
      ...(rec.labelHidden === true ? { labelHidden: true } : {}),
      ...(style === undefined ? {} : { style }),
    });
  }

  const stringList = (u: unknown): string[] | undefined =>
    Array.isArray(u)
      ? u.filter((f): f is string => typeof f === 'string')
      : undefined;
  const fieldOrder = stringList(o.fieldOrder);
  const hiddenFields = stringList(o.hiddenFields);

  return {
    v: 1,
    pins,
    ...(fieldOrder === undefined ? {} : { fieldOrder }),
    ...(hiddenFields === undefined || hiddenFields.length === 0
      ? {}
      : { hiddenFields }),
    ...(o.labelsVisible === false ? { labelsVisible: false } : {}),
    ...(o.routeVisible === false ? { routeVisible: false } : {}),
    ...(normalizeStyle(o.style) === undefined
      ? {}
      : { style: normalizeStyle(o.style) as MarkerStyle }),
  };
}

/**
 * ピンの一意なID。
 * crypto.randomUUID はセキュアコンテキスト(https/localhost)でしか使えず、
 * LAN内のhttp配信などで落ちるため、使えない環境では代替の乱数IDを使う。
 */
export function newId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
