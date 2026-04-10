/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, TextStyle, utils } from "klinecharts";

import { formatWesternGrouped, getPrecision } from "../../helpers";
import i18n from "../../i18n";
import { isPriceInVisibleCandleRange } from "./chartVisibleRange";

const LONG_SIDE_COLOR = "#2ebd85";
const SHORT_SIDE_COLOR = "#f6465d";

/** 开多/平空为买（绿），开空/平多为卖（红） */
function buySellToLineColor(isBuy: boolean): string {
  return isBuy ? LONG_SIDE_COLOR : SHORT_SIDE_COLOR;
}

type Extend = {
  isBuy: boolean;
  size: number;
};

const lineStyleFor = (color: string): LineStyle => ({
  style: "dashed",
  size: 1,
  color,
  dashedValue: [4, 4],
});

const textLabel = (color: string): TextStyle => ({
  style: "stroke_fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color: "white",
  backgroundColor: color,
  borderColor: color,
  borderStyle: "solid",
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: [2, 0, 0, 2],
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 3,
  paddingBottom: 3,
});

const qtyLabel = (color: string): TextStyle => ({
  style: "stroke_fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color,
  backgroundColor: "white",
  borderColor: color,
  borderStyle: "solid",
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: [0, 2, 2, 0],
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 3,
  paddingBottom: 3,
});

/** 与 positionAvgLine Y 轴价签一致的底栏样式 */
const axisPriceBox = (color: string): TextStyle => ({
  style: "fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color: "white",
  backgroundColor: color,
  borderColor: color,
  borderStyle: "solid",
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: 2,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 3,
  paddingBottom: 3,
});

const pendingOrderLine = (): OverlayTemplate => ({
  name: "pendingOrderLine",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const price = overlay.points[0]?.value;
    const ext = overlay.extendData as Extend | undefined;
    const last = chart.getDataList().at(-1);
    if (price === undefined || !Number.isFinite(price) || !ext || !last) {
      return [];
    }
    if (!isPriceInVisibleCandleRange(chart, price)) {
      return [];
    }

    const ts = last.timestamp;
    const y = (chart.convertToPixel({ timestamp: ts, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y;

    const symbol = chart.getSymbol();
    const pricePrecision = symbol?.pricePrecision ?? 2;
    const volumePrecision = symbol?.volumePrecision ?? 4;

    const locale = chart.getLocale?.() ?? "zh-CN";
    const priceStr = i18n("order_limit", locale);
    const sizeStr = formatWesternGrouped(ext.size, volumePrecision);

    const lineColor = buySellToLineColor(ext.isBuy);
    const priceStyle = textLabel(lineColor);
    const sizeStyle = qtyLabel(lineColor);

    const padL = priceStyle.paddingLeft!;
    const padR = priceStyle.paddingRight!;
    const priceBoxW = utils.calcTextWidth(priceStr) + padL + padR;
    const sizeBoxW = utils.calcTextWidth(sizeStr) + padL + padR;
    const marginLeft = 16;
    const gapBetweenLabels = -1;
    const gapAfterLabels = 2;
    const sizeX = marginLeft + priceBoxW + gapBetweenLabels;
    const lineStartX = sizeX + sizeBoxW + gapAfterLabels;

    return [
      {
        key: "order-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: Math.min(lineStartX, bounding.width), y },
            { x: bounding.width, y },
          ],
        },
        styles: lineStyleFor(lineColor),
        ignoreEvent: true,
      },
      {
        key: "order-price",
        type: "text",
        attrs: {
          x: marginLeft,
          y,
          text: priceStr,
          align: "left",
          baseline: "middle",
        },
        styles: priceStyle,
        ignoreEvent: true,
      },
      {
        key: "order-size",
        type: "text",
        attrs: {
          x: sizeX,
          y,
          text: sizeStr,
          align: "left",
          baseline: "middle",
        },
        styles: sizeStyle,
        ignoreEvent: true,
      },
    ];
  },
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const price = overlay.points[0]?.value;
    const precision = getPrecision(chart, overlay, yAxis);
    const emptyAxis = {
      type: "text" as const,
      attrs: { x: 0, y: coordinates[0].y, text: "", align: "right" as const, baseline: "middle" as const },
      styles: axisPriceBox("#888"),
    };
    if (price === undefined || !Number.isFinite(price)) {
      return emptyAxis;
    }
    const ext = overlay.extendData as Extend | undefined;
    if (!ext) {
      return emptyAxis;
    }
    if (!isPriceInVisibleCandleRange(chart, price)) {
      return emptyAxis;
    }
    const lineColor = buySellToLineColor(ext.isBuy);
    const last = chart.getDataList().at(-1);
    if (!last) {
      return emptyAxis;
    }
    const y =
      (chart.convertToPixel({ timestamp: last.timestamp, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y;
    const isFromZero = yAxis?.isFromZero() ?? false;
    const text = formatWesternGrouped(price, precision.price);
    return {
      type: "text",
      attrs: {
        x: isFromZero ? 0 : bounding.width,
        y,
        text,
        align: isFromZero ? "left" : "right",
        baseline: "middle",
      },
      styles: axisPriceBox("#bfbfbf"),
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

export default pendingOrderLine;
