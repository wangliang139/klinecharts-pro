import { describe, expect, it } from "vitest";

import {
  getMigratedTradingConfig,
  makeOverlaySignature,
  mapToBarTimestampClosestLeft,
  normalizeTradingConfig,
} from "../tradingStore";

describe("tradingStore helpers", () => {
  it("normalizes partial legacy trading config", () => {
    const normalized = normalizeTradingConfig({
      showPositions: true,
      showLiquidation: false,
    });
    expect(normalized).toEqual({
      showPositions: true,
      showLiquidation: false,
      showOpenOrders: false,
      showHisOrders: false,
      showPriceAlerts: false,
    });
  });

  it("migrates trading to tradingDisplay fallback", () => {
    const cfg = getMigratedTradingConfig({
      trading: {
        showPositions: false,
        showLiquidation: true,
        showOpenOrders: true,
        showHisOrders: false,
        showPriceAlerts: false,
      },
    });
    expect(cfg.showLiquidation).toBe(true);
    expect(cfg.showOpenOrders).toBe(true);
    expect(cfg.showPriceAlerts).toBe(false);
  });

  it("maps timestamp to closest left bar", () => {
    const ts = mapToBarTimestampClosestLeft(
      [{ timestamp: 100 }, { timestamp: 200 }, { timestamp: 300 }],
      250,
    );
    expect(ts).toBe(200);
  });

  it("builds deterministic overlay signature", () => {
    const a = makeOverlaySignature("pendingOrderLine", [{ timestamp: 100, value: 1.23 }], { isBuy: true, size: 1 });
    const b = makeOverlaySignature("pendingOrderLine", [{ timestamp: 100, value: 1.23 }], { isBuy: true, size: 1 });
    expect(a).toBe(b);
  });
});
