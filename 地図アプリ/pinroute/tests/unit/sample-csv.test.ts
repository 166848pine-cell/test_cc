import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseTable,
  guessAddressColumn,
  guessNameColumn,
  buildEntries,
} from '../../src/bulk';

/**
 * 同梱しているサンプルCSVそのものを読んで確かめる。
 * マニュアルの手順で使うファイルなので、中身が欠けたまま配られないようにする。
 */
describe('docs/sample-properties.csv', () => {
  const csv = readFileSync('docs/sample-properties.csv', 'utf-8');

  it('UT-B16: 見出し7列・データ10行として読める(BOM付きでも壊れない)', () => {
    const table = parseTable(csv, true);
    expect(table).not.toBeNull();
    expect(table!.headers).toEqual([
      '物件名',
      '住所',
      '駅徒歩',
      '賃料',
      '専有面積',
      '間取り',
      '築年',
    ]);
    expect(table!.rows).toHaveLength(10);
    for (const row of table!.rows) {
      expect(row).toHaveLength(7);
      expect(row.every((cell) => cell !== '')).toBe(true);
    }
  });

  it('UT-B17: 住所・名称の列が自動で選ばれ、全10件が取り込める', () => {
    const table = parseTable(csv, true)!;
    const addressColumn = guessAddressColumn(table.headers, table.rows);
    const nameColumn = guessNameColumn(table.headers, addressColumn);
    expect(table.headers[addressColumn]).toBe('住所');
    expect(table.headers[nameColumn]).toBe('物件名');

    const entries = buildEntries(table, addressColumn, nameColumn);
    expect(entries).toHaveLength(10);
    expect(entries[0].name).toBe('神保町ステーションコート');
    expect(entries[0].address).toBe('東京都千代田区神田神保町2-2');
    // 名称の列を除いた6項目が情報ブロックに載る
    expect(Object.keys(entries[0].fields)).toEqual([
      '住所',
      '駅徒歩',
      '賃料',
      '専有面積',
      '間取り',
      '築年',
    ]);
  });

  it('UT-B18: すべての住所が東京都千代田区の表記になっている', () => {
    const table = parseTable(csv, true)!;
    const addressColumn = guessAddressColumn(table.headers, table.rows);
    for (const row of table.rows) {
      expect(row[addressColumn]).toMatch(/^東京都千代田区/);
    }
  });
});
