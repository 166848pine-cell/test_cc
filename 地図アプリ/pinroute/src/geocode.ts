import { rateLimit } from './throttle';
import { muniName } from './muni';
import {
  rankCandidates,
  normalizeForMatch,
  type RankInput,
  type RankedCandidate,
} from './rank';
import { getCached, setCached } from './geocache';

export type GeoCandidate = RankedCandidate;

export type GeocodeErrorKind = 'network' | 'timeout';

export class GeocodeError extends Error {
  readonly kind: GeocodeErrorKind;
  constructor(kind: GeocodeErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'GeocodeError';
    this.kind = kind;
  }
}

const GSI_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 8000;
/** NFR-07「入力確定から3秒以内に候補表示」の目標時間。 */
const SEARCH_BUDGET_MS = 2800;
/** 補完としてのNominatim待ち時間の下限・上限。 */
const SUPPLEMENT_MIN_MS = 800;
const SUPPLEMENT_MAX_MS = 3500;
const MAX_CANDIDATES = 5;
/** 国土地理院の結果がこの一致度なら、それだけで確定とみなす。 */
const EXACT_ENOUGH = 0.999;
/** 住所らしい入力なら、この一致度で国土地理院の結果を採用する。 */
const ADDRESS_ENOUGH = 0.65;

/**
 * 住所らしい入力か。
 * 住所は国土地理院が最も強いので、そう見えるときはNominatimまで聞きに行かない。
 */
export function looksLikeAddress(query: string): boolean {
  if (/[都道府県]/.test(query) && /[市区町村]/.test(query)) return true;
  if (/丁目|番地|\d+\s*条/.test(query)) return true;
  if (/[市区町村]/.test(query) && /\d/.test(query)) return true;
  return /\d+\s*[-‐‑–—−]\s*\d/.test(query);
}

/**
 * 国土地理院レスポンスのパーサ(純粋関数)。不正形状は空配列。
 * addressCode があるものは施設・駅などの地点、空のものは市区町村・丁目レベルの住所。
 */
export function parseGsiResponse(json: unknown): RankInput[] {
  if (!Array.isArray(json)) return [];
  const out: RankInput[] = [];
  for (const f of json) {
    if (typeof f !== 'object' || f === null) continue;
    const feature = f as Record<string, unknown>;
    const geometry = feature.geometry as Record<string, unknown> | undefined;
    const properties = feature.properties as
      Record<string, unknown> | undefined;
    const coords = geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const title = typeof properties?.title === 'string' ? properties.title : '';
    if (title === '') continue;
    const addressCode =
      typeof properties?.addressCode === 'string' ? properties.addressCode : '';
    out.push({
      name: title,
      lat,
      lng: lon,
      source: 'gsi',
      kind: addressCode === '' ? 'address' : 'poi',
      context: muniName(addressCode),
    });
  }
  return out;
}

/** Nominatimのdisplay_nameから「都道府県+市区町村+町名」相当の所在地を組み立てる。 */
export function buildNominatimContext(
  displayName: string,
  name: string,
): string | undefined {
  const segments = displayName
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '' && s !== name)
    .filter((s) => s !== '日本' && !s.endsWith('地方') && !s.endsWith('振興局'))
    .filter((s) => !/^\d+$/.test(s) && !/^\d{3}-\d{4}$/.test(s));
  if (segments.length === 0) return undefined;
  return segments.slice(-3).reverse().join('');
}

/**
 * Nominatimレスポンスのパーサ(純粋関数)。lat/lon文字列→number、NaNは除外。
 * 表示名には冗長な display_name ではなく name を使い、所在地は context に分ける。
 */
export function parseNominatimResponse(json: unknown): RankInput[] {
  if (!Array.isArray(json)) return [];
  const out: RankInput[] = [];
  for (const item of json) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const lat =
      typeof o.lat === 'string'
        ? Number(o.lat)
        : typeof o.lat === 'number'
          ? o.lat
          : NaN;
    const lng =
      typeof o.lon === 'string'
        ? Number(o.lon)
        : typeof o.lon === 'number'
          ? o.lon
          : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const displayName =
      typeof o.display_name === 'string' ? o.display_name : '';
    const rawName = typeof o.name === 'string' && o.name !== '' ? o.name : '';
    // OSMは「東京駅;地下2階」のように階層をセミコロンで連ねることがある。先頭だけ使う。
    const name = (rawName !== '' ? rawName : (displayName.split(',')[0] ?? ''))
      .split(';')[0]
      .trim();
    if (name === '') continue;
    const category = typeof o.category === 'string' ? o.category : '';
    const importance =
      typeof o.importance === 'number' ? o.importance : undefined;
    out.push({
      name,
      lat,
      lng,
      source: 'nominatim',
      kind: category === 'place' || category === 'boundary' ? 'address' : 'poi',
      context: buildNominatimContext(displayName, name),
      importance,
    });
  }
  return out;
}

/**
 * 検索に使う文字列の候補を、可能性の高い順に返す。
 *
 * 不動産資料などから貼り付けた住所には郵便番号や建物名・部屋番号が付いていることが多く、
 * そのままでは0件になる(例:「〒160-0023 東京都新宿区西新宿2-8-1」)。
 * 見つからなかったときに順に切り詰めて再挑戦するための候補を作る。
 */
export function buildQueryVariants(raw: string): string[] {
  const out: string[] = [];
  const push = (s: string): void => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t !== '' && !out.includes(t)) out.push(t);
  };

  const base = raw.trim();
  push(base);

  // 郵便番号(〒付き・先頭の7桁)を落とす
  const noPostal = base
    .replace(/〒\s*\d{3}\s*-?\s*\d{4}/g, ' ')
    .replace(/^\s*\d{3}-\d{4}\s+/, ' ');
  push(noPostal);

  // 末尾の建物名・部屋番号を落として住所部分だけにする
  const numberGroup = /\d+(?:\s*[-‐‑–—−ー]\s*\d+)+/g;
  let last: RegExpExecArray | null = null;
  for (
    let m = numberGroup.exec(noPostal);
    m !== null;
    m = numberGroup.exec(noPostal)
  ) {
    last = m;
  }
  if (last !== null) push(noPostal.slice(0, last.index + last[0].length));

  // 丁目・番地までで切る
  const chome = /^(.*?\d+\s*丁目)/.exec(
    noPostal.replace(/([〇一二三四五六七八九十]+)丁目/, '1丁目'),
  );
  if (chome !== null) push(chome[1]);

  return out.slice(0, 3);
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('timeout', 'TimeoutError')),
    timeoutMs,
  );
  const onAbort = (): void => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new GeocodeError('network', `HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof GeocodeError) throw e;
    if (externalSignal?.aborted) throw e;
    const reason: unknown = controller.signal.reason;
    const timedOut =
      reason instanceof DOMException && reason.name === 'TimeoutError';
    if (timedOut) throw new GeocodeError('timeout');
    if (e instanceof DOMException && e.name === 'AbortError')
      throw new GeocodeError('timeout');
    throw new GeocodeError('network');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

/** NFR-04: Nominatimへのリクエストは1秒1回以下。 */
const fetchNominatimLimited = rateLimit(
  (query: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> =>
    fetchJsonWithTimeout(
      `${NOMINATIM_URL}?format=jsonv2&limit=10&accept-language=ja&q=${encodeURIComponent(query)}`,
      timeoutMs,
      signal,
    ),
  1000,
);

/**
 * 地点検索。国土地理院→Nominatimの順に問い合わせ、両者を関連度順にまとめて最大5件返す。
 *
 * 国土地理院だけでは実用にならないため両方を統合している:
 *  - 国土地理院は関連度順に並ばない(「東京駅」で先頭が「北海道札幌市東区」になる)
 *  - 国土地理院は施設名に弱い(「札幌市時計台」→「北海道札幌市」しか返らない)
 * 並べ替え・重複統合は rank.ts が担当する。
 *
 * 通信エラーは GeocodeError を throw する。ただし国土地理院で候補が得られていれば
 * Nominatim の失敗は無視して、得られた分だけ返す(グレースフルデグラデーション)。
 */
export async function searchAddress(
  query: string,
  opts?: { signal?: AbortSignal; supplement?: boolean },
): Promise<GeoCandidate[]> {
  // 同じ言葉を何度も外部に問い合わせない(Nominatimの利用規約が求めるキャッシュ)
  const cacheKey = normalizeForMatch(query);
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  let lastError: unknown = null;
  for (const variant of buildQueryVariants(query)) {
    try {
      const found = await searchOnce(variant, opts);
      if (found.length > 0) {
        setCached(cacheKey, found);
        return found;
      }
    } catch (e) {
      if (opts?.signal?.aborted) throw e;
      lastError = e;
    }
  }
  if (lastError !== null) throw lastError;
  // 0件も覚えておき、同じ言葉での問い合わせを繰り返さない
  setCached(cacheKey, []);
  return [];
}

/** 1つの検索文字列で問い合わせる。採点もその文字列に対して行う。 */
async function searchOnce(
  query: string,
  opts?: { signal?: AbortSignal; supplement?: boolean },
): Promise<GeoCandidate[]> {
  const startedAt = Date.now();
  let gsiCandidates: RankInput[] = [];
  let gsiFailed = false;
  try {
    const json = await fetchJsonWithTimeout(
      `${GSI_URL}?q=${encodeURIComponent(query)}`,
      TIMEOUT_MS,
      opts?.signal,
    );
    gsiCandidates = parseGsiResponse(json);
  } catch (e) {
    if (e instanceof GeocodeError && e.kind === 'timeout') throw e;
    if (opts?.signal?.aborted) throw e;
    gsiFailed = true;
  }

  // 国土地理院だけで候補が揃っているなら、Nominatimは「あれば使う」補完に留める。
  // 残り時間だけ待ち、間に合わなければ得られている分で返す(NFR-07)。
  const gsiRanked = rankCandidates(gsiCandidates, query, MAX_CANDIDATES);
  const hasGsiHit = gsiRanked.length > 0;
  const gsiTopScore = gsiRanked[0]?.score ?? 0;

  // Nominatimは公開サーバーなので、国土地理院で答えが出ているときは呼ばない。
  //  - 完全一致(「東京駅」など)
  //  - 住所らしい入力で十分に一致(「大阪市北区梅田1丁目」など)
  // 逆に「六本木ヒルズ」のような施設名は国土地理院が弱いので必ず補完する。
  const gsiIsEnough =
    hasGsiHit &&
    (gsiTopScore >= EXACT_ENOUGH ||
      (looksLikeAddress(query) && gsiTopScore >= ADDRESS_ENOUGH));

  if (gsiIsEnough || (hasGsiHit && opts?.supplement === false)) {
    return gsiRanked;
  }

  const remaining = SEARCH_BUDGET_MS - (Date.now() - startedAt);
  const nominatimTimeout = hasGsiHit
    ? Math.min(Math.max(remaining, SUPPLEMENT_MIN_MS), SUPPLEMENT_MAX_MS)
    : TIMEOUT_MS;

  let nominatimCandidates: RankInput[] = [];
  let nominatimFailed = false;
  try {
    const json = await fetchNominatimLimited(
      query,
      nominatimTimeout,
      opts?.signal,
    );
    nominatimCandidates = parseNominatimResponse(json);
  } catch (e) {
    if (opts?.signal?.aborted) throw e;
    nominatimFailed = true;
  }

  // 両系統とも通信に失敗したときだけエラーにする(E2)。
  // 片方でも応答していれば0件は「見つからなかった」(E1)として扱う。
  if (gsiFailed && nominatimFailed) throw new GeocodeError('network');

  return rankCandidates(
    [...gsiCandidates, ...nominatimCandidates],
    query,
    MAX_CANDIDATES,
  );
}
