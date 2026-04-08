import type { Chart } from "klinecharts";

import type { TradingConfig, TradingPosition } from "../types/types";
import { instanceApi } from "./chartStore";

export const CHART_STATE_STORAGE_KEY = "chartstatedata";

export const DEFAULT_TRADING_DISPLAY: TradingConfig = {
  showPositions: false,
  showLiquidation: false,
};

const TRADING_OVERLAY_GROUP = "trading-display";

let tradingDisplay: TradingConfig = { ...DEFAULT_TRADING_DISPLAY };
let positionsState: TradingPosition[] = [];
let liquidationPriceState: number | null = null;

function readChartObj(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CHART_STATE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeChartObj(obj: Record<string, unknown>): void {
  localStorage.setItem(CHART_STATE_STORAGE_KEY, JSON.stringify(obj));
}

export function loadTradingConfigFromStorage(): TradingConfig {
  const chartObj = readChartObj();
  const td = chartObj.tradingDisplay as TradingConfig | undefined;
  if (td && typeof td.showPositions === "boolean" && typeof td.showLiquidation === "boolean") {
    tradingDisplay = { ...td };
    return tradingDisplay;
  }
  tradingDisplay = { ...DEFAULT_TRADING_DISPLAY };
  return tradingDisplay;
}

export function persistTradingConfig(next: TradingConfig): void {
  tradingDisplay = { ...next };
  const chartObj = readChartObj();
  chartObj.tradingDisplay = tradingDisplay;
  writeChartObj(chartObj);
}

export function getTradingConfigState(): TradingConfig {
  return { ...tradingDisplay };
}

export function setTradingConfigState(next: TradingConfig): void {
  persistTradingConfig(next);
  syncTradingOverlays();
}

export function setPositionsData(list: TradingPosition[]): void {
  positionsState = list.slice();
  syncTradingOverlays();
}

export function setLiquidationPriceData(price: number | null): void {
  liquidationPriceState = price;
  if (price != null && Number.isFinite(price)) {
    persistTradingConfig({ ...tradingDisplay, showLiquidation: true });
  }
  syncTradingOverlays();
}

function safeOverlaySegment(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function removeTradingOverlays(chart: Chart): void {
  const byGroup = chart.getOverlays({ groupId: TRADING_OVERLAY_GROUP }) ?? [];
  if (byGroup.length > 0) {
    byGroup.forEach((o) => chart.removeOverlay({ id: o.id }));
    return;
  }
  const all = chart.getOverlays() ?? [];
  all
    .filter((o) => o.id?.startsWith("trading-pos-") || o.id?.startsWith("trading-liq"))
    .forEach((o) => chart.removeOverlay({ id: o.id }));
}

export function syncTradingOverlays(): void {
  const chart = instanceApi() as Chart | null | undefined;
  if (!chart) return;

  removeTradingOverlays(chart);

  const dataList = chart.getDataList();
  const last = dataList.at(-1);
  const lastTs = last?.timestamp;

  const showPos = tradingDisplay.showPositions;
  const showLiq = tradingDisplay.showLiquidation;

  const validPositions = positionsState.filter((p) => p.size !== 0 && Number.isFinite(p.avgPrice));

  if (showPos) {
    validPositions.forEach((pos, index) => {
      const idSuffix = safeOverlaySegment(pos.id ?? `idx${index}`);
      const ts = lastTs ?? Date.now();
      const desiredId = `trading-pos-${idSuffix}`;
      const createdId = chart.createOverlay({
        id: desiredId,
        name: "positionAvgLine",
        groupId: TRADING_OVERLAY_GROUP,
        paneId: "candle_pane",
        mode: "normal",
        points: [{ timestamp: ts, value: pos.avgPrice }],
        extendData: {
          side: pos.side,
          size: pos.size,
          multiplier: pos.multiplier ?? 1,
        },
      }) as string | null | undefined;
      const oid = createdId ?? desiredId;
      chart.overrideOverlay({
        id: oid,
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
    });
  }

  if (showLiq && validPositions.length > 0) {
    const liq = liquidationPriceState;
    if (liq != null && Number.isFinite(liq)) {
      const ts = lastTs ?? Date.now();
      const desiredId = "trading-liq";
      const createdId = chart.createOverlay({
        id: desiredId,
        name: "liquidationLine",
        groupId: TRADING_OVERLAY_GROUP,
        paneId: "candle_pane",
        mode: "normal",
        points: [{ timestamp: ts, value: liq }],
        extendData: {},
      }) as string | null | undefined;
      const oid = createdId ?? desiredId;
      chart.overrideOverlay({
        id: oid,
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
  }
}
