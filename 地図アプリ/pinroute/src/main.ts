import './style.css';
import {
  emptyState,
  resolveFieldOrder,
  visibleFieldOrder,
  type AppState,
  type Pin,
} from './types';
import {
  addPin,
  addPinsWithFields,
  removePin,
  renamePin,
  movePin,
  reorderPin,
  clearPins,
  setLabelOffset,
  setLabelHidden,
  resetLabels,
  moveField,
  toggleField,
  setAllFieldsVisible,
  setGlobalStyle,
  setPinStyle,
  clearPinStyle,
  clearAllPinStyles,
  MAX_PINS,
} from './state';
import type { MarkerStyle } from './appearance';
import type { BulkEntry } from './bulk';
import { searchAddress, GeocodeError, type GeoCandidate } from './geocode';
import { fetchRoute, buildGoogleMapsUrl, RouteError } from './route';
import { encodeShareUrl, decodeSharePayload } from './share';
import { saveState, loadState } from './storage';
import { debounce } from './throttle';
import { createMapView } from './mapview';
import { createUi, type Ui } from './ui';
import { ROUTING_ENABLED } from './config';

const MESSAGES = {
  notFound: '見つかりませんでした。表記を変えて試してください。',
  geocodeNetwork:
    '検索サーバーに接続できません。時間をおいて再試行してください。',
  routeFailed:
    'ルートを計算できませんでした(無料サーバーのため一時的に不安定なことがあります)。',
  maxPins: `ピンは最大${MAX_PINS}件までです。`,
  shareDecodeFailed: '共有URLを読み込めませんでした。',
  shareTooLong: 'URLが長いため、一部の環境で開けない場合があります。',
  copied: '共有URLをコピーしました',
} as const;

/** まとめて入力で1件ずつ処理する間隔。公開APIへの配慮で少し空ける。 */
const BULK_INTERVAL_MS = 250;

/** 指定ミリ秒待つ。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function init(): void {
  let state: AppState = emptyState();
  let shareDecodeFailed = false;

  // 共有URL(#s=)はlocalStorageより優先(基本設計§4.3)
  const m = /^#s=(.+)$/.exec(location.hash);
  if (m !== null) {
    const decoded = decodeSharePayload(m[1]);
    if (decoded !== null) {
      state = decoded;
    } else {
      shareDecodeFailed = true;
      state = loadState() ?? emptyState();
    }
    history.replaceState(null, '', location.pathname + location.search);
  } else {
    state = loadState() ?? emptyState();
  }

  const mapview = createMapView(document.getElementById('map') as HTMLElement, {
    onMoveLabel(id, offset, others) {
      update(setLabelOffset(state, id, offset, others), ui, { fit: false });
    },
    onHideLabel(id) {
      update(setLabelHidden(state, id, true), ui, { fit: false });
    },
    onHoverLabel(id) {
      mapview.highlight(id);
    },
  });

  let routeAbort: AbortController | null = null;
  let searchAbort: AbortController | null = null;

  const debouncedSave = debounce((s: AppState) => saveState(s), 300);

  const recalcRoute = async (s: AppState, ui: Ui): Promise<void> => {
    routeAbort?.abort();
    // 表示しない設定のとき、および公開ビルドでは計算もしない
    if (!ROUTING_ENABLED || s.pins.length < 2 || s.routeVisible === false) {
      mapview.renderRoute(null);
      ui.setRouteBar(null);
      ui.setLegs(null);
      return;
    }
    const controller = new AbortController();
    routeAbort = controller;
    ui.setRouteLoading(true);
    try {
      const result = await fetchRoute(s.pins, { signal: controller.signal });
      if (controller.signal.aborted) return;
      mapview.renderRoute(result);
      ui.setRouteBar({
        distanceKm: result.distanceKm,
        durationMin: result.durationMin,
        gmapUrl: buildGoogleMapsUrl(s.pins),
      });
      ui.setLegs(result.legs);
    } catch (e) {
      if (controller.signal.aborted) return;
      // NFR-06: ルートが出せなくてもピン機能はそのまま使えるようにする
      mapview.renderRoute(null);
      ui.setRouteBar(null);
      ui.setLegs(null);
      if (e instanceof RouteError || e instanceof Error) {
        ui.showMessage(MESSAGES.routeFailed);
      }
    } finally {
      if (routeAbort === controller) ui.setRouteLoading(false);
    }
  };

  // NFR-08: ルート再計算は500msデバウンス
  const debouncedRoute = debounce((s: AppState, ui: Ui) => {
    void recalcRoute(s, ui);
  }, 500);

  /**
   * 状態を差し替えて画面全体を描き直す。
   * fit=false のときは地図の表示範囲を動かさない(名称編集で勝手に動くと使いづらいため)。
   */
  /** 情報ブロックと、その設定欄を今の状態に合わせる。 */
  const renderLabels = (ui: Ui): void => {
    const order = resolveFieldOrder(state.pins, state.fieldOrder);
    const hidden = state.hiddenFields ?? [];
    const visible = state.labelsVisible !== false;
    ui.renderFieldSettings(order, hidden, visible);
    mapview.renderCallouts(
      state.pins,
      visibleFieldOrder(order, hidden),
      visible,
      state.style,
    );
  };

  const update = (newState: AppState, ui: Ui, opts: { fit: boolean }): void => {
    const changed = newState !== state;
    state = newState;
    ui.renderList(state.pins, state.style);
    ui.renderRouteControl(
      state.pins.length,
      state.routeVisible !== false,
      state.pins.length >= 2 ? buildGoogleMapsUrl(state.pins) : '',
    );
    ui.renderAppearance(state.pins.length, state.style);
    mapview.renderPins(state.pins, state.style);
    renderLabels(ui);
    if (opts.fit) mapview.fitToPins(state.pins);
    if (!changed) return;
    debouncedSave(state);
    debouncedRoute(state, ui);
  };

  const confirmPin = (c: GeoCandidate, query: string, ui: Ui): void => {
    ui.hideCandidates();
    if (state.pins.length >= MAX_PINS) {
      ui.showMessage(MESSAGES.maxPins);
      return;
    }
    ui.clearQuery();
    update(
      addPin(state, {
        name: c.name,
        query,
        lat: c.lat,
        lng: c.lng,
        context: c.context,
      }),
      ui,
      { fit: true },
    );
    ui.showToast(`「${c.name}」を追加しました`);
  };

  let lastQuery = '';
  let bulkAbort: AbortController | null = null;

  /**
   * まとめて入力の取り込み。
   * 1件ずつ順に検索し、進み具合を表示する。公開APIに連続で叩き込まないよう間隔を空ける。
   */
  const runBulkImport = async (entries: BulkEntry[]): Promise<void> => {
    if (entries.length === 0) {
      ui.setBulkProgress('取り込む行がありません。', false);
      return;
    }
    bulkAbort?.abort();
    const controller = new AbortController();
    bulkAbort = controller;

    const room = MAX_PINS - state.pins.length;
    const target = entries.slice(0, Math.max(room, 0));
    const overflow = entries.length - target.length;
    if (target.length === 0) {
      ui.setBulkProgress('', false);
      ui.showMessage(MESSAGES.maxPins);
      return;
    }

    ui.clearMessage();
    const added: Omit<Pin, 'id'>[] = [];
    const failed: { label: string; reason: string }[] = [];

    for (const [i, entry] of target.entries()) {
      if (controller.signal.aborted) break;
      ui.setBulkProgress(`取り込み中… ${i + 1} / ${target.length}`, true);
      try {
        const found = await searchAddress(entry.address, {
          signal: controller.signal,
          supplement: false,
        });
        const top = found[0];
        if (top === undefined) {
          failed.push({
            label: entry.name,
            reason: '住所が見つかりませんでした',
          });
        } else {
          added.push({
            name: entry.name,
            query: entry.address,
            lat: top.lat,
            lng: top.lng,
            ...(top.context === undefined ? {} : { context: top.context }),
            fields: entry.fields,
          });
        }
      } catch (e) {
        if (controller.signal.aborted) break;
        failed.push({
          label: entry.name,
          reason:
            e instanceof GeocodeError
              ? '検索サーバーに接続できません'
              : '取り込めません',
        });
      }
      if (i < target.length - 1) await sleep(BULK_INTERVAL_MS);
    }

    if (bulkAbort === controller) bulkAbort = null;

    if (added.length > 0) {
      update(addPinsWithFields(state, added), ui, { fit: true });
      ui.clearBulkInput();
    }
    ui.setBulkFailed(failed);

    const parts = [`${added.length}件を追加しました`];
    if (failed.length > 0)
      parts.push(`${failed.length}件は取り込めませんでした`);
    if (overflow > 0) parts.push(`上限のため${overflow}件は取り込んでいません`);
    if (controller.signal.aborted) parts.push('(中止しました)');
    ui.setBulkProgress(parts.join(' / '), false);
    if (added.length > 0) ui.showToast(`${added.length}件を追加しました`);
  };

  const ui = createUi({
    onSearch(query: string): void {
      ui.clearMessage();
      ui.hideShareFallback();
      ui.hideCandidates();
      if (state.pins.length >= MAX_PINS) {
        ui.showMessage(MESSAGES.maxPins);
        return;
      }
      lastQuery = query;
      searchAbort?.abort();
      const controller = new AbortController();
      searchAbort = controller;
      ui.setSearching(true);
      searchAddress(query, { signal: controller.signal })
        .then((candidates) => {
          if (controller.signal.aborted) return;
          if (candidates.length === 0) {
            ui.showMessage(MESSAGES.notFound, 'info');
            return;
          }
          // FR-02: 1件に絞れたら確認を挟まずそのまま確定する
          if (candidates.length === 1) {
            confirmPin(candidates[0], query, ui);
            return;
          }
          ui.renderCandidates(candidates);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          if (e instanceof GeocodeError || e instanceof Error) {
            ui.showMessage(MESSAGES.geocodeNetwork);
          }
        })
        .finally(() => {
          if (searchAbort === controller) ui.setSearching(false);
        });
    },

    onSelectCandidate(c: GeoCandidate): void {
      ui.clearMessage();
      confirmPin(c, lastQuery, ui);
    },

    onRename(id: string, name: string): void {
      ui.clearMessage();
      update(renamePin(state, id, name), ui, { fit: false });
    },

    onMove(id: string, dir: -1 | 1): void {
      ui.clearMessage();
      update(movePin(state, id, dir), ui, { fit: false });
    },

    onReorder(fromIdx: number, toIdx: number): void {
      ui.clearMessage();
      update(reorderPin(state, fromIdx, toIdx), ui, { fit: false });
    },

    onDelete(id: string): void {
      ui.clearMessage();
      update(removePin(state, id), ui, { fit: true });
    },

    onClear(): void {
      ui.clearMessage();
      if (state.pins.length === 0) return;
      if (window.confirm('すべてのピンを削除します。よろしいですか?')) {
        update(clearPins(state), ui, { fit: false });
      }
    },

    onFocus(id: string): void {
      const pin = state.pins.find((p) => p.id === id);
      if (pin !== undefined) mapview.focusPin(pin);
    },

    onHover(id: string | null): void {
      mapview.highlight(id);
    },

    onBulkImport(entries: BulkEntry[]): void {
      void runBulkImport(entries);
    },

    onBulkCancel(): void {
      bulkAbort?.abort();
    },

    onMoveField(field: string, dir: -1 | 1): void {
      const order = resolveFieldOrder(state.pins, state.fieldOrder);
      update(moveField(state, order, field, dir), ui, { fit: false });
    },

    onToggleField(field: string): void {
      const order = resolveFieldOrder(state.pins, state.fieldOrder);
      update(toggleField(state, order, field), ui, { fit: false });
    },

    onToggleLabels(visible: boolean): void {
      update({ ...state, labelsVisible: visible }, ui, { fit: false });
    },

    onSetAllFields(visible: boolean): void {
      const order = resolveFieldOrder(state.pins, state.fieldOrder);
      update(setAllFieldsVisible(state, order, visible), ui, { fit: false });
    },

    onGlobalStyle(style: MarkerStyle): void {
      update(setGlobalStyle(state, style), ui, { fit: false });
    },

    onClearAllPinStyles(): void {
      update(clearAllPinStyles(state), ui, { fit: false });
    },

    onPinStyle(id: string, style: MarkerStyle): void {
      update(setPinStyle(state, id, style), ui, { fit: false });
    },

    onClearPinStyle(id: string): void {
      update(clearPinStyle(state, id), ui, { fit: false });
    },

    onToggleRoute(visible: boolean): void {
      ui.clearMessage();
      update({ ...state, routeVisible: visible }, ui, { fit: false });
      // 切り替えた結果はすぐ見せる(消すときにデバウンスを待たせない)
      void recalcRoute(state, ui);
    },

    onResetLabels(): void {
      update(resetLabels(state), ui, { fit: false });
    },

    onShare(): void {
      ui.clearMessage();
      ui.hideShareFallback();
      const base = location.origin + location.pathname + location.search;
      const { url, tooLong } = encodeShareUrl(state, base);
      if (tooLong) ui.showMessage(MESSAGES.shareTooLong, 'info');
      navigator.clipboard
        .writeText(url)
        .then(() => ui.showToast(MESSAGES.copied))
        .catch(() => ui.showShareFallback(url));
    },
  });

  if (shareDecodeFailed) ui.showMessage(MESSAGES.shareDecodeFailed);

  ui.renderList(state.pins, state.style);
  ui.renderRouteControl(
    state.pins.length,
    state.routeVisible !== false,
    state.pins.length >= 2 ? buildGoogleMapsUrl(state.pins) : '',
  );
  ui.renderAppearance(state.pins.length, state.style);
  mapview.renderPins(state.pins, state.style);
  renderLabels(ui);
  mapview.fitToPins(state.pins);
  // 共有URLから復元した内容もlocalStorageに残す
  saveState(state);
  void recalcRoute(state, ui);
}

init();
