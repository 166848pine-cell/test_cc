/**
 * 「まとめて入力」で貼り付けられた表を読み取る(すべて副作用なしの純粋関数)。
 *
 * Excelやスプレッドシートからのコピーはタブ区切り、
 * CSVファイルの中身をそのまま貼るとカンマ区切りになるため、どちらも受け取る。
 */

export interface ParsedTable {
  /** 見出し行。見出しが無い表では「列1」「列2」…を割り当てる。 */
  headers: string[];
  /** 見出しを除いたデータ行。列数は headers に揃える。 */
  rows: string[][];
  /** 読み取りに使った区切り文字。 */
  delimiter: 'tab' | 'comma';
  /** 1行目を見出しとみなしたか。 */
  hasHeader: boolean;
}

/** 1行を区切り文字で分割する。二重引用符で囲まれた値に対応する。 */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** 見出し行らしいか。数字だけ・住所らしい値が並ぶ行は見出しではないと判断する。 */
function looksLikeHeader(cells: string[]): boolean {
  const filled = cells.filter((c) => c !== '');
  if (filled.length === 0) return false;
  const addressLike = filled.filter((c) =>
    /[都道府県市区町村]|\d+\s*[-−]\s*\d+|丁目/.test(c),
  );
  const numeric = filled.filter((c) => /^[\d.,]+$/.test(c));
  return addressLike.length === 0 && numeric.length === 0;
}

/**
 * 貼り付けたテキストを表として読み取る。
 * 行が1つも無い場合は null。
 */
export function parseTable(
  text: string,
  forceHeader?: boolean,
): ParsedTable | null {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return null;

  const delimiter: 'tab' | 'comma' = lines.some((l) => l.includes('\t'))
    ? 'tab'
    : 'comma';
  const sep = delimiter === 'tab' ? '\t' : ',';
  const grid = lines.map((l) => splitLine(l, sep));
  const width = Math.max(...grid.map((r) => r.length));
  const padded = grid.map((r) => {
    const copy = [...r];
    while (copy.length < width) copy.push('');
    return copy;
  });

  const hasHeader = forceHeader ?? looksLikeHeader(padded[0]);
  const headers = hasHeader
    ? padded[0].map((h, i) => (h === '' ? `列${i + 1}` : h))
    : padded[0].map((_h, i) => `列${i + 1}`);
  const rows = hasHeader ? padded.slice(1) : padded;

  // 見出しの重複は後ろに連番を付けて区別する
  const seen = new Map<string, number>();
  const uniqueHeaders = headers.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });

  if (rows.length === 0) return null;
  return { headers: uniqueHeaders, rows, delimiter, hasHeader };
}

/** 住所として使えそうな値か。 */
function addressScore(value: string): number {
  if (value === '') return 0;
  let s = 0;
  if (/[都道府県]/.test(value)) s += 2;
  if (/[市区町村]/.test(value)) s += 2;
  if (/丁目|番地|\d+\s*[-−]\s*\d+/.test(value)) s += 2;
  if (/^\d{3}-?\d{4}/.test(value)) s += 1;
  return s;
}

/** 住所が入っていそうな列を推定する。見つからなければ -1。 */
export function guessAddressColumn(
  headers: string[],
  rows: string[][],
): number {
  const byHeader = headers.findIndex((h) =>
    /住所|所在地|address|アドレス|地番/i.test(h),
  );
  if (byHeader >= 0) return byHeader;

  let best = -1;
  let bestScore = 0;
  for (let col = 0; col < headers.length; col++) {
    const score = rows.reduce((sum, r) => sum + addressScore(r[col] ?? ''), 0);
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return bestScore >= rows.length ? best : -1;
}

/** 名称に使えそうな列を推定する。見つからなければ住所以外の最初の列。 */
export function guessNameColumn(
  headers: string[],
  addressColumn: number,
): number {
  const byHeader = headers.findIndex((h) =>
    /物件名|物件|名称|名前|建物名|ビル名|title|name/i.test(h),
  );
  if (byHeader >= 0 && byHeader !== addressColumn) return byHeader;
  const first = headers.findIndex((_h, i) => i !== addressColumn);
  return first >= 0 ? first : addressColumn;
}

export interface BulkEntry {
  /** ジオコーディングに使う住所。 */
  address: string;
  /** ピンの名称。空なら住所を使う。 */
  name: string;
  /** 情報ブロックに載せる値(列名→値)。名称・住所の列も含む。 */
  fields: Record<string, string>;
}

/** 表と列の割り当てから、取り込む1件ずつのデータを組み立てる。 */
export function buildEntries(
  table: ParsedTable,
  addressColumn: number,
  nameColumn: number,
): BulkEntry[] {
  const out: BulkEntry[] = [];
  for (const row of table.rows) {
    const address = (row[addressColumn] ?? '').trim();
    if (address === '') continue;
    const name = (row[nameColumn] ?? '').trim();
    const fields: Record<string, string> = {};
    table.headers.forEach((h, i) => {
      // 名称の列はブロックの見出しに出るので、中の項目としては重複させない
      if (i === nameColumn) return;
      const value = (row[i] ?? '').trim();
      if (value !== '') fields[h] = value;
    });
    out.push({ address, name: name === '' ? address : name, fields });
  }
  return out;
}
