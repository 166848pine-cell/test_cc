import type { GeoCandidate } from './geocode';
import type { RouteLeg } from './route';
import type { Pin } from './types';
import { MAX_PINS } from './state';
import { ROUTING_ENABLED } from './config';
import {
  PALETTE,
  SIZES,
  resolveAppearance,
  type MarkerStyle,
} from './appearance';
import {
  parseTable,
  guessAddressColumn,
  guessNameColumn,
  buildEntries,
  type BulkEntry,
  type ParsedTable,
} from './bulk';

/** NFR-12: HTML文字列に埋め込む際は必ずこれを通す。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type MessageKind = 'error' | 'info';

export interface UiHandlers {
  onSearch(query: string): void;
  onSelectCandidate(c: GeoCandidate): void;
  onRename(id: string, name: string): void;
  onMove(id: string, dir: -1 | 1): void;
  onReorder(fromIdx: number, toIdx: number): void;
  onDelete(id: string): void;
  onClear(): void;
  onShare(): void;
  /** 一覧の行が選ばれた(地図をその地点へ寄せる)。 */
  onFocus(id: string): void;
  /** 一覧の行にポインタが乗った/外れた(マーカー強調)。 */
  onHover(id: string | null): void;
  /** まとめて入力の「取り込む」を押した。 */
  onBulkImport(entries: BulkEntry[]): void;
  /** まとめて入力の「中止」を押した。 */
  onBulkCancel(): void;
  /** 情報ブロックの項目を前後に動かす。 */
  onMoveField(field: string, dir: -1 | 1): void;
  /** 情報ブロックの項目の表示・非表示を切り替える。 */
  onToggleField(field: string): void;
  /** 情報ブロック全体の表示を切り替える。 */
  onToggleLabels(visible: boolean): void;
  /** 車ルートの表示を切り替える。 */
  onToggleRoute(visible: boolean): void;
  /** 情報ブロックの項目をすべて表示 / すべて非表示にする。 */
  onSetAllFields(visible: boolean): void;
  /** 全体の見た目を変える。 */
  onGlobalStyle(style: MarkerStyle): void;
  /** 個別の見た目をすべて解除する。 */
  onClearAllPinStyles(): void;
  /** 地点1つの見た目を変える。 */
  onPinStyle(id: string, style: MarkerStyle): void;
  /** 地点1つの見た目を全体設定に戻す。 */
  onClearPinStyle(id: string): void;
  /** 情報ブロックの配置を初期化する。 */
  onResetLabels(): void;
}

export interface RouteBarInfo {
  distanceKm: number;
  durationMin: number;
  gmapUrl: string;
}

export interface Ui {
  renderList(pins: Pin[], globalStyle?: MarkerStyle): void;
  renderCandidates(candidates: GeoCandidate[]): void;
  hideCandidates(): void;
  showMessage(text: string, kind?: MessageKind): void;
  clearMessage(): void;
  setRouteBar(info: RouteBarInfo | null): void;
  /** ルート計算中であることを示す。 */
  setRouteLoading(loading: boolean): void;
  /** 区間ごとの距離・所要時間を一覧に差し込む。null で消す。 */
  setLegs(legs: RouteLeg[] | null): void;
  setSearching(searching: boolean): void;
  showShareFallback(url: string): void;
  hideShareFallback(): void;
  showToast(text: string): void;
  getQuery(): string;
  clearQuery(): void;
  /** 情報ブロックの設定欄を描き直す。 */
  renderFieldSettings(
    order: string[],
    hidden: string[],
    labelsVisible: boolean,
  ): void;
  /** まとめて入力の進み具合を示す。 */
  setBulkProgress(text: string, running: boolean): void;
  /** まとめて入力で取り込めなかった行を示す。 */
  setBulkFailed(items: { label: string; reason: string }[]): void;
  /** まとめて入力の入力欄を空にする。 */
  clearBulkInput(): void;
  /**
   * ルート表示の切り替えとGoogleマップリンクを今の状態に合わせる。
   * リンクはルート線を出しているかに関わらず、2件以上あれば使える。
   */
  renderRouteControl(
    pinCount: number,
    routeVisible: boolean,
    gmapUrl: string,
  ): void;
  /** 見た目の設定欄を今の状態に合わせる。 */
  renderAppearance(
    pinCount: number,
    globalStyle: MarkerStyle | undefined,
  ): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing element #${id}`);
  return el as T;
}

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  return svg;
}

const ICON_UP = 'M12 8l6 6H6z';
const ICON_DOWN = 'M12 16l-6-6h12z';
const ICON_CLOSE =
  'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4L10.6 10.6l6.3-6.3z';
const ICON_GRIP =
  'M9 4h2v2H9V4zm4 0h2v2h-2V4zM9 9h2v2H9V9zm4 0h2v2h-2V9zm-4 5h2v2H9v-2zm4 0h2v2h-2v-2zm-4 5h2v2H9v-2zm4 0h2v2h-2v-2z';
const ICON_ARROW_DOWN = 'M12 4v12.2l5.6-5.6L19 12l-7 7-7-7 1.4-1.4L12 16.2V4z';

export function createUi(handlers: UiHandlers): Ui {
  const addrInput = byId<HTMLInputElement>('addr-input');
  const clearInputBtn = byId<HTMLButtonElement>('clear-input-btn');
  const addBtn = byId<HTMLButtonElement>('add-btn');
  const addBtnLabel = addBtn.querySelector('.add-btn-label') as HTMLSpanElement;
  const candidatesEl = byId<HTMLUListElement>('candidates');
  const pinListEl = byId<HTMLOListElement>('pin-list');
  const pinCountEl = byId<HTMLSpanElement>('pin-count');
  const emptyStateEl = byId<HTMLDivElement>('empty-state');
  const routeBar = byId<HTMLDivElement>('route-bar');
  const routeSummary = byId<HTMLSpanElement>('route-summary');
  const routeDistance = byId<HTMLSpanElement>('route-distance');
  const routeDuration = byId<HTMLSpanElement>('route-duration');
  const routeStatus = byId<HTMLSpanElement>('route-status');
  const gmapLink = byId<HTMLAnchorElement>('gmap-link');
  const msgArea = byId<HTMLDivElement>('msg-area');
  const clearBtn = byId<HTMLButtonElement>('clear-btn');
  const shareBtn = byId<HTMLButtonElement>('share-btn');
  const shareFallback = byId<HTMLDivElement>('share-fallback');
  const toast = byId<HTMLDivElement>('toast');
  const bulkInput = byId<HTMLTextAreaElement>('bulk-input');
  const bulkHeader = byId<HTMLInputElement>('bulk-header');
  const bulkAddress = byId<HTMLSelectElement>('bulk-address');
  const bulkName = byId<HTMLSelectElement>('bulk-name');
  const bulkPreview = byId<HTMLDivElement>('bulk-preview');
  const bulkRun = byId<HTMLButtonElement>('bulk-run');
  const bulkCancel = byId<HTMLButtonElement>('bulk-cancel');
  const bulkProgress = byId<HTMLDivElement>('bulk-progress');
  const bulkFailed = byId<HTMLUListElement>('bulk-failed');
  const labelPanel = byId<HTMLDetailsElement>('label-panel');
  const labelsVisibleInput = byId<HTMLInputElement>('labels-visible');
  const fieldOrderList = byId<HTMLUListElement>('field-order');
  const labelsReset = byId<HTMLButtonElement>('labels-reset');
  const routeControl = byId<HTMLDivElement>('route-control');
  const routeVisibleInput = byId<HTMLInputElement>('route-visible');
  const fieldsAll = byId<HTMLButtonElement>('fields-all');
  const fieldsNone = byId<HTMLButtonElement>('fields-none');
  const appearancePanel = byId<HTMLDetailsElement>('appearance-panel');
  const globalColors = byId<HTMLDivElement>('global-colors');
  const globalSizes = byId<HTMLDivElement>('global-sizes');
  const styleResetAll = byId<HTMLButtonElement>('style-reset-all');

  let dragFromIdx: number | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let candidateList: GeoCandidate[] = [];
  let activeCandidate = -1;
  let currentPins: Pin[] = [];
  let currentGlobalStyle: MarkerStyle | undefined;
  /** 見た目の設定を開いている行のピンID。 */
  let styleOpenId: string | null = null;
  let currentLegs: RouteLeg[] | null = null;
  let currentTable: ParsedTable | null = null;
  /** ドラッグ中に来た再描画を、終わってからまとめて反映するための控え。 */
  let deferredLegPaint = false;

  const doSearch = (): void => {
    const q = addrInput.value.trim();
    if (q === '') {
      addrInput.focus();
      return;
    }
    handlers.onSearch(q);
  };

  addBtn.addEventListener('click', doSearch);
  clearInputBtn.addEventListener('click', () => {
    addrInput.value = '';
    clearInputBtn.hidden = true;
    ui.hideCandidates();
    addrInput.focus();
  });
  addrInput.addEventListener('input', () => {
    clearInputBtn.hidden = addrInput.value === '';
  });
  clearBtn.addEventListener('click', () => handlers.onClear());
  shareBtn.addEventListener('click', () => handlers.onShare());

  /** 候補リストの選択位置を移動する。 */
  const moveActive = (delta: number): void => {
    if (candidateList.length === 0) return;
    const next = activeCandidate + delta;
    activeCandidate =
      next < 0 ? candidateList.length - 1 : next % candidateList.length;
    const buttons =
      candidatesEl.querySelectorAll<HTMLButtonElement>('.candidate button');
    buttons.forEach((b, i) => {
      const active = i === activeCandidate;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
      if (active) b.scrollIntoView({ block: 'nearest' });
    });
  };

  addrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (
        activeCandidate >= 0 &&
        candidateList[activeCandidate] !== undefined
      ) {
        handlers.onSelectCandidate(candidateList[activeCandidate]);
        return;
      }
      doSearch();
      return;
    }
    if (candidateList.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    }
  });

  /** 色の選択ボタンを並べる。 */
  const buildSwatches = (
    selected: string,
    onPick: (key: string) => void,
    extraClass = '',
  ): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.className = `swatches ${extraClass}`.trim();
    for (const entry of PALETTE) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `swatch${entry.key === selected ? ' is-active' : ''}`;
      btn.style.background = entry.color;
      btn.title = entry.label;
      btn.setAttribute('aria-label', entry.label);
      btn.setAttribute('aria-pressed', String(entry.key === selected));
      btn.addEventListener('click', () => onPick(entry.key));
      wrap.appendChild(btn);
    }
    return wrap;
  };

  /** 大きさの選択ボタンを並べる。 */
  const buildSizeButtons = (
    selected: string,
    onPick: (key: string) => void,
  ): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.className = 'size-buttons';
    for (const entry of SIZES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = entry.key === selected ? 'is-active' : '';
      btn.textContent = entry.label;
      btn.setAttribute('aria-pressed', String(entry.key === selected));
      btn.addEventListener('click', () => onPick(entry.key));
      wrap.appendChild(btn);
    }
    return wrap;
  };

  /** その地点だけの見た目を決める欄。 */
  const buildPinStylePanel = (pin: Pin): HTMLLIElement => {
    const look = resolveAppearance(pin.style, currentGlobalStyle);
    const li = document.createElement('li');
    li.className = 'pin-style-panel';

    const colorRow = document.createElement('div');
    colorRow.className = 'setting-row';
    const colorLabel = document.createElement('span');
    colorLabel.textContent = `「${pin.name}」の色`;
    colorRow.append(
      colorLabel,
      buildSwatches(look.colorKey, (color) =>
        handlers.onPinStyle(pin.id, { color }),
      ),
    );

    const sizeRow = document.createElement('div');
    sizeRow.className = 'setting-row';
    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = '大きさ';
    sizeRow.append(
      sizeLabel,
      buildSizeButtons(look.sizeKey, (size) =>
        handlers.onPinStyle(pin.id, { size }),
      ),
    );

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '全体の設定に戻す';
    reset.disabled = pin.style === undefined;
    reset.addEventListener('click', () => handlers.onClearPinStyle(pin.id));

    li.append(colorRow, sizeRow, reset);
    return li;
  };

  /** ピン1件分の行を組み立てる。 */
  const buildPinRow = (pin: Pin, idx: number, total: number): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'pin-row';
    li.draggable = true;
    li.dataset.id = pin.id;
    li.dataset.idx = String(idx);

    li.addEventListener('dragstart', (e) => {
      dragFromIdx = idx;
      e.dataTransfer?.setData('text/plain', String(idx));
      if (e.dataTransfer !== null) e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      dragFromIdx = null;
      li.classList.remove('dragging');
      pinListEl
        .querySelectorAll('.drop-target')
        .forEach((el) => el.classList.remove('drop-target'));
      if (deferredLegPaint) {
        deferredLegPaint = false;
        paintLegs();
      }
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragFromIdx !== idx) li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drop-target');
      const from = dragFromIdx ?? Number(e.dataTransfer?.getData('text/plain'));
      if (Number.isInteger(from) && from !== idx) handlers.onReorder(from, idx);
    });
    li.addEventListener('pointerenter', () => handlers.onHover(pin.id));
    li.addEventListener('pointerleave', () => handlers.onHover(null));

    const grip = document.createElement('span');
    grip.className = 'pin-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.appendChild(icon(ICON_GRIP));

    const num = document.createElement('button');
    num.type = 'button';
    num.className = 'pin-num';
    num.textContent = String(idx + 1);
    num.setAttribute('aria-label', `${idx + 1}番目「${pin.name}」を地図で表示`);
    num.addEventListener('click', () => handlers.onFocus(pin.id));

    const body = document.createElement('div');
    body.className = 'pin-body';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'pin-name';
    nameInput.value = pin.name;
    nameInput.setAttribute('aria-label', `ピン${idx + 1}の名称`);
    // ドラッグ操作が文字選択と競合しないよう、入力欄にフォーカスがある間だけD&Dを止める
    nameInput.addEventListener('focus', () => {
      li.draggable = false;
    });
    nameInput.addEventListener('blur', () => {
      li.draggable = true;
    });
    nameInput.addEventListener('change', () =>
      handlers.onRename(pin.id, nameInput.value),
    );
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nameInput.blur();
      if (e.key === 'Escape') {
        nameInput.value = pin.name;
        nameInput.blur();
      }
    });

    const sub = document.createElement('span');
    sub.className = 'pin-sub';
    sub.textContent =
      pin.context !== undefined && pin.context !== '' ? pin.context : pin.query;
    sub.title = sub.textContent;

    body.append(nameInput, sub);

    const controls = document.createElement('div');
    controls.className = 'pin-controls';

    const look = resolveAppearance(pin.style, currentGlobalStyle);
    const styleBtn = document.createElement('button');
    styleBtn.type = 'button';
    styleBtn.className = `pin-style-btn${styleOpenId === pin.id ? ' is-active' : ''}`;
    styleBtn.style.background = look.color;
    styleBtn.setAttribute('aria-label', `「${pin.name}」の色と大きさ`);
    styleBtn.setAttribute('aria-expanded', String(styleOpenId === pin.id));
    styleBtn.title = '色と大きさ';
    styleBtn.addEventListener('click', () => {
      styleOpenId = styleOpenId === pin.id ? null : pin.id;
      paintList();
    });

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'move-up icon-btn';
    upBtn.appendChild(icon(ICON_UP));
    upBtn.setAttribute('aria-label', `「${pin.name}」を上へ移動`);
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => handlers.onMove(pin.id, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'move-down icon-btn';
    downBtn.appendChild(icon(ICON_DOWN));
    downBtn.setAttribute('aria-label', `「${pin.name}」を下へ移動`);
    downBtn.disabled = idx === total - 1;
    downBtn.addEventListener('click', () => handlers.onMove(pin.id, 1));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'pin-delete icon-btn';
    delBtn.appendChild(icon(ICON_CLOSE));
    delBtn.setAttribute('aria-label', `「${pin.name}」を削除`);
    delBtn.addEventListener('click', () => handlers.onDelete(pin.id));

    controls.append(styleBtn, upBtn, downBtn, delBtn);
    li.append(grip, num, body, controls);
    return li;
  };

  /** 区間の距離・所要時間をピンとピンの間に表示する。 */
  const buildLegRow = (leg: RouteLeg): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'leg-row';
    li.setAttribute('aria-hidden', 'true');
    li.appendChild(icon(ICON_ARROW_DOWN));
    const text = document.createElement('span');
    text.textContent = `${leg.distanceKm.toFixed(1)} km ・ ${leg.durationMin} 分`;
    li.appendChild(text);
    return li;
  };

  /**
   * 区間行だけを差し替える。
   * ルートは遅れて返ってくるため、ピン行のDOMごと作り直すと
   * 操作中のドラッグが中断されたり編集中の入力欄からフォーカスが外れたりする。
   */
  const paintLegs = (): void => {
    // 並び替えのドラッグ中に行を出し入れすると、つかんでいる位置がずれて操作が壊れる
    if (dragFromIdx !== null) {
      deferredLegPaint = true;
      return;
    }
    pinListEl.querySelectorAll('.leg-row').forEach((el) => el.remove());
    if (currentLegs === null) return;
    const rows = Array.from(pinListEl.querySelectorAll('.pin-row'));
    rows.forEach((row, idx) => {
      const leg = currentLegs?.[idx];
      if (leg !== undefined && idx < rows.length - 1)
        row.after(buildLegRow(leg));
    });
  };

  const paintList = (): void => {
    pinListEl.textContent = '';
    const total = currentPins.length;
    currentPins.forEach((pin, idx) => {
      pinListEl.appendChild(buildPinRow(pin, idx, total));
      if (styleOpenId === pin.id)
        pinListEl.appendChild(buildPinStylePanel(pin));
    });
    paintLegs();
    emptyStateEl.hidden = total > 0;
    pinCountEl.textContent = total === 0 ? '' : `${total} / ${MAX_PINS} 件`;
    pinCountEl.classList.toggle('is-full', total >= MAX_PINS);
  };

  const ui: Ui = {
    renderList(pins: Pin[], globalStyle?: MarkerStyle): void {
      currentPins = pins;
      currentGlobalStyle = globalStyle;
      if (styleOpenId !== null && !pins.some((p) => p.id === styleOpenId)) {
        styleOpenId = null;
      }
      // ピン構成が変わった時点で古い区間表示は無効。ルート再計算後に setLegs で入り直す。
      if (
        currentLegs !== null &&
        currentLegs.length !== Math.max(pins.length - 1, 0)
      ) {
        currentLegs = null;
      }
      paintList();
    },

    setLegs(legs: RouteLeg[] | null): void {
      currentLegs = legs;
      paintLegs();
    },

    renderCandidates(candidates: GeoCandidate[]): void {
      candidateList = candidates;
      activeCandidate = -1;
      candidatesEl.textContent = '';

      const header = document.createElement('li');
      header.className = 'candidates-header';
      const headerText = document.createElement('span');
      headerText.textContent = `候補が${candidates.length}件あります。選んでください`;
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'icon-btn';
      closeBtn.appendChild(icon(ICON_CLOSE));
      closeBtn.setAttribute('aria-label', '候補を閉じる');
      closeBtn.addEventListener('click', () => {
        ui.hideCandidates();
        addrInput.focus();
      });
      header.append(headerText, closeBtn);
      candidatesEl.appendChild(header);

      candidates.forEach((c) => {
        const li = document.createElement('li');
        li.className = 'candidate';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', 'false');

        const name = document.createElement('span');
        name.className = 'candidate-name';
        name.textContent = c.name;

        btn.appendChild(name);
        if (c.context !== undefined && c.context !== '') {
          const ctx = document.createElement('span');
          ctx.className = 'candidate-context';
          ctx.textContent = c.context;
          btn.appendChild(ctx);
        }
        btn.addEventListener('click', () => handlers.onSelectCandidate(c));
        li.appendChild(btn);
        candidatesEl.appendChild(li);
      });

      candidatesEl.hidden = false;
      addrInput.setAttribute('aria-expanded', 'true');
    },

    hideCandidates(): void {
      candidatesEl.hidden = true;
      candidatesEl.textContent = '';
      candidateList = [];
      activeCandidate = -1;
      addrInput.setAttribute('aria-expanded', 'false');
    },

    showMessage(text: string, kind: MessageKind = 'error'): void {
      msgArea.textContent = text;
      msgArea.dataset.kind = kind;
    },

    clearMessage(): void {
      msgArea.textContent = '';
      delete msgArea.dataset.kind;
    },

    setRouteBar(info: RouteBarInfo | null): void {
      if (info === null) {
        routeBar.hidden = true;
        routeSummary.textContent = '';
        return;
      }
      routeDistance.textContent = info.distanceKm.toFixed(1);
      routeDuration.textContent = String(info.durationMin);
      routeSummary.textContent = `車ルート 距離 ${info.distanceKm.toFixed(1)} km 所要 ${info.durationMin} 分`;
      routeBar.hidden = false;
    },

    setRouteLoading(loading: boolean): void {
      routeStatus.textContent = loading ? '計算中…' : '';
      routeBar.classList.toggle('is-loading', loading);
    },

    setSearching(searching: boolean): void {
      addBtn.disabled = searching;
      addBtn.classList.toggle('is-loading', searching);
      addBtnLabel.textContent = searching ? '検索中…' : '検索';
    },

    showShareFallback(url: string): void {
      shareFallback.textContent = '';
      const p = document.createElement('p');
      p.textContent =
        'コピーできませんでした。以下のURLを選択してコピーしてください。';
      const input = document.createElement('input');
      input.type = 'text';
      input.readOnly = true;
      input.value = url;
      input.addEventListener('focus', () => input.select());
      shareFallback.append(p, input);
      shareFallback.hidden = false;
      input.focus();
    },

    hideShareFallback(): void {
      shareFallback.hidden = true;
      shareFallback.textContent = '';
    },

    showToast(text: string): void {
      toast.textContent = text;
      toast.hidden = false;
      // 再表示のたびにアニメーションをやり直す
      toast.classList.remove('is-visible');
      void toast.offsetWidth;
      toast.classList.add('is-visible');
      if (toastTimer !== undefined) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.hidden = true;
      }, 2200);
    },

    getQuery(): string {
      return addrInput.value.trim();
    },

    clearQuery(): void {
      addrInput.value = '';
      clearInputBtn.hidden = true;
    },

    renderFieldSettings(
      order: string[],
      hidden: string[],
      labelsVisible: boolean,
    ): void {
      labelPanel.hidden = order.length === 0;
      labelsVisibleInput.checked = labelsVisible;
      fieldOrderList.textContent = '';
      order.forEach((field, idx) => {
        const li = document.createElement('li');
        li.className = 'field-row';

        const label = document.createElement('label');
        label.className = 'check';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = !hidden.includes(field);
        check.addEventListener('change', () => handlers.onToggleField(field));
        const text = document.createElement('span');
        text.textContent = field;
        label.append(check, text);

        const controls = document.createElement('div');
        controls.className = 'field-controls';
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'icon-btn field-up';
        up.appendChild(icon(ICON_UP));
        up.setAttribute('aria-label', `「${field}」を上へ`);
        up.disabled = idx === 0;
        up.addEventListener('click', () => handlers.onMoveField(field, -1));
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'icon-btn field-down';
        down.appendChild(icon(ICON_DOWN));
        down.setAttribute('aria-label', `「${field}」を下へ`);
        down.disabled = idx === order.length - 1;
        down.addEventListener('click', () => handlers.onMoveField(field, 1));
        controls.append(up, down);

        li.append(label, controls);
        fieldOrderList.appendChild(li);
      });
    },

    setBulkProgress(text: string, running: boolean): void {
      bulkProgress.textContent = text;
      bulkRun.disabled = running;
      bulkCancel.hidden = !running;
    },

    setBulkFailed(items: { label: string; reason: string }[]): void {
      bulkFailed.textContent = '';
      for (const item of items) {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.className = 'failed-label';
        name.textContent = item.label;
        const reason = document.createElement('span');
        reason.className = 'failed-reason';
        reason.textContent = item.reason;
        li.append(name, reason);
        bulkFailed.appendChild(li);
      }
    },

    renderRouteControl(
      pinCount: number,
      routeVisible: boolean,
      gmapUrl: string,
    ): void {
      // Googleマップのリンクは2件以上あれば常に使える
      routeControl.hidden = pinCount < 2;
      routeVisibleInput.checked = routeVisible;
      if (gmapUrl !== '') gmapLink.href = gmapUrl;
    },

    renderAppearance(
      pinCount: number,
      globalStyle: MarkerStyle | undefined,
    ): void {
      currentGlobalStyle = globalStyle;
      appearancePanel.hidden = pinCount === 0;
      const look = resolveAppearance(undefined, globalStyle);
      globalColors.replaceWith(
        (() => {
          const next = buildSwatches(look.colorKey, (color) =>
            handlers.onGlobalStyle({ color }),
          );
          next.id = 'global-colors';
          return next;
        })(),
      );
      globalSizes.replaceWith(
        (() => {
          const next = buildSizeButtons(look.sizeKey, (size) =>
            handlers.onGlobalStyle({ size }),
          );
          next.id = 'global-sizes';
          return next;
        })(),
      );
    },

    clearBulkInput(): void {
      bulkInput.value = '';
      bulkPreview.textContent = '';
      bulkAddress.textContent = '';
      bulkName.textContent = '';
      currentTable = null;
    },
  };

  // ── まとめて入力 ────────────────────────────────

  /** 列を選ぶプルダウンを作り直す。 */
  const fillColumnSelect = (
    select: HTMLSelectElement,
    headers: string[],
    selected: number,
  ): void => {
    select.textContent = '';
    headers.forEach((h, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h;
      if (i === selected) opt.selected = true;
      select.appendChild(opt);
    });
  };

  /** 取り込む内容を数行だけ表に出して確認できるようにする。 */
  const renderBulkPreview = (): void => {
    bulkPreview.textContent = '';
    if (currentTable === null) return;
    const addressCol = Number(bulkAddress.value);
    const nameCol = Number(bulkName.value);
    const entries = buildEntries(currentTable, addressCol, nameCol);

    const summary = document.createElement('p');
    summary.className = 'help';
    summary.textContent =
      entries.length === 0
        ? '住所の列に値がある行がありません。列の指定を見直してください。'
        : `${entries.length}件を取り込みます(先頭${Math.min(entries.length, 3)}件を表示)`;
    bulkPreview.appendChild(summary);

    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const h of currentTable.headers) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    table.appendChild(head);
    for (const row of currentTable.rows.slice(0, 3)) {
      const tr = document.createElement('tr');
      currentTable.headers.forEach((_h, i) => {
        const td = document.createElement('td');
        td.textContent = row[i] ?? '';
        if (i === addressCol) td.className = 'is-address';
        if (i === nameCol) td.className = 'is-name';
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }
    bulkPreview.appendChild(table);
  };

  /** 貼り付けた内容を読み取り直す。 */
  const reparseBulk = (): void => {
    const text = bulkInput.value;
    if (text.trim() === '') {
      currentTable = null;
      bulkPreview.textContent = '';
      bulkAddress.textContent = '';
      bulkName.textContent = '';
      return;
    }
    const table = parseTable(text, bulkHeader.checked);
    currentTable = table;
    if (table === null) {
      bulkPreview.textContent = '';
      return;
    }
    const addressCol = Math.max(
      guessAddressColumn(table.headers, table.rows),
      0,
    );
    const nameCol = guessNameColumn(table.headers, addressCol);
    fillColumnSelect(bulkAddress, table.headers, addressCol);
    fillColumnSelect(bulkName, table.headers, nameCol);
    renderBulkPreview();
  };

  bulkInput.addEventListener('input', reparseBulk);
  bulkInput.addEventListener('paste', () => setTimeout(reparseBulk, 0));
  bulkHeader.addEventListener('change', reparseBulk);
  bulkAddress.addEventListener('change', renderBulkPreview);
  bulkName.addEventListener('change', renderBulkPreview);
  bulkRun.addEventListener('click', () => {
    if (currentTable === null) {
      ui.setBulkProgress('取り込む表が読み取れませんでした。', false);
      return;
    }
    const entries = buildEntries(
      currentTable,
      Number(bulkAddress.value),
      Number(bulkName.value),
    );
    handlers.onBulkImport(entries);
  });
  bulkCancel.addEventListener('click', () => handlers.onBulkCancel());

  labelsVisibleInput.addEventListener('change', () =>
    handlers.onToggleLabels(labelsVisibleInput.checked),
  );
  labelsReset.addEventListener('click', () => handlers.onResetLabels());
  routeVisibleInput.addEventListener('change', () =>
    handlers.onToggleRoute(routeVisibleInput.checked),
  );
  // ルート計算を持たないビルドでは切り替え欄そのものを出さない
  if (!ROUTING_ENABLED) {
    const label = routeVisibleInput.closest('label');
    if (label !== null) label.hidden = true;
  }
  fieldsAll.addEventListener('click', () => handlers.onSetAllFields(true));
  fieldsNone.addEventListener('click', () => handlers.onSetAllFields(false));
  styleResetAll.addEventListener('click', () => handlers.onClearAllPinStyles());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ui.hideCandidates();
  });

  return ui;
}
