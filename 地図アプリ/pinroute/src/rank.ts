/**
 * 検索候補の正規化・関連度スコアリング・重複統合(すべて副作用なしの純粋関数)。
 *
 * 背景: 国土地理院AddressSearchは関連度順に並んでいない。
 * 例)「東京駅」で53件返るが先頭は「北海道札幌市東区」等の部分一致で、
 * 本命の「東京駅」は配列末尾に来る。素朴に先頭5件を採ると常に無関係な候補になる。
 * そのため取得後にこのモジュールで並べ替える。
 */

/** 表記ゆれを吸収した比較用文字列を返す。 */
export function normalizeForMatch(s: string): string {
  let t = s.normalize('NFKC').toLowerCase();
  t = kanjiNumeralsToArabic(t);
  t = addressNumbersToHyphen(t);
  // ハイフン類を統一(長音「ー」は語の一部なので変換しない)
  t = t.replace(/[‐‑‒–—―−]/g, '-');
  // 空白・区切り記号を除去(ハイフンは住所の階層として意味を持つため残す)
  t = t.replace(/[\s　,、.。・･/／\\()（）「」【】]/g, '');
  // 連続ハイフンの圧縮と前後の除去
  t = t.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  return t;
}

const KANJI_DIGIT: Record<string, string> = {
  〇: '0',
  一: '1',
  二: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
};

/** 「一丁目」「十五番」など住所の漢数字を算用数字にする(1〜99に対応)。 */
function kanjiNumeralsToArabic(s: string): string {
  return s.replace(
    /([〇一二三四五六七八九十]+)(?=丁目|番地|番|号|条|線)/g,
    (seg) => {
      const i = seg.indexOf('十');
      if (i < 0) {
        let out = '';
        for (const c of seg) out += KANJI_DIGIT[c] ?? c;
        return out;
      }
      const tens = i === 0 ? 1 : Number(KANJI_DIGIT[seg[i - 1]] ?? '0');
      const onesChar = seg[i + 1];
      const ones =
        onesChar === undefined ? 0 : Number(KANJI_DIGIT[onesChar] ?? '0');
      return String(tens * 10 + ones);
    },
  );
}

/**
 * 「1丁目9番1号」と「1-9-1」を同じ表記に寄せる。
 * 国土地理院は前者、利用者入力は後者が多く、揃えないと一致判定できない。
 */
function addressNumbersToHyphen(s: string): string {
  return s
    .replace(/(\d+)\s*丁目/g, '$1-')
    .replace(/(\d+)\s*番地/g, '$1-')
    .replace(/(\d+)\s*番/g, '$1-')
    .replace(/(\d+)\s*号/g, '$1');
}

/** 2文字列の最長共通部分文字列の長さ。 */
export function longestCommonSubstringLength(a: string, b: string): number {
  if (a === '' || b === '') return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * 候補名がクエリにどれだけ合致するかを 0〜1 で返す。
 *  1.00        完全一致
 *  0.85〜0.99  クエリを丸ごと含む(「横浜駅」に対する「新横浜駅」など。短いほど高得点)
 *  0〜0.80     部分一致(最長共通部分文字列の割合)
 */
export function matchScore(title: string, query: string): number {
  const t = normalizeForMatch(title);
  const q = normalizeForMatch(query);
  if (t === '' || q === '') return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.85 + 0.14 * (q.length / t.length);
  const lcs = longestCommonSubstringLength(t, q);
  return (0.8 * lcs) / Math.max(q.length, t.length);
}

/** スコア計算前の候補。 */
export interface RankInput {
  name: string;
  lat: number;
  lng: number;
  source: 'gsi' | 'nominatim';
  /** 「東京都千代田区」など、同名候補を見分けるための所在地。 */
  context?: string;
  /** 施設・駅などの地点か、住所(丁目・市区町村)レベルか。 */
  kind: 'poi' | 'address';
  /** Nominatimのimportance(0〜1)。GSIは持たないためundefined。 */
  importance?: number;
}

export interface RankedCandidate extends RankInput {
  /** 表示・デバッグ用の関連度(0〜1)。 */
  score: number;
}

/** これ未満の候補は無関係とみなして捨てる。 */
export const MIN_SCORE = 0.3;
/** 同名候補をこの距離未満なら同一地点とみなして統合する。 */
const SAME_NAME_KM = 5;
/**
 * 名称が違ってもこの距離未満なら同じ場所とみなす。
 * 「東京駅」に対する「東京駅(改札外)」「丸の内警察署東京駅前交番」のような、
 * ピンを立てる目的では区別する意味のない候補を落とすため。
 */
const SAME_PLACE_KM = 0.25;
/** 最良候補からこれ以上劣る候補は表示しない(本命が決まっているときに迷わせない)。 */
const RELATIVE_DROP = 0.35;

function distanceKm(a: RankInput, b: RankInput): number {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * 並べ替えの優先順位:
 *  1. クエリとの一致度(最重要)
 *  2. 施設・駅などの地点 > 市区町村レベルの住所
 *  3. Nominatimのimportance(著名さ)。GSIは中庸の固定値で評価する
 */
function totalScore(c: RankedCandidate): number {
  const typeBonus = c.kind === 'poi' ? 2 : 0;
  const fame =
    c.source === 'nominatim'
      ? Math.min(Math.max(c.importance ?? 0.3, 0), 1) * 8
      : 3;
  return c.score * 100 + typeBonus + fame;
}

/**
 * 関連度順に並べ替え、無関係な候補と重複を落として上位 limit 件を返す。
 * 同名でも離れていれば別地点(例:各地の「富士山」)として残す。
 */
export function rankCandidates(
  inputs: RankInput[],
  query: string,
  limit: number,
): RankedCandidate[] {
  const scored: RankedCandidate[] = inputs
    .map((c) => ({ ...c, score: matchScore(c.name, query) }))
    .filter((c) => c.score >= MIN_SCORE);
  if (scored.length === 0) return [];

  scored.sort((a, b) => totalScore(b) - totalScore(a));

  // 並び順は totalScore だが、足切りは一致度そのもので判断する
  const cutoff = Math.max(
    MIN_SCORE,
    Math.max(...scored.map((c) => c.score)) - RELATIVE_DROP,
  );

  const out: RankedCandidate[] = [];
  for (const c of scored) {
    if (c.score < cutoff) continue;
    const key = normalizeForMatch(c.name);
    const dup = out.some((o) => {
      const km = distanceKm(o, c);
      return (
        km < SAME_PLACE_KM ||
        (normalizeForMatch(o.name) === key && km < SAME_NAME_KM)
      );
    });
    if (dup) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
