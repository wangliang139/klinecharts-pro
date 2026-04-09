/**
 * 与 {@link hisOrderMark} 圆点绘制几何一致；用于 crosshair 坐标下多标记命中（绕开库内 hover 置顶导致的独占命中）。
 */
import type { Chart, Coordinate, Overlay } from "klinecharts";

import type { HisOrder } from "../../types/types";

const MARK_RADIUS = 6;
const MARK_OFFSET = 14;
const STACK_GAP = 14;
const LATEST_BAR_MIN_PIXEL_SPAN = 18;

type HisOrderOverlayExtend = HisOrder & {
  stackIndex?: number;
  barHigh?: number;
  barLow?: number;
};

function circleCenterForOverlay(chart: Chart, overlay: Overlay): { cx: number; cy: number } | null {
  const point = overlay.points[0];
  const ext = overlay.extendData as HisOrderOverlayExtend | undefined;
  if (!point || !ext || !Number.isFinite(point.timestamp) || typeof ext.isBuy !== "boolean") {
    return null;
  }
  const dataList = chart.getDataList();
  const barFromData = dataList.find((d) => d.timestamp === point.timestamp);
  let highValue: number | undefined;
  let lowValue: number | undefined;
  if (barFromData && Number.isFinite(barFromData.high) && Number.isFinite(barFromData.low)) {
    highValue = barFromData.high;
    lowValue = barFromData.low;
  } else {
    highValue =
      typeof ext.barHigh === "number" && Number.isFinite(ext.barHigh) ? ext.barHigh : undefined;
    lowValue =
      typeof ext.barLow === "number" && Number.isFinite(ext.barLow) ? ext.barLow : undefined;
  }
  if (highValue === undefined || lowValue === undefined) {
    return null;
  }
  const pixel = chart.convertToPixel({
    timestamp: point.timestamp,
    value: point.value,
  }) as Partial<Coordinate>;
  const x = pixel.x;
  const highY = (chart.convertToPixel({ timestamp: point.timestamp, value: highValue }) as Partial<Coordinate>).y;
  const lowY = (chart.convertToPixel({ timestamp: point.timestamp, value: lowValue }) as Partial<Coordinate>).y;
  if (typeof x !== "number" || typeof highY !== "number" || typeof lowY !== "number") {
    return null;
  }
  const stackIndex = Math.max(0, ext.stackIndex ?? 0);
  const barPixelSpan = Math.abs(lowY - highY);
  const shortBarExtra =
    Number.isFinite(barPixelSpan) && barPixelSpan < LATEST_BAR_MIN_PIXEL_SPAN
      ? Math.max(0, LATEST_BAR_MIN_PIXEL_SPAN - barPixelSpan) * 0.65
      : 0;
  const markOffset = MARK_OFFSET + shortBarExtra;
  const y = ext.isBuy
    ? lowY + markOffset + stackIndex * STACK_GAP
    : highY - markOffset - stackIndex * STACK_GAP;
  return { cx: x, cy: y - 0.5 };
}

export type HisOrderMarkPick = {
  overlayId: string;
  order: HisOrderOverlayExtend;
  anchorX: number;
  anchorY: number;
};

/** 主图 pane 像素坐标；多枚重叠时距圆心最近优先，同距取 stackIndex 较大（更外一层）。 */
export function pickBestHisOrderMarkAtPanePixel(
  chart: Chart,
  paneX: number,
  paneY: number,
): HisOrderMarkPick | null {
  const overlays = chart.getOverlays({ name: "hisOrderMark", paneId: "candle_pane" }) ?? [];
  const paneDom = chart.getDom("candle_pane", "main");
  const rect = paneDom?.getBoundingClientRect();
  const r2 = MARK_RADIUS * MARK_RADIUS;

  type Cand = {
    overlayId: string;
    order: HisOrderOverlayExtend;
    distSq: number;
    stackIndex: number;
    cx: number;
    cy: number;
  };

  const cands: Cand[] = [];
  for (const overlay of overlays) {
    const id = overlay.id;
    if (!id) continue;
    const center = circleCenterForOverlay(chart, overlay);
    if (!center) continue;
    const dx = paneX - center.cx;
    const dy = paneY - center.cy;
    const distSq = dx * dx + dy * dy;
    if (distSq > r2) continue;
    const ext = overlay.extendData as HisOrderOverlayExtend;
    const stackIndex = Math.max(0, ext.stackIndex ?? 0);
    cands.push({
      overlayId: id,
      order: ext,
      distSq,
      stackIndex,
      cx: center.cx,
      cy: center.cy,
    });
  }
  if (cands.length === 0) return null;

  cands.sort((a, b) => {
    if (a.distSq !== b.distSq) return a.distSq - b.distSq;
    return b.stackIndex - a.stackIndex;
  });
  const best = cands[0]!;
  const anchorX = rect ? rect.left + best.cx : best.cx;
  const anchorY = rect ? rect.top + best.cy : best.cy;
  return {
    overlayId: best.overlayId,
    order: best.order,
    anchorX,
    anchorY,
  };
}
