import L from 'leaflet';
import type { LabelOffset, Pin } from './types';
import { resolveAppearance, type MarkerStyle } from './appearance';

/**
 * 地図上の情報ブロック(引き出し線つきの吹き出し)を描くレイヤ。
 *
 * 不動産の査定資料のように、地点のプロットから線を伸ばして
 * 物件名・住所・駅徒歩などをまとめて見せるための表示。
 * ブロックはドラッグで好きな位置に動かせる。位置はピンからの
 * 画面上のピクセル差として持つので、地図を動かしても関係が崩れない。
 */

export interface CalloutHandlers {
  /**
   * ブロックを動かし終えた。
   * others には、そのとき自動配置だった他のブロックの現在位置を渡す。
   * これを一緒に確定させることで、1つ動かしたときに他が動かないようにする。
   */
  onMoveLabel(
    id: string,
    offset: LabelOffset,
    others: { id: string; offset: LabelOffset }[],
  ): void;
  /** ブロックの × を押した。 */
  onHideLabel(id: string): void;
  /** ブロックを選んだ(一覧側を強調する)。 */
  onHoverLabel(id: string | null): void;
}

export interface CalloutLayer {
  render(
    pins: Pin[],
    fieldOrder: string[],
    visible: boolean,
    globalStyle?: MarkerStyle,
  ): void;
  /** 地図の移動・ズームに合わせて置き直す。 */
  reposition(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 自動配置の余白と間隔(ピクセル)。 */
const EDGE_MARGIN = 10;
const STACK_GAP = 8;
/** 左上のズームボタンが占める範囲。重なるときは左列を右へずらして避ける。 */
const ZOOM_CONTROL = { width: 48, height: 78 };
const FALLBACK_BOX = { width: 212, height: 130 };

/** ピンのそばに置くときの候補位置(ピンからのピクセル差)。 */
const NEAR_SLOTS: LabelOffset[] = [
  // 縦位置をブロックの高さの半分ほど上にずらすと、引き出し線が横一直線に出て読みやすい
  { x: 96, y: -66 },
  { x: -308, y: -66 },
  { x: 96, y: 66 },
  { x: -308, y: 66 },
  { x: 96, y: -186 },
  { x: -308, y: -186 },
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

export function createCalloutLayer(
  map: L.Map,
  handlers: CalloutHandlers,
): CalloutLayer {
  const container = map.getContainer();

  const overlay = document.createElement('div');
  overlay.className = 'callout-layer';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'callout-lines');
  overlay.appendChild(svg);
  container.appendChild(overlay);

  let currentPins: Pin[] = [];
  let visibleNow = true;
  let currentGlobalStyle: MarkerStyle | undefined;
  const boxes = new Map<string, HTMLDivElement>();
  const lines = new Map<
    string,
    { casing: SVGPathElement; line: SVGPathElement }
  >();
  /** ドラッグ中だけ使う一時的なオフセット。 */
  const dragging = new Map<string, LabelOffset>();
  /** 自分で動かしていないブロックの自動配置。 */
  const autoOffsets = new Map<string, LabelOffset>();

  const offsetOf = (pin: Pin): LabelOffset =>
    dragging.get(pin.id) ??
    pin.labelOffset ??
    autoOffsets.get(pin.id) ?? { x: 96, y: -66 };

  /**
   * まだ動かされていないブロックを、地図の左右の端に振り分けて縦に積む。
   *
   * 駅の徒歩圏に物件が集まると、ピンのすぐ横に置く方式ではブロック同士が重なって読めない。
   * 査定資料のように外周へ並べ、引き出し線でピンと結ぶほうが一覧しやすい。
   * ここで決めるのはあくまで初期位置で、ドラッグすればその位置が優先される。
   */
  const computeAutoLayout = (pins: Pin[]): void => {
    autoOffsets.clear();
    const targets = pins.filter(
      (p) => p.labelHidden !== true && p.labelOffset === undefined,
    );
    if (targets.length === 0) return;

    const size = map.getSize();
    const points = new Map<string, L.Point>();
    for (const pin of targets) {
      points.set(pin.id, map.latLngToContainerPoint([pin.lat, pin.lng]));
    }

    const boxSize = (pin: Pin): { width: number; height: number } => {
      const box = boxes.get(pin.id);
      return {
        width: box?.offsetWidth ?? FALLBACK_BOX.width,
        height: box?.offsetHeight ?? FALLBACK_BOX.height,
      };
    };

    // まずはピンのそばに置いてみて、重ならず画面にも収まるならそれを使う
    const nearby = new Map<string, LabelOffset>();
    const placed: Rect[] = [];
    let nearbyWorks = true;
    for (const [i, pin] of targets.entries()) {
      const pt = points.get(pin.id);
      if (pt === undefined) continue;
      const slot = NEAR_SLOTS[i % NEAR_SLOTS.length];
      const { width, height } = boxSize(pin);
      const rect: Rect = {
        x: pt.x + slot.x,
        y: pt.y + slot.y,
        w: width,
        h: height,
      };
      const insideView =
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.w <= size.x &&
        rect.y + rect.h <= size.y;
      if (!insideView || placed.some((r) => overlaps(r, rect))) {
        nearbyWorks = false;
        break;
      }
      placed.push(rect);
      nearby.set(pin.id, slot);
    }
    if (nearbyWorks) {
      for (const [id, offset] of nearby) autoOffsets.set(id, offset);
      return;
    }

    // 左右の数がそろうよう、X座標の中央値で分ける
    const xs = [...points.values()].map((pt) => pt.x).sort((a, b) => a - b);
    const medianX = xs[Math.floor(xs.length / 2)];
    const left: Pin[] = [];
    const right: Pin[] = [];
    for (const pin of targets) {
      const pt = points.get(pin.id);
      if (pt === undefined) continue;
      (pt.x < medianX ? left : right).push(pin);
    }

    const stack = (list: Pin[], side: 'left' | 'right'): void => {
      if (list.length === 0) return;
      list.sort(
        (a, b) => (points.get(a.id)?.y ?? 0) - (points.get(b.id)?.y ?? 0),
      );
      const sizes = list.map(boxSize);
      const boxesHeight = sizes.reduce((sum, s) => sum + s.height, 0);
      const totalHeight = boxesHeight + STACK_GAP * (list.length - 1);
      const available = size.y - EDGE_MARGIN * 2;
      // 収まらないときは重なりを許してでも画面内に納める
      const gap =
        totalHeight > available && list.length > 1
          ? (available - boxesHeight) / (list.length - 1)
          : STACK_GAP;
      let y = Math.max(EDGE_MARGIN, (size.y - totalHeight) / 2);

      // 先頭がズームボタンの高さにかかる場合だけ、左列を横にずらして避ける
      const leftX =
        side === 'left' && y < ZOOM_CONTROL.height
          ? EDGE_MARGIN + ZOOM_CONTROL.width
          : EDGE_MARGIN;

      list.forEach((pin, i) => {
        const pt = points.get(pin.id);
        if (pt === undefined) return;
        const x =
          side === 'left' ? leftX : size.x - sizes[i].width - EDGE_MARGIN;
        autoOffsets.set(pin.id, {
          x: Math.round(x - pt.x),
          y: Math.round(y - pt.y),
        });
        y += sizes[i].height + gap;
      });
    };

    stack(left, 'left');
    stack(right, 'right');
  };

  /** ピンからブロックの一番近い縁へ線を引く。 */
  const drawLine = (
    paths: { casing: SVGPathElement; line: SVGPathElement },
    from: L.Point,
    box: { left: number; top: number; width: number; height: number },
  ): void => {
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    const inside =
      from.x >= box.left &&
      from.x <= right &&
      from.y >= box.top &&
      from.y <= bottom;
    const d = inside
      ? ''
      : `M ${from.x} ${from.y} L ${Math.min(Math.max(from.x, box.left), right)} ${Math.min(
          Math.max(from.y, box.top),
          bottom,
        )}`;
    paths.casing.setAttribute('d', d);
    paths.line.setAttribute('d', d);
  };

  const reposition = (): void => {
    if (!visibleNow) return;
    const size = map.getSize();
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    svg.setAttribute('width', String(size.x));
    svg.setAttribute('height', String(size.y));

    currentPins.forEach((pin) => {
      const box = boxes.get(pin.id);
      const path = lines.get(pin.id);
      if (box === undefined || path === undefined) return;
      const point = map.latLngToContainerPoint([pin.lat, pin.lng]);
      const offset = offsetOf(pin);
      const left = point.x + offset.x;
      const top = point.y + offset.y;
      box.style.transform = `translate(${left}px, ${top}px)`;
      drawLine(path, point, {
        left,
        top,
        width: box.offsetWidth,
        height: box.offsetHeight,
      });
    });
  };

  /**
   * 自動配置を計算し直して置き直す。
   * 地図が動いている最中はピンと一緒に動かし、動きが止まってから並べ直す。
   * ドラッグで位置を決めたブロックは対象外なので、その位置は保たれる。
   */
  const relayout = (): void => {
    if (!visibleNow) return;
    computeAutoLayout(currentPins);
    reposition();
  };

  map.on('move zoom viewreset', reposition);
  map.on('moveend zoomend resize', relayout);

  /** ブロックのドラッグを設定する。 */
  const makeDraggable = (box: HTMLDivElement, pin: Pin): void => {
    const grip = box.querySelector<HTMLElement>('.callout-head');
    if (grip === null) return;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();
      const start = offsetOf(pin);
      const startX = e.clientX;
      const startY = e.clientY;
      grip.setPointerCapture(e.pointerId);
      box.classList.add('is-dragging');

      const move = (ev: PointerEvent): void => {
        dragging.set(pin.id, {
          x: Math.round(start.x + (ev.clientX - startX)),
          y: Math.round(start.y + (ev.clientY - startY)),
        });
        reposition();
      };
      const end = (): void => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        box.classList.remove('is-dragging');
        const moved = dragging.get(pin.id);
        dragging.delete(pin.id);
        if (moved === undefined) return;
        // 自動配置のままだった他のブロックは、今の位置で固定して動かないようにする
        const others = [...autoOffsets.entries()]
          .filter(([id]) => id !== pin.id)
          .map(([id, offset]) => ({ id, offset }));
        handlers.onMoveLabel(pin.id, moved, others);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
  };

  const buildBox = (
    pin: Pin,
    index: number,
    fieldOrder: string[],
  ): HTMLDivElement => {
    const look = resolveAppearance(pin.style, currentGlobalStyle);
    const box = document.createElement('div');
    box.className = 'callout';
    box.dataset.id = pin.id;
    box.style.setProperty('--callout-color', look.color);
    box.style.setProperty('--callout-scale', String(look.scale));
    // 地図のドラッグやズームに吸われないようにする
    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);
    box.addEventListener('pointerenter', () => handlers.onHoverLabel(pin.id));
    box.addEventListener('pointerleave', () => handlers.onHoverLabel(null));

    const head = document.createElement('div');
    head.className = 'callout-head';
    head.title = 'ドラッグして移動できます';

    const num = document.createElement('span');
    num.className = 'callout-num';
    num.textContent = String(index + 1);

    const title = document.createElement('span');
    title.className = 'callout-title';
    title.textContent = pin.name;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'callout-close';
    close.textContent = '×';
    close.setAttribute('aria-label', `「${pin.name}」の情報ブロックを隠す`);
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onHideLabel(pin.id);
    });
    close.addEventListener('pointerdown', (e) => e.stopPropagation());

    head.append(num, title, close);
    box.appendChild(head);

    const body = document.createElement('dl');
    body.className = 'callout-body';
    let shown = 0;
    for (const key of fieldOrder) {
      const value = pin.fields?.[key];
      if (value === undefined || value === '') continue;
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      body.append(dt, dd);
      shown++;
    }
    if (shown === 0) {
      const dd = document.createElement('dd');
      dd.className = 'callout-empty';
      dd.textContent = pin.context ?? pin.query;
      body.appendChild(dd);
    }
    box.appendChild(body);

    makeDraggable(box, pin);
    return box;
  };

  return {
    render(
      pins: Pin[],
      fieldOrder: string[],
      visible: boolean,
      globalStyle?: MarkerStyle,
    ): void {
      currentPins = pins;
      visibleNow = visible;
      currentGlobalStyle = globalStyle;
      overlay.hidden = !visible;
      boxes.forEach((b) => b.remove());
      boxes.clear();
      lines.forEach((l) => {
        l.casing.remove();
        l.line.remove();
      });
      lines.clear();
      if (!visible) return;

      pins.forEach((pin, index) => {
        if (pin.labelHidden === true) return;
        // 白い縁取りを下に敷くと、地図の色に関わらず線が読み取れる
        const casing = document.createElementNS(SVG_NS, 'path');
        casing.setAttribute('class', 'callout-line-casing');
        const line = document.createElementNS(SVG_NS, 'path');
        line.setAttribute('class', 'callout-line');
        line.setAttribute(
          'stroke',
          resolveAppearance(pin.style, globalStyle).color,
        );
        svg.append(casing, line);
        lines.set(pin.id, { casing, line });

        const box = buildBox(pin, index, fieldOrder);
        overlay.appendChild(box);
        boxes.set(pin.id, box);
      });
      // 大きさが確定してから自動配置を計算する
      relayout();
    },

    reposition,
  };
}
