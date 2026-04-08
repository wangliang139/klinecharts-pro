/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  type Chart,
  Coordinate,
  LineStyle,
  OverlayEvent,
  OverlayTemplate,
  type Point,
  TextStyle,
  utils,
} from "klinecharts";

import { formatWesternGrouped, getPrecision } from "../../helpers";

function pickValueFromConvertResult(
  r: Partial<Point> | Array<Partial<Point>> | undefined,
): number | undefined {
  if (r == null) return undefined;
  const p = Array.isArray(r) ? r[0] : r;
  const v = p?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** 主图蜡烛区当前可见的价格区间（含边界），与 Y 轴刻度一致 */
function getCandlePaneVisibleValueRange(chart: Chart): { min: number; max: number } | null {
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

function isLiquidationInVisibleYRange(chart: Chart, liq: number): boolean {
  const range = getCandlePaneVisibleValueRange(chart);
  if (!range) return false;
  return liq >= range.min && liq <= range.max;
}

const LIQ_LINE = "#f6465d";

const lineStyle = (): LineStyle => ({
  style: "dashed",
  size: 1,
  color: LIQ_LINE,
  dashedValue: [4, 4],
});

const labelStyle: TextStyle = {
  style: "stroke_fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color: LIQ_LINE,
  backgroundColor: "white",
  borderColor: LIQ_LINE,
  borderStyle: "solid",
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: 2,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 4,
  paddingBottom: 4,
};

const yAxisLabelStyle: TextStyle = {
  style: "fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color: LIQ_LINE,
  backgroundColor: "rgba(22, 26, 32, 0.72)",
  borderColor: LIQ_LINE,
  borderStyle: "solid",
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: 0,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 4,
  paddingBottom: 4,
};

const liquidationLine = (): OverlayTemplate => ({
  name: "liquidationLine",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const liq = overlay.points[0]?.value;
    const last = chart.getDataList().at(-1);
    if (liq === undefined || !Number.isFinite(liq) || !last) {
      return [];
    }
    if (!isLiquidationInVisibleYRange(chart, liq)) {
      return [];
    }
    const ts = last.timestamp;
    const y = (chart.convertToPixel({ timestamp: ts, value: liq }) as Partial<Coordinate>).y ?? coordinates[0].y;

    const symbol = chart.getSymbol();
    const pricePrecision = symbol?.pricePrecision ?? 2;
    const label = formatWesternGrouped(liq, pricePrecision);
    const displayText = `Liq: ${label}`;
    const padL = labelStyle.paddingLeft!;
    const padR = labelStyle.paddingRight!;
    const labelBoxWidth = utils.calcTextWidth(displayText) + padL + padR;
    const marginLeft = 16;
    /** 标签右缘后再空出一段，避免线宽/抗锯齿压到边框 */
    const gapAfterLabel = 2;
    const lineStartX = marginLeft + labelBoxWidth + gapAfterLabel;

    return [
      {
        key: "liq-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: Math.min(lineStartX, bounding.width), y },
            { x: bounding.width, y },
          ],
        },
        styles: lineStyle(),
        ignoreEvent: true,
      },
      {
        key: "liq-label",
        type: "text",
        attrs: {
          x: marginLeft,
          y,
          text: displayText,
          align: "left",
          baseline: "middle",
        },
        styles: labelStyle,
        ignoreEvent: true,
      },
    ];
  },
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const liq = overlay.points[0]?.value;
    const precision = getPrecision(chart, overlay, yAxis);
    const emptyAxis = {
      type: "text" as const,
      attrs: { x: 0, y: coordinates[0].y, text: "", align: "right" as const, baseline: "middle" as const },
      styles: labelStyle,
    };
    if (liq === undefined || !Number.isFinite(liq)) {
      return emptyAxis;
    }
    if (!isLiquidationInVisibleYRange(chart, liq)) {
      return emptyAxis;
    }
    const last = chart.getDataList().at(-1);
    if (!last) {
      return emptyAxis;
    }
    const y =
      (chart.convertToPixel({ timestamp: last.timestamp, value: liq }) as Partial<Coordinate>).y ??
      coordinates[0].y;
    const isFromZero = yAxis?.isFromZero() ?? false;
    const text = formatWesternGrouped(liq, precision.price);
    return {
      type: "text",
      attrs: {
        x: isFromZero ? 0 : bounding.width,
        y,
        text,
        align: isFromZero ? "left" : "right",
        baseline: "middle",
      },
      styles: yAxisLabelStyle,
    };
  },
  onPressedMoveStart: () => false,
  onPressedMoving: () => false,
  onPressedMoveEnd: () => false,
  onMouseEnter: () => false,
  onMouseLeave: () => false,
  onSelected: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    event.overlay.mode = "normal";
    return false;
  },
  onRightClick: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    return false;
  },
});

export default liquidationLine;
