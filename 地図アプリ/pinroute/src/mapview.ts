import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pin } from './types';
import type { RouteResult } from './route';
import { escapeHtml } from './ui';
import { createCalloutLayer, type CalloutHandlers } from './callout';
import { resolveAppearance, type MarkerStyle } from './appearance';

export interface MapView {
  renderPins(pins: Pin[], globalStyle?: MarkerStyle): void;
  renderRoute(r: RouteResult | null): void;
  fitToPins(pins: Pin[]): void;
  /** 指定ピンを画面中央に寄せてポップアップを開く。 */
  focusPin(pin: Pin): void;
  /** 一覧のホバーに合わせてマーカーを強調する。null で解除。 */
  highlight(id: string | null): void;
  /** 情報ブロックを描き直す。 */
  renderCallouts(
    pins: Pin[],
    fieldOrder: string[],
    visible: boolean,
    globalStyle?: MarkerStyle,
  ): void;
}

const ROUTE_CASING = '#ffffff';

/** 標準サイズのマーカーの寸法。倍率をかけて使う。 */
const MARKER_BASE = { box: 30, height: 36, dot: 28, anchorY: 34 };

/** 番号入りのしずく型マーカー。地図上のどの座標を指しているかが一目で分かる形にする。 */
function pinIcon(
  n: number,
  highlighted: boolean,
  pin: Pin,
  globalStyle: MarkerStyle | undefined,
): L.DivIcon {
  const look = resolveAppearance(pin.style, globalStyle);
  const w = Math.round(MARKER_BASE.box * look.scale);
  const h = Math.round(MARKER_BASE.height * look.scale);
  const anchorY = Math.round(MARKER_BASE.anchorY * look.scale);
  return L.divIcon({
    className: `pin-marker-wrap${highlighted ? ' is-highlighted' : ''}`,
    html:
      `<span class="pin-marker" style="--marker-color:${look.color};` +
      `--marker-strong:${look.strong};--marker-scale:${look.scale}">` +
      `<span class="pin-marker-num">${n}</span></span>`,
    iconSize: [w, h],
    iconAnchor: [Math.round(w / 2), anchorY],
    popupAnchor: [0, -anchorY + 2],
  });
}

export function createMapView(
  el: HTMLElement,
  calloutHandlers: CalloutHandlers,
): MapView {
  const map = L.map(el, {
    zoomControl: true,
    // 日本全体が見える初期表示。ピンが立てば fitToPins で寄る。
  }).setView([35.681236, 139.767125], 11);

  // 地理院タイル(淡色地図)。出典の記載のみで利用でき、レート制限の定めも公表されていない。
  // ピンや情報ブロックを重ねる下地として、色の薄い淡色地図を使う。
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
    minZoom: 4,
    // 配信は18まで。それより寄るときは18のタイルを引き伸ばす
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> | 地点検索: 国土地理院・Nominatim',
  }).addTo(map);

  L.control.scale({ imperial: false }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markers = new Map<string, L.Marker>();
  let routeCasing: L.Polyline | null = null;
  let routeLine: L.Polyline | null = null;
  let lastRoute: RouteResult | null = null;
  let currentPins: Pin[] = [];
  let highlightedId: string | null = null;

  // パネルとの分割比が変わる(画面回転・リサイズ)と地図が欠けるため、都度再計測する。
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => map.invalidateSize()).observe(el);
  }

  const callouts = createCalloutLayer(map, calloutHandlers);

  let currentGlobalStyle: MarkerStyle | undefined;

  const applyIcon = (pin: Pin, index: number): void => {
    const marker = markers.get(pin.id);
    marker?.setIcon(
      pinIcon(index + 1, pin.id === highlightedId, pin, currentGlobalStyle),
    );
  };

  return {
    renderPins(pins: Pin[], globalStyle?: MarkerStyle): void {
      const colorChanged =
        resolveAppearance(undefined, currentGlobalStyle).color !==
        resolveAppearance(undefined, globalStyle).color;
      currentPins = pins;
      currentGlobalStyle = globalStyle;
      // 色が変わったらルート線も引き直す
      if (colorChanged && lastRoute !== null) this.renderRoute(lastRoute);
      markerLayer.clearLayers();
      markers.clear();
      pins.forEach((pin, i) => {
        const marker = L.marker([pin.lat, pin.lng], {
          icon: pinIcon(i + 1, pin.id === highlightedId, pin, globalStyle),
          title: pin.name,
          keyboard: false,
        });
        const context =
          pin.context === undefined || pin.context === ''
            ? ''
            : `<span class="popup-context">${escapeHtml(pin.context)}</span>`;
        marker.bindPopup(
          `<strong class="popup-name">${escapeHtml(pin.name)}</strong>${context}` +
            `<span class="popup-query">検索語: ${escapeHtml(pin.query)}</span>`,
        );
        markers.set(pin.id, marker);
        markerLayer.addLayer(marker);
      });
    },

    renderRoute(r: RouteResult | null): void {
      lastRoute = r;
      routeCasing?.remove();
      routeLine?.remove();
      routeCasing = null;
      routeLine = null;
      if (r === null) return;
      const latlngs = r.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      // 白い縁取りを下に敷くと、地図の色に関わらず経路が読み取れる。
      routeCasing = L.polyline(latlngs, {
        color: ROUTE_CASING,
        weight: 9,
        opacity: 0.9,
        lineJoin: 'round',
        className: 'route-casing',
      }).addTo(map);
      routeLine = L.polyline(latlngs, {
        // ルート線も全体の色に合わせて、地図全体の見た目をそろえる
        color: resolveAppearance(undefined, currentGlobalStyle).color,
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        className: 'route-line',
      }).addTo(map);
      routeCasing.bringToBack();
    },

    fitToPins(pins: Pin[]): void {
      if (pins.length === 0) return;
      if (pins.length === 1) {
        map.setView([pins[0].lat, pins[0].lng], 15);
        return;
      }
      map.fitBounds(
        L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40] },
      );
    },

    focusPin(pin: Pin): void {
      const marker = markers.get(pin.id);
      if (marker === undefined) return;
      map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    },

    renderCallouts(
      pins: Pin[],
      fieldOrder: string[],
      visible: boolean,
      globalStyle?: MarkerStyle,
    ): void {
      callouts.render(pins, fieldOrder, visible, globalStyle);
    },

    highlight(id: string | null): void {
      if (highlightedId === id) return;
      const previous = highlightedId;
      highlightedId = id;
      currentPins.forEach((pin, i) => {
        if (pin.id === previous || pin.id === id) applyIcon(pin, i);
      });
    },
  };
}
