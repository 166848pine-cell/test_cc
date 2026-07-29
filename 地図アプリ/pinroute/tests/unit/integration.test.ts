import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchAddress, GeocodeError } from '../../src/geocode';
import { clearCache } from '../../src/geocache';
import { fetchRoute, RouteError } from '../../src/route';
import type { Pin } from '../../src/types';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function gsiFeature(title: string, lon = 139.7, lat = 35.6): unknown {
  return {
    geometry: { coordinates: [lon, lat] },
    properties: { title, addressCode: '' },
  };
}

function nominatimItem(name: string, lat = '35.0', lon = '139.0'): unknown {
  return { lat, lon, name, display_name: `${name}, 日本` };
}

/** URLに応じて応答を返すfetchモックを設置する。 */
function stubFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): FetchMock {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

function callsTo(mock: FetchMock, host: string): number {
  return mock.mock.calls.filter((c) => String(c[0]).includes(host)).length;
}

const pins2: Pin[] = [
  { id: '1', name: 'A', query: 'a', lat: 35.681, lng: 139.767 },
  { id: '2', name: 'B', query: 'b', lat: 35.466, lng: 139.622 },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // 検索結果の保存はテストをまたいで残るので、毎回消してから次を実行する
  clearCache();
});

describe('geocode 結合(fetchモック)', () => {
  /**
   * 04_test_spec.md の IT-01 は「GSIヒット時はNominatimを呼ばない」だったが、
   * 国土地理院APIだけでは実用にならない(施設名に弱く、関連度順にも並ばない)ため、
   * 必要なときだけNominatimで補う方式に変更した。詳細は README の「検索の仕組み」を参照。
   *
   * Nominatimは公開サーバーで、利用規約が「アプリ全体で1req/秒」「結果のキャッシュ必須」を
   * 求めているため、国土地理院で答えが出ているときは呼ばないようにしている。
   */
  it('IT-01: 国土地理院が完全一致を返したらNominatimを呼ばない', async () => {
    const mock = stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        return jsonResponse([gsiFeature('東京駅', 139.7662, 35.6813)]);
      }
      if (url.includes('nominatim')) {
        return jsonResponse([
          nominatimItem('東京駅八重洲口', '35.6810', '139.7690'),
        ]);
      }
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('東京駅');
    expect(r[0].name).toBe('東京駅');
    expect(r[0].source).toBe('gsi');
    expect(callsTo(mock, 'nominatim')).toBe(0);
  });

  it('IT-01d: 施設名で一致が不十分ならNominatimで補い、統合して返す', async () => {
    const mock = stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        // 国土地理院は「六本木ヒルズ」そのものを持たず、郵便局しか返さない
        return jsonResponse([
          gsiFeature('六本木ヒルズ郵便局', 139.7289, 35.6603),
        ]);
      }
      if (url.includes('nominatim')) {
        return jsonResponse([
          nominatimItem('六本木ヒルズ', '35.6602', '139.7298'),
        ]);
      }
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('六本木ヒルズ');
    expect(callsTo(mock, 'nominatim')).toBe(1);
    expect(r[0].name).toBe('六本木ヒルズ');
    expect(r[0].source).toBe('nominatim');
  });

  it('IT-01e: 住所らしい入力で十分に一致していればNominatimを呼ばない', async () => {
    const mock = stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        return jsonResponse([
          gsiFeature('大阪府大阪市北区梅田一丁目1番3号', 135.4999, 34.6984),
        ]);
      }
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('大阪市北区梅田1-1-3');
    expect(r).toHaveLength(1);
    expect(callsTo(mock, 'nominatim')).toBe(0);
  });

  it('IT-01b: GSIがヒットしていればNominatimが落ちていても結果を返す', async () => {
    stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        // 完全一致ではないのでNominatimを呼びに行くが、そちらは落ちている
        return jsonResponse([gsiFeature('東京駅前交番', 139.7656, 35.6806)]);
      }
      throw new TypeError('network error');
    });
    const r = await searchAddress('東京駅');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('東京駅前交番');
  });

  it('IT-01c: 両系統とも通信に失敗 → GeocodeError(E2相当)', async () => {
    stubFetch(async () => {
      throw new TypeError('network error');
    });
    await expect(searchAddress('東京駅')).rejects.toBeInstanceOf(GeocodeError);
  });

  it('IT-10: 同じ言葉の2回目は保存した結果を使い、外部に問い合わせない', async () => {
    const mock = stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        return jsonResponse([gsiFeature('東京駅', 139.7662, 35.6813)]);
      }
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected: ${url}`);
    });
    const first = await searchAddress('東京駅');
    const callsAfterFirst = mock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await searchAddress('東京駅');
    expect(mock.mock.calls.length).toBe(callsAfterFirst);
    expect(second).toEqual(first);

    // 表記が違っても同じ地点を指す言葉なら保存済みの結果を使う
    const third = await searchAddress(' 東京駅 ');
    expect(mock.mock.calls.length).toBe(callsAfterFirst);
    expect(third).toEqual(first);
  });

  it('IT-11: 見つからなかったことも覚えて、同じ言葉を問い合わせ直さない', async () => {
    const mock = stubFetch(async () => jsonResponse([]));
    expect(await searchAddress('ざざざざざ')).toEqual([]);
    const calls = mock.mock.calls.length;
    expect(await searchAddress('ざざざざざ')).toEqual([]);
    expect(mock.mock.calls.length).toBe(calls);
  });

  it('IT-02: GSI 0件→Nominatimフォールバック', async () => {
    stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) return jsonResponse([]);
      if (url.includes('nominatim'))
        return jsonResponse([nominatimItem('どこか')]);
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('どこか');
    expect(r).toHaveLength(1);
    expect(r[0].source).toBe('nominatim');
  });

  it('IT-03: 両API 0件 → 空配列(E1相当)', async () => {
    stubFetch(async () => jsonResponse([]));
    const r = await searchAddress('存在しない場所xyz');
    expect(r).toEqual([]);
  });

  it('IT-04: GSIネットワークエラー→Nominatimへ', async () => {
    stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp'))
        throw new TypeError('network error');
      if (url.includes('nominatim'))
        return jsonResponse([nominatimItem('梅田', '34.7', '135.5')]);
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('梅田');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('梅田');
  });

  it('IT-05: タイムアウト(GSI 8秒超) → GeocodeError(kind=timeout)', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const promise = searchAddress('遅い場所');
    const assertion = expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof GeocodeError && e.kind === 'timeout',
    );
    await vi.advanceTimersByTimeAsync(8100);
    await assertion;
  });

  it('IT-06: 候補5件超(GSI 8件) → 5件に切り詰め', async () => {
    stubFetch(async (url) => {
      if (url.includes('msearch.gsi.go.jp')) {
        // 重複統合で消えないよう、それぞれ十分に離れた地点にする
        return jsonResponse(
          Array.from({ length: 8 }, (_, i) =>
            gsiFeature(`候補${i}`, 139.7, 35 + i),
          ),
        );
      }
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected: ${url}`);
    });
    const r = await searchAddress('候補');
    expect(r).toHaveLength(5);
  });
});

describe('route 結合(fetchモック)', () => {
  it('IT-07: fetchRoute正常 → RouteResult返却', async () => {
    const mock = stubFetch(async (url) => {
      expect(url).toContain('router.project-osrm.org/route/v1/driving/');
      expect(url).toContain('139.767,35.681;139.622,35.466');
      return jsonResponse({
        code: 'Ok',
        routes: [
          {
            distance: 30000,
            duration: 1800,
            geometry: {
              type: 'LineString',
              coordinates: [
                [139.767, 35.681],
                [139.622, 35.466],
              ],
            },
          },
        ],
      });
    });
    const r = await fetchRoute(pins2);
    expect(r.distanceKm).toBe(30);
    expect(r.durationMin).toBe(30);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('IT-08: fetchRoute異常(500) → RouteError throw', async () => {
    stubFetch(async () => jsonResponse({ message: 'error' }, 500));
    await expect(fetchRoute(pins2)).rejects.toBeInstanceOf(RouteError);
  });

  it('IT-09: Abort → 例外がAbort系として処理される', async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const controller = new AbortController();
    const promise = fetchRoute(pins2, { signal: controller.signal });
    const assertion = expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
    );
    controller.abort();
    await assertion;
  });
});
