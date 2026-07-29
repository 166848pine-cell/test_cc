import type { AppState } from './types';
import { normalizeState } from './types';

const KEY = 'pinroute:state';

/** 300msデバウンスは呼び出し側(main.ts)で適用する。 */
export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 容量超過等は無視(クラッシュさせない)
  }
}

/** パース失敗・バージョン不一致はnull(サイレント破棄)。 */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return normalizeState(parsed, false);
  } catch {
    return null;
  }
}
