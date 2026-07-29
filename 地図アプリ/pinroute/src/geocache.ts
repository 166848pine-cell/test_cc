import type { GeoCandidate } from './geocode';

/**
 * 検索結果の保存。
 *
 * Nominatimの利用規約は「結果は利用側で必ずキャッシュすること。同じ問い合わせを
 * 繰り返すクライアントは不正とみなしてブロックすることがある」と定めている。
 * 同じ言葉で何度も外部に問い合わせないためのしくみ。
 */

const KEY = 'pinroute:geocache';
/** これを過ぎた結果は捨てる。地名はそう変わらないので長めでよい。 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 保存する件数の上限。超えたら古いものから捨てる。 */
const MAX_ENTRIES = 300;

interface Entry {
  /** 保存した時刻。 */
  at: number;
  results: GeoCandidate[];
}

type Store = Record<string, Entry>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 保存できなくても検索自体は続けられるので握りつぶす
  }
}

/** 保存済みの結果を取り出す。無い・古い場合は null。 */
export function getCached(query: string): GeoCandidate[] | null {
  const store = read();
  const entry = store[query];
  if (entry === undefined) return null;
  if (typeof entry.at !== 'number' || !Array.isArray(entry.results))
    return null;
  if (Date.now() - entry.at > TTL_MS) return null;
  return entry.results;
}

/** 結果を保存する。0件も保存して、無駄な問い合わせを繰り返さないようにする。 */
export function setCached(query: string, results: GeoCandidate[]): void {
  const store = read();
  store[query] = { at: Date.now(), results };

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (store[a]?.at ?? 0) - (store[b]?.at ?? 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete store[k]);
  }
  write(store);
}

/** 保存した検索結果をすべて捨てる。 */
export function clearCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}
