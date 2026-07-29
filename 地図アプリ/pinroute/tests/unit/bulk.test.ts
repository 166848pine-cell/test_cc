import { describe, it, expect } from 'vitest';
import {
  parseTable,
  guessAddressColumn,
  guessNameColumn,
  buildEntries,
} from '../../src/bulk';

const TSV = [
  '物件名\t住所\t駅徒歩\t賃料',
  'グランドメゾン新宿\t東京都新宿区西新宿2-8-1\t新宿駅 徒歩8分\t24.8万円',
  'パークレジデンス渋谷\t東京都渋谷区神南1-19-11\t渋谷駅 徒歩5分\t31.2万円',
].join('\n');

describe('bulk.ts 表の読み取り', () => {
  it('UT-B01: Excelからのタブ区切りを読み取る', () => {
    const t = parseTable(TSV);
    expect(t).not.toBeNull();
    expect(t!.delimiter).toBe('tab');
    expect(t!.hasHeader).toBe(true);
    expect(t!.headers).toEqual(['物件名', '住所', '駅徒歩', '賃料']);
    expect(t!.rows).toHaveLength(2);
    expect(t!.rows[1][0]).toBe('パークレジデンス渋谷');
  });

  it('UT-B02: CSVの引用符付きの値を読み取る', () => {
    const t = parseTable(
      '名称,住所,備考\n"A ビル","東京都港区北青山3-6-1","角地, 南向き"',
    );
    expect(t!.delimiter).toBe('comma');
    expect(t!.rows[0]).toEqual([
      'A ビル',
      '東京都港区北青山3-6-1',
      '角地, 南向き',
    ]);
  });

  it('UT-B03: 見出しが無い表は「列1」「列2」を割り当てる', () => {
    const t = parseTable('東京都新宿区西新宿2-8-1\t24.8万円');
    expect(t!.hasHeader).toBe(false);
    expect(t!.headers).toEqual(['列1', '列2']);
    expect(t!.rows).toHaveLength(1);
  });

  it('UT-B04: 見出しの重複は区別できる名前にする', () => {
    const t = parseTable('備考\t備考\nあ\tい', true);
    expect(t!.headers).toEqual(['備考', '備考 (2)']);
  });

  it('UT-B05: 空の入力・データ行が無い表は null', () => {
    expect(parseTable('')).toBeNull();
    expect(parseTable('   \n  ')).toBeNull();
    expect(parseTable('物件名\t住所', true)).toBeNull();
  });

  it('UT-B06: 列数がそろっていない行も欠けを空文字で埋める', () => {
    const t = parseTable('名称,住所,賃料\nA,東京都港区北青山3-6-1', true);
    expect(t!.rows[0]).toEqual(['A', '東京都港区北青山3-6-1', '']);
  });
  it('UT-B15: BOM付きCSVを貼り付けても最初の列名が壊れない', () => {
    const t = parseTable('\uFEFF物件名,住所\nA,東京都港区北青山3-6-1', true);
    expect(t!.headers[0]).toBe('物件名');
  });
});

describe('bulk.ts 列の推定', () => {
  it('UT-B07: 見出しから住所の列を選ぶ', () => {
    const t = parseTable(TSV)!;
    expect(guessAddressColumn(t.headers, t.rows)).toBe(1);
  });

  it('UT-B08: 見出しが無くても値の見た目から住所の列を選ぶ', () => {
    const t = parseTable(
      'A\t東京都新宿区西新宿2-8-1\t24.8万円\nB\t東京都港区北青山3-6-1\t19.5万円',
    )!;
    expect(guessAddressColumn(t.headers, t.rows)).toBe(1);
  });

  it('UT-B09: 住所らしい列が無ければ -1', () => {
    const t = parseTable('A\t100\nB\t200')!;
    expect(guessAddressColumn(t.headers, t.rows)).toBe(-1);
  });

  it('UT-B10: 見出しから名称の列を選ぶ。住所の列とは重ならない', () => {
    const t = parseTable(TSV)!;
    expect(guessNameColumn(t.headers, 1)).toBe(0);
  });

  it('UT-B11: 名称らしい見出しが無ければ住所以外の先頭列', () => {
    const t = parseTable('住所\t賃料\n東京都港区北青山3-6-1\t19.5万円', true)!;
    expect(guessNameColumn(t.headers, 0)).toBe(1);
  });
});

describe('bulk.ts 取り込むデータの組み立て', () => {
  it('UT-B12: 住所・名称・そのほかの列に振り分ける', () => {
    const t = parseTable(TSV)!;
    const entries = buildEntries(t, 1, 0);
    expect(entries).toHaveLength(2);
    expect(entries[0].address).toBe('東京都新宿区西新宿2-8-1');
    expect(entries[0].name).toBe('グランドメゾン新宿');
    // 名称の列は見出しに出るので項目には含めない
    expect(entries[0].fields).toEqual({
      住所: '東京都新宿区西新宿2-8-1',
      駅徒歩: '新宿駅 徒歩8分',
      賃料: '24.8万円',
    });
  });

  it('UT-B13: 住所が空の行は取り込まない', () => {
    const t = parseTable('名称,住所\nA,\nB,東京都港区北青山3-6-1', true)!;
    const entries = buildEntries(t, 1, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('B');
  });

  it('UT-B14: 名称が空なら住所を名称に使う', () => {
    const t = parseTable('名称,住所\n,東京都港区北青山3-6-1', true)!;
    const entries = buildEntries(t, 1, 0);
    expect(entries[0].name).toBe('東京都港区北青山3-6-1');
  });
});
