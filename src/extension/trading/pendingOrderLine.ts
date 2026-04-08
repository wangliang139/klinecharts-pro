/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, TextStyle, utils } from "klinecharts";

import { formatWesternGrouped } from "../../helpers";
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

const labelStyleFor = (color: string): TextStyle => ({
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
  borderRadius: 2,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 4,
  paddingBottom: 4,
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

    const priceStr = formatWesternGrouped(price, pricePrecision);
    const sizeStr = formatWesternGrouped(ext.size, volumePrecision);
    const displayText = `${priceStr} / ${sizeStr}`;

    const lineColor = buySellToLineColor(ext.isBuy);
    const ls = labelStyleFor(lineColor);

    const padL = ls.paddingLeft!;
    const padR = ls.paddingRight!;
    const labelBoxWidth = utils.calcTextWidth(displayText) + padL + padR;
    const marginLeft = 16;
    const gapAfterLabel = 2;
    const lineStartX = marginLeft + labelBoxWidth + gapAfterLabel;

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
        key: "order-label",
        type: "text",
        attrs: {
          x: marginLeft,
          y,
          text: displayText,
          align: "left",
          baseline: "middle",
        },
        styles: ls,
        ignoreEvent: true,
      },
    ];
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
