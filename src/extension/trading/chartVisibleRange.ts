/**
 * 主图蜡烛区当前可见价格区间，供交易类 overlay 判断是否绘制。
 */

import type { Chart, Point } from "klinecharts";

export function pickValueFromConvertResult(
  r: Partial<Point> | Array<Partial<Point>> | undefined,
): number | undefined {
  if (r == null) return undefined;
  const p = Array.isArray(r) ? r[0] : r;
  const v = p?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function getCandlePaneVisibleValueRange(chart: Chart): { min: number; max: number } | null {
  const size = chart.getSize("candle_pane", "main");
  if (!size || size.width <= 0 || size.height <= 0) return null;
  const x = size.width * 0.5;
  const topVal = pickValueFromConvertResult(
    chart.convertFromPixel([{ x, y: 0 }], { paneId: "candle_pane" }),
  );
  const bottomVal = pickValueFromConvertResult(
    chart.convertFromPixel([{ x, y: size.height }], { paneId: "candle_pane" }),
  );
  if (topVal === undefined || bottomVal === undefined) return null;
  return {
    min: Math.min(topVal, bottomVal),
    max: Math.max(topVal, bottomVal),
  };
}

export function isPriceInVisibleCandleRange(chart: Chart, price: number): boolean {
  const range = getCandlePaneVisibleValueRange(chart);
  if (!range) return false;
  return price >= range.min && price <= range.max;
}
