import type { AppState } from './types';
import { normalizeState } from './types';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 座標は小数6桁(約0.1m)あれば十分。桁を落としてURLを短くする。 */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * 共有URLを生成する。tooLong = url.length > 2000
 *
 * URLは短いほどよいため、ピンを配列 `[名称, 検索語, 緯度, 経度, 所在地]` に畳んで持つ。
 *  - id は復元時に再発行されるので入れない
 *  - 検索語が名称と同じなら空文字にして復元時に埋め戻す
 *  - 所在地が無ければ空文字
 * 20件を登録しても実用上2,000文字に収まるようにするため(要件§5)。
 */
export function encodeShareUrl(
  state: AppState,
  baseUrl: string,
): { url: string; tooLong: boolean } {
  const json = JSON.stringify({
    v: 1,
    p: state.pins.map((pin) => {
      // 末尾が既定値ばかりの要素は落として短くする(読む側は無い分を既定として扱う)
      const parts: unknown[] = [
        pin.name,
        pin.query === pin.name ? '' : pin.query,
        round6(pin.lat),
        round6(pin.lng),
        pin.context ?? '',
        pin.fields ?? 0,
        pin.labelOffset === undefined
          ? 0
          : [pin.labelOffset.x, pin.labelOffset.y],
        pin.labelHidden === true ? 1 : 0,
        pin.style ?? 0,
      ];
      while (
        parts.length > 4 &&
        (parts[parts.length - 1] === 0 || parts[parts.length - 1] === '')
      ) {
        parts.pop();
      }
      return parts;
    }),
    ...(state.fieldOrder === undefined ? {} : { f: state.fieldOrder }),
    ...(state.hiddenFields === undefined || state.hiddenFields.length === 0
      ? {}
      : { h: state.hiddenFields }),
    ...(state.labelsVisible === false ? { lv: 0 } : {}),
    ...(state.routeVisible === false ? { rv: 0 } : {}),
    ...(state.style === undefined ? {} : { st: state.style }),
  });
  const payload = bytesToBase64Url(new TextEncoder().encode(json));
  const url = `${baseUrl}#s=${payload}`;
  return { url, tooLong: url.length > 2000 };
}

/** 畳んだ形式をAppState相当の形に戻す。該当しなければnull。 */
function expandCompact(u: unknown): unknown | null {
  if (typeof u !== 'object' || u === null) return null;
  const o = u as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.p)) return null;
  const pins: Record<string, unknown>[] = [];
  for (const item of o.p) {
    if (!Array.isArray(item) || item.length < 4) return null;
    const [name, query, lat, lng, context, fields, offset, hidden, style] =
      item as unknown[];
    if (typeof name !== 'string' || typeof query !== 'string') return null;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const labelOffset =
      Array.isArray(offset) &&
      typeof offset[0] === 'number' &&
      typeof offset[1] === 'number'
        ? { x: offset[0], y: offset[1] }
        : undefined;
    pins.push({
      name,
      query: query === '' ? name : query,
      lat,
      lng,
      ...(typeof context === 'string' && context !== '' ? { context } : {}),
      ...(typeof fields === 'object' &&
      fields !== null &&
      !Array.isArray(fields)
        ? { fields }
        : {}),
      ...(labelOffset === undefined ? {} : { labelOffset }),
      ...(hidden === 1 ? { labelHidden: true } : {}),
      ...(typeof style === 'object' && style !== null && !Array.isArray(style)
        ? { style }
        : {}),
    });
  }
  return {
    v: 1,
    pins,
    ...(Array.isArray(o.f) ? { fieldOrder: o.f } : {}),
    ...(Array.isArray(o.h) ? { hiddenFields: o.h } : {}),
    ...(o.lv === 0 ? { labelsVisible: false } : {}),
    ...(o.rv === 0 ? { routeVisible: false } : {}),
    ...(typeof o.st === 'object' && o.st !== null ? { style: o.st } : {}),
  };
}

/**
 * 失敗はnull(throwしない)。idは再発行。
 * 畳んだ形式と、そのまま `pins` を並べた形式のどちらも読める。
 */
export function decodeSharePayload(payload: string): AppState | null {
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(
      base64UrlToBytes(payload),
    );
    const parsed: unknown = JSON.parse(json);
    return normalizeState(expandCompact(parsed) ?? parsed, true);
  } catch {
    return null;
  }
}
