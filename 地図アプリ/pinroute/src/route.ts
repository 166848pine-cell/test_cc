import type { Pin } from './types';

/** ピンとピンの間の1区間。 */
export interface RouteLeg {
  distanceKm: number;
  durationMin: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** 出発から到着までの各区間。pins.length - 1 個。 */
  legs: RouteLeg[];
  geometry: GeoJSON.LineString;
}

export class RouteError extends Error {
  constructor(message?: string) {
    super(message ?? 'route error');
    this.name = 'RouteError';
  }
}

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

/** OSRMレスポンスのパーサ(純粋関数)。code!=='Ok'や不正形状はnull。 */
export function parseOsrmResponse(json: unknown): RouteResult | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.code !== 'Ok') return null;
  if (!Array.isArray(o.routes) || o.routes.length === 0) return null;
  const route = o.routes[0] as Record<string, unknown>;
  const distance = route.distance;
  const duration = route.duration;
  const geometry = route.geometry as Record<string, unknown> | undefined;
  if (typeof distance !== 'number' || !Number.isFinite(distance)) return null;
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return null;
  if (
    typeof geometry !== 'object' ||
    geometry === null ||
    geometry.type !== 'LineString' ||
    !Array.isArray(geometry.coordinates)
  ) {
    return null;
  }
  const legs: RouteLeg[] = Array.isArray(route.legs)
    ? route.legs.flatMap((l): RouteLeg[] => {
        if (typeof l !== 'object' || l === null) return [];
        const leg = l as Record<string, unknown>;
        const d = leg.distance;
        const t = leg.duration;
        if (typeof d !== 'number' || !Number.isFinite(d)) return [];
        if (typeof t !== 'number' || !Number.isFinite(t)) return [];
        return [
          {
            distanceKm: Math.round(d / 100) / 10,
            durationMin: Math.round(t / 60),
          },
        ];
      })
    : [];

  return {
    distanceKm: Math.round(distance / 100) / 10, // 小数1桁
    durationMin: Math.round(duration / 60),
    legs,
    geometry: geometry as unknown as GeoJSON.LineString,
  };
}

/** pins.length < 2 は呼び出し禁止(呼び出し側でガード)。失敗はRouteErrorをthrow。 */
export async function fetchRoute(
  pins: Pin[],
  opts?: { signal?: AbortSignal },
): Promise<RouteResult> {
  const coords = pins.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson`;
  let json: unknown;
  try {
    const res = await fetch(url, { signal: opts?.signal });
    if (!res.ok) throw new RouteError(`HTTP ${res.status}`);
    json = (await res.json()) as unknown;
  } catch (e) {
    if (opts?.signal?.aborted) throw e; // Abortはそのまま伝播
    if (e instanceof RouteError) throw e;
    throw new RouteError('network');
  }
  const result = parseOsrmResponse(json);
  if (result === null) throw new RouteError('bad response');
  return result;
}

/** Googleマップ経路URLを組み立てる(純粋関数)。 */
export function buildGoogleMapsUrl(pins: Pin[]): string {
  const parts = pins.map((p) => `${p.lat},${p.lng}`).join('/');
  return `https://www.google.com/maps/dir/${parts}`;
}
