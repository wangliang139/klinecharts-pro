import type { Chart } from "klinecharts";

import type { HisOrder, PendingOrder, Position, TradingConfig } from "../types/types";
import { instanceApi } from "./chartStore";

export const CHART_STATE_STORAGE_KEY = "chartstatedata";

export const DEFAULT_TRADING_DISPLAY: TradingConfig = {
  showPositions: false,
  showLiquidation: false,
  showOpenOrders: false,
  showHisOrders: false,
};

const TRADING_OVERLAY_GROUP = "trading-display";
const CHART_STATE_VERSION = 2;
const LEGACY_TRADING_PREFIXES = ["trading-pos-", "trading-liq", "trading-order-", "trading-his-order-"];

type TradingScopeState = {
  tradingConfig: TradingConfig;
  positionsState: Position[];
  liquidationPriceState: number | null;
  openOrdersState: PendingOrder[];
  hisOrdersState: HisOrder[];
  overlaySignatures: Map<string, string>;
};

type ChartStateStorage = Record<string, unknown> & {
  version?: number;
  tradingDisplay?: TradingConfig;
  trading?: TradingConfig;
};

type DesiredOverlay = {
  id: string;
  name: "positionAvgLine" | "liquidationLine" | "pendingOrderLine" | "hisOrderMark";
  points: Array<{ timestamp: number; value: number }>;
  extendData: Record<string, unknown>;
  signature: string;
};

const fallbackScopeState = createDefaultScopeState();
const scopedState = new WeakMap<Chart, TradingScopeState>();

function createDefaultScopeState(): TradingScopeState {
  return {
    tradingConfig: { ...DEFAULT_TRADING_DISPLAY },
    positionsState: [],
    liquidationPriceState: null,
    openOrdersState: [],
    hisOrdersState: [],
    overlaySignatures: new Map<string, string>(),
  };
}

function warnTrading(message: string, error?: unknown): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  if (error !== undefined) {
    console.warn(`[tradingStore] ${message}`, error);
    return;
  }
  console.warn(`[tradingStore] ${message}`);
}

function resolveChart(chart?: Chart | null): Chart | null {
  if (chart) return chart;
  return (instanceApi() as Chart | null | undefined) ?? null;
}

function resolveScope(chart?: Chart | null): TradingScopeState {
  const resolvedChart = resolveChart(chart);
  if (!resolvedChart) return fallbackScopeState;
  const found = scopedState.get(resolvedChart);
  if (found) return found;
  const created = createDefaultScopeState();
  scopedState.set(resolvedChart, created);
  return created;
}

function readChartObj(): ChartStateStorage {
  try {
    const raw = localStorage.getItem(CHART_STATE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ChartStateStorage;
  } catch (error) {
    warnTrading("Failed to parse chart state storage, using defaults.", error);
    return {};
  }
}

export function normalizeTradingConfig(input: unknown): TradingConfig | null {
  const cfg = input as TradingConfig | null | undefined;
  if (!cfg || typeof cfg.showPositions !== "boolean" || typeof cfg.showLiquidation !== "boolean") {
    return null;
  }
  return {
    showPositions: cfg.showPositions,
    showLiquidation: cfg.showLiquidation,
    showOpenOrders: typeof cfg.showOpenOrders === "boolean" ? cfg.showOpenOrders : DEFAULT_TRADING_DISPLAY.showOpenOrders,
    showHisOrders: typeof cfg.showHisOrders === "boolean" ? cfg.showHisOrders : DEFAULT_TRADING_DISPLAY.showHisOrders,
  };
}

export function getMigratedTradingConfig(chartObj: ChartStateStorage): TradingConfig {
  const normalizedDisplay = normalizeTradingConfig(chartObj.tradingDisplay);
  if (normalizedDisplay) return normalizedDisplay;
  const normalizedLegacy = normalizeTradingConfig(chartObj.trading);
  if (normalizedLegacy) return normalizedLegacy;
  return { ...DEFAULT_TRADING_DISPLAY };
}

function writeChartObj(obj: ChartStateStorage): void {
  const normalized = {
    ...obj,
    version: CHART_STATE_VERSION,
    tradingDisplay: getMigratedTradingConfig(obj),
  };
  delete (normalized as { trading?: TradingConfig }).trading;
  localStorage.setItem(CHART_STATE_STORAGE_KEY, JSON.stringify(normalized));
}

export function bindTradingStore(chart: Chart): void {
  resolveScope(chart);
  loadTradingConfigFromStorage(chart);
}

export function loadTradingConfigFromStorage(chart?: Chart | null): TradingConfig {
  const scope = resolveScope(chart);
  const chartObj = readChartObj();
  scope.tradingConfig = getMigratedTradingConfig(chartObj);
  writeChartObj(chartObj);
  return { ...scope.tradingConfig };
}

export function persistTradingConfig(next: TradingConfig, chart?: Chart | null): void {
  const scope = resolveScope(chart);
  scope.tradingConfig = { ...next };
  const chartObj = readChartObj();
  chartObj.tradingDisplay = scope.tradingConfig;
  writeChartObj(chartObj);
}

export function getTradingConfigState(chart?: Chart | null): TradingConfig {
  const scope = resolveScope(chart);
  return { ...scope.tradingConfig };
}

export function setTradingConfigState(next: TradingConfig, chart?: Chart | null): void {
  persistTradingConfig(next, chart);
  syncTradingOverlays(chart);
}

export function setPositionsData(list: Position[], chart?: Chart | null): void {
  const scope = resolveScope(chart);
  scope.positionsState = list.slice();
  syncTradingOverlays(chart);
}

export function setLiquidationPriceData(price: number | null, chart?: Chart | null): void {
  const scope = resolveScope(chart);
  scope.liquidationPriceState = price;
  if (price != null && Number.isFinite(price)) {
    persistTradingConfig({ ...scope.tradingConfig, showLiquidation: true }, chart);
  }
  syncTradingOverlays(chart);
}

export function setOpenOrdersData(list: PendingOrder[], chart?: Chart | null): void {
  const scope = resolveScope(chart);
  scope.openOrdersState = list.slice();
  syncTradingOverlays(chart);
}

export function setHisOrdersData(list: HisOrder[], chart?: Chart | null): void {
  const scope = resolveScope(chart);
  scope.hisOrdersState = list.slice();
  syncTradingOverlays(chart);
}

export function mapToBarTimestampClosestLeft(dataList: Array<{ timestamp: number }>, timestamp: number): number | null {
  if (!Number.isFinite(timestamp) || dataList.length === 0) return null;
  let left = 0;
  let right = dataList.length - 1;
  let ans = -1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    if (dataList[mid].timestamp <= timestamp) {
      ans = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return ans >= 0 ? dataList[ans].timestamp : null;
}

function safeOverlaySegment(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function makeOverlaySignature(name: string, points: Array<{ timestamp: number; value: number }>, extendData: unknown): string {
  return JSON.stringify({ name, points, extendData });
}

function applyReadonlyOverlayHandlers(chart: Chart, id: string): void {
  chart.overrideOverlay({
    id,
    onSelected: (event) => {
      if (event.preventDefault) event.preventDefault();
      event.overlay.mode = "normal";
      return false;
    },
    onRightClick: (event) => {
      if (event.preventDefault) event.preventDefault();
      return false;
    },
  });
}

function createOrUpdateOverlay(chart: Chart, payload: DesiredOverlay): string {
  const exists = (chart.getOverlays({ id: payload.id }) ?? []).length > 0;
  if (!exists) {
    const createdId = chart.createOverlay({
      id: payload.id,
      name: payload.name,
      groupId: TRADING_OVERLAY_GROUP,
      paneId: "candle_pane",
      mode: "normal",
      points: payload.points,
      extendData: payload.extendData,
    }) as string | null | undefined;
    const actualId = createdId ?? payload.id;
    applyReadonlyOverlayHandlers(chart, actualId);
    return actualId;
  }
  chart.overrideOverlay({
    id: payload.id,
    points: payload.points,
    extendData: payload.extendData,
  });
  applyReadonlyOverlayHandlers(chart, payload.id);
  return payload.id;
}

function removeLegacyTradingOverlays(chart: Chart, aliveIds: Set<string>): void {
  const all = chart.getOverlays() ?? [];
  all
    .filter((o) => !!o.id && LEGACY_TRADING_PREFIXES.some((prefix) => o.id!.startsWith(prefix)) && !aliveIds.has(o.id!))
    .forEach((o) => chart.removeOverlay({ id: o.id }));
}

function buildDesiredOverlays(
  scope: TradingScopeState,
  dataList: Array<{ timestamp: number; high?: number; low?: number }>,
  lastTs: number,
): DesiredOverlay[] {
  const desired: DesiredOverlay[] = [];
  const showPos = scope.tradingConfig.showPositions;
  const showLiq = scope.tradingConfig.showLiquidation;
  const showOpenOrders = scope.tradingConfig.showOpenOrders;
  const showHisOrders = scope.tradingConfig.showHisOrders;
  const validPositions = scope.positionsState.filter((p) => p.size !== 0 && Number.isFinite(p.avgPrice));

  if (showPos) {
    validPositions.forEach((pos, index) => {
      const idSuffix = safeOverlaySegment(pos.id ?? `idx${index}`);
      const id = `trading-pos-${idSuffix}`;
      const points = [{ timestamp: lastTs, value: pos.avgPrice }];
      const extendData = {
        side: pos.side,
        size: pos.size,
        multiplier: pos.multiplier ?? 1,
      };
      desired.push({
        id,
        name: "positionAvgLine",
        points,
        extendData,
        signature: makeOverlaySignature("positionAvgLine", points, extendData),
      });
    });
  }

  if (showLiq && validPositions.length > 0) {
    const liq = scope.liquidationPriceState;
    if (liq != null && Number.isFinite(liq)) {
      const points = [{ timestamp: lastTs, value: liq }];
      const extendData = {};
      desired.push({
        id: "trading-liq",
        name: "liquidationLine",
        points,
        extendData,
        signature: makeOverlaySignature("liquidationLine", points, extendData),
      });
    }
  }

  if (showOpenOrders) {
    const visibleOrders = scope.openOrdersState.filter(
      (o) =>
        o.orderType !== "market" &&
        Number.isFinite(o.price) &&
        o.size !== 0 &&
        (o.side === "long" || o.side === "short") &&
        typeof o.isBuy === "boolean",
    );
    visibleOrders.forEach((ord, index) => {
      const idSuffix = safeOverlaySegment(ord.id ?? `idx${index}`);
      const id = `trading-order-${idSuffix}`;
      const points = [{ timestamp: lastTs, value: ord.price! }];
      const extendData = {
        isBuy: ord.isBuy,
        size: ord.size,
      };
      desired.push({
        id,
        name: "pendingOrderLine",
        points,
        extendData,
        signature: makeOverlaySignature("pendingOrderLine", points, extendData),
      });
    });
  }

  if (showHisOrders) {
    const visibleHisOrders = scope.hisOrdersState.filter(
      (o) =>
        Number.isFinite(o.timestamp) &&
        Number.isFinite(o.price) &&
        Number.isFinite(o.size) &&
        o.size !== 0 &&
        typeof o.isBuy === "boolean",
    );
    const hisOrderStackCounter = new Map<string, number>();
    const barByTs = new Map<number, { high?: number; low?: number }>();
    dataList.forEach((item) => barByTs.set(item.timestamp, { high: item.high, low: item.low }));
    visibleHisOrders.forEach((ord, index) => {
      const barTs = mapToBarTimestampClosestLeft(dataList, ord.timestamp);
      if (barTs == null) return;
      const stackKey = `${barTs}_${ord.isBuy ? "B" : "S"}`;
      const stackIndex = hisOrderStackCounter.get(stackKey) ?? 0;
      hisOrderStackCounter.set(stackKey, stackIndex + 1);
      const bar = barByTs.get(barTs);
      const idSuffix = safeOverlaySegment(ord.id ?? String(ord.orderId ?? `idx${index}`));
      const id = `trading-his-order-${idSuffix}`;
      const points = [{ timestamp: barTs, value: ord.price }];
      const extendData = {
        ...ord,
        stackIndex,
        barHigh: bar?.high,
        barLow: bar?.low,
      };
      desired.push({
        id,
        name: "hisOrderMark",
        points,
        extendData,
        signature: makeOverlaySignature("hisOrderMark", points, extendData),
      });
    });
  }
  return desired;
}

export function syncTradingOverlays(targetChart?: Chart | null): void {
  const resolvedChart = resolveChart(targetChart);
  const scope = resolveScope(resolvedChart);
  if (!resolvedChart) return;
  const chart = resolvedChart;
  const dataList = chart.getDataList();
  const lastTs = dataList.at(-1)?.timestamp ?? Date.now();
  const desired = buildDesiredOverlays(scope, dataList, lastTs);
  const desiredById = new Map(desired.map((item) => [item.id, item] as const));
  const existingByGroup = chart.getOverlays({ groupId: TRADING_OVERLAY_GROUP }) ?? [];
  const existingIdSet = new Set(existingByGroup.map((item) => item.id).filter((id): id is string => !!id));

  existingIdSet.forEach((id) => {
    if (!desiredById.has(id)) {
      chart.removeOverlay({ id });
    }
  });

  const nextSignatures = new Map<string, string>();
  desired.forEach((overlay) => {
    const previousSignature = scope.overlaySignatures.get(overlay.id);
    const exists = existingIdSet.has(overlay.id);
    if (!exists || previousSignature !== overlay.signature) {
      const actualId = createOrUpdateOverlay(chart, overlay);
      nextSignatures.set(actualId, overlay.signature);
      return;
    }
    nextSignatures.set(overlay.id, overlay.signature);
  });
  scope.overlaySignatures = nextSignatures;
  removeLegacyTradingOverlays(chart, new Set(nextSignatures.keys()));
}
