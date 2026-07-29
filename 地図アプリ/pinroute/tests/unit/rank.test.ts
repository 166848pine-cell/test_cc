import { describe, it, expect } from 'vitest';
import {
  normalizeForMatch,
  longestCommonSubstringLength,
  matchScore,
  rankCandidates,
  type RankInput,
} from '../../src/rank';

function gsi(
  name: string,
  lat: number,
  lng: number,
  kind: 'poi' | 'address' = 'poi',
): RankInput {
  return { name, lat, lng, source: 'gsi', kind };
}

describe('rank.ts 正規化', () => {
  it('UT-K01: 全角英数・空白・区切り記号を吸収する', () => {
    expect(normalizeForMatch('ＴＯＫＹＯ　駅')).toBe('tokyo駅');
    expect(normalizeForMatch('東京 ・ 駅')).toBe('東京駅');
  });

  it('UT-K02: 「一丁目九番一号」と「1-9-1」を同じ表記に寄せる', () => {
    expect(normalizeForMatch('丸の内一丁目9番1号')).toBe(
      normalizeForMatch('丸の内1-9-1'),
    );
    expect(normalizeForMatch('北十五条')).toBe('北15条');
  });

  it('UT-K03: 長音「ー」はハイフンに変換しない(語の一部のため)', () => {
    expect(normalizeForMatch('スカイツリー')).toBe('スカイツリー');
  });

  it('UT-K04: 最長共通部分文字列', () => {
    expect(longestCommonSubstringLength('東京駅', '北海道札幌市東区')).toBe(1);
    expect(longestCommonSubstringLength('新横浜駅', '横浜駅')).toBe(3);
    expect(longestCommonSubstringLength('', 'abc')).toBe(0);
  });
});

describe('rank.ts 一致度', () => {
  it('UT-K05: 完全一致 > クエリを含む > 部分一致 の順になる', () => {
    const exact = matchScore('横浜駅', '横浜駅');
    const contains = matchScore('新横浜駅', '横浜駅');
    const partial = matchScore('青森県上北郡横浜町', '横浜駅');
    expect(exact).toBe(1);
    expect(exact).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(partial);
  });

  it('UT-K06: 「東京駅」に対して「北海道札幌市東区」は低い', () => {
    expect(matchScore('北海道札幌市東区', '東京駅')).toBeLessThan(0.4);
  });

  it('UT-K07: 空文字は0', () => {
    expect(matchScore('', '東京駅')).toBe(0);
    expect(matchScore('東京駅', '')).toBe(0);
  });
});

describe('rank.ts 並べ替えと重複統合', () => {
  /**
   * 国土地理院APIは関連度順に並んでおらず、「東京駅」の検索でも
   * 本命が配列の末尾に来る。並べ替えで先頭に出せることを確かめる。
   */
  it('UT-K08: 入力の末尾にある完全一致を先頭に並べ替える', () => {
    const inputs: RankInput[] = [
      gsi('北海道札幌市東区', 43.07, 141.36, 'address'),
      gsi('東京都渋谷区東', 35.65, 139.7, 'address'),
      gsi('丸の内警察署東京駅前交番', 35.6806, 139.7656),
      gsi('東京駅', 35.6813, 139.7662),
    ];
    const r = rankCandidates(inputs, '東京駅', 5);
    expect(r[0].name).toBe('東京駅');
  });

  it('UT-K09: 同名かつ近接する候補は1件にまとめる', () => {
    const inputs: RankInput[] = [
      gsi('東京駅', 35.6813, 139.7662),
      gsi('東京駅', 35.6777, 139.765), // 約400m差
    ];
    expect(rankCandidates(inputs, '東京駅', 5)).toHaveLength(1);
  });

  it('UT-K10: 同名でも離れていれば別地点として残す(各地の「富士山」)', () => {
    const inputs: RankInput[] = [
      gsi('富士山', 35.3628, 138.7308), // 静岡
      gsi('富士山', 36.3135, 138.1501), // 長野
      gsi('富士山', 35.9108, 139.3131), // 埼玉
    ];
    expect(rankCandidates(inputs, '富士山', 5)).toHaveLength(3);
  });

  it('UT-K11: 名称が違っても同じ場所を指す候補は落とす', () => {
    const inputs: RankInput[] = [
      gsi('六本木ヒルズ', 35.6602, 139.7298),
      gsi('六本木ヒルズ郵便局', 35.6603, 139.7289), // 約80m差
    ];
    const r = rankCandidates(inputs, '六本木ヒルズ', 5);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('六本木ヒルズ');
  });

  it('UT-K12: 本命が決まっているときに大きく劣る候補は表示しない', () => {
    const inputs: RankInput[] = [
      gsi('札幌市時計台', 43.0626, 141.3536),
      gsi('北海道札幌市', 43.09, 141.4, 'address'), // 一致度0.4程度
    ];
    const r = rankCandidates(inputs, '札幌市時計台', 5);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('札幌市時計台');
  });

  it('UT-K13: 無関係な候補しかなければ空配列(E1相当)', () => {
    expect(
      rankCandidates([gsi('北海道', 43, 141, 'address')], 'ざざざざざ', 5),
    ).toEqual([]);
  });

  it('UT-K14: limit 件に切り詰める', () => {
    const inputs = Array.from({ length: 8 }, (_, i) =>
      gsi(`候補${i}`, 35 + i, 139),
    );
    expect(rankCandidates(inputs, '候補', 5)).toHaveLength(5);
  });

  it('UT-K15: 同点なら著名さ(importance)が高いほうを先に出す', () => {
    const inputs: RankInput[] = [
      gsi('富士山', 36.3135, 138.1501), // 長野の小さな山
      {
        name: '富士山',
        lat: 35.3628,
        lng: 138.7308,
        source: 'nominatim',
        kind: 'poi',
        importance: 0.61,
      },
    ];
    const r = rankCandidates(inputs, '富士山', 5);
    expect(r[0].lat).toBeCloseTo(35.3628, 3);
  });
});
