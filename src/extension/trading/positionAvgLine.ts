/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, TextStyle, utils } from "klinecharts";

import { getPrecision } from "../../helpers";
import type { TradingPositionSide } from "../../types/types";

const LONG_COLOR = "#2ebd85";
const SHORT_COLOR = "#f6465d";
const PNL_POSITIVE = "#2ebd85";
const PNL_NEGATIVE = "#f6465d";

type Extend = {
  side: TradingPositionSide;
  size: number;
  multiplier?: number;
};

const lineStyle = (color: string): LineStyle => ({
  style: "solid",
  size: 1,
  color,
  dashedValue: [],
});

const baseLabel = (color: string): TextStyle => ({
  style: "fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color,
  backgroundColor: "rgba(22, 26, 32, 0.72)",
  borderColor: "transparent",
  borderStyle: "solid",
  borderSize: 0,
  borderDashedValue: [],
  borderRadius: 2,
  paddingLeft: 6,
  paddingRight: 6,
  paddingTop: 2,
  paddingBottom: 2,
});

const positionAvgLine = (): OverlayTemplate => ({
  name: "positionAvgLine",
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const avgPrice = overlay.points[0]?.value;
    const ext = overlay.extendData as Extend | undefined;
    const last = chart.getDataList().at(-1);
    if (avgPrice === undefined || !ext || !last || !Number.isFinite(last.close)) {
      return [];
    }

    const ts = last.timestamp;
    const y = (chart.convertToPixel({ timestamp: ts, value: avgPrice }) as Partial<Coordinate>).y ?? coordinates[0].y;
    const mark = last.close;
    const mult = ext.multiplier ?? 1;
    const pnlRaw =
      ext.side === "long" ? (mark - avgPrice) * ext.size * mult : (avgPrice - mark) * ext.size * mult;

    const symbol = chart.getSymbol();
    const pricePrecision = symbol?.pricePrecision ?? 2;
    const volumePrecision = symbol?.volumePrecision ?? 4;
    const cur = symbol?.priceCurrency;
    const currency = typeof cur === "string" && cur ? `${cur.toUpperCase()} ` : "";

    const qtyText = utils.formatPrecision(ext.size, volumePrecision);
    const pnlText = `${pnlRaw >= 0 ? "+" : ""}${currency}${utils.formatPrecision(pnlRaw, pricePrecision)}`;

    const sideColor = ext.side === "long" ? LONG_COLOR : SHORT_COLOR;
    const pnlColor = pnlRaw >= 0 ? PNL_POSITIVE : PNL_NEGATIVE;

    const qtyStyle = baseLabel(sideColor);
    const pnlStyle = baseLabel(pnlColor);

    const pnlMarginRight = 8;
    const qtyMarginRight =
      pnlMarginRight + utils.calcTextWidth(pnlText) + pnlStyle.paddingLeft! + pnlStyle.paddingRight!;
    const lineMarginRight =
      qtyMarginRight + utils.calcTextWidth(qtyText) + qtyStyle.paddingLeft! + qtyStyle.paddingRight!;

    return [
      {
        key: "avg-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: Math.max(0, bounding.width - lineMarginRight), y },
          ],
        },
        styles: lineStyle(sideColor),
        ignoreEvent: true,
      },
      {
        key: "qty",
        type: "text",
        attrs: {
          x: bounding.width - qtyMarginRight,
          y,
          text: qtyText,
          align: "right",
          baseline: "middle",
        },
        styles: qtyStyle,
        ignoreEvent: true,
      },
      {
        key: "pnl",
        type: "text",
        attrs: {
          x: bounding.width - pnlMarginRight,
          y,
          text: pnlText,
          align: "right",
          baseline: "middle",
        },
        styles: pnlStyle,
        ignoreEvent: true,
      },
    ];
  },
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const avgPrice = overlay.points[0]?.value;
    const precision = getPrecision(chart, overlay, yAxis);
    if (avgPrice === undefined) {
      return {
        type: "text",
        attrs: { x: 0, y: coordinates[0].y, text: "", align: "right", baseline: "middle" },
        styles: baseLabel("#888"),
      };
    }
    const last = chart.getDataList().at(-1);
    const y =
      last && Number.isFinite(last.close)
        ? (chart.convertToPixel({ timestamp: last.timestamp, value: avgPrice }) as Partial<Coordinate>).y ??
          coordinates[0].y
        : coordinates[0].y;
    const isFromZero = yAxis?.isFromZero() ?? false;
    const text = utils.formatPrecision(avgPrice, precision.price);
    return {
      type: "text",
      attrs: {
        x: isFromZero ? 0 : bounding.width,
        y,
        text,
        align: isFromZero ? "left" : "right",
        baseline: "middle",
      },
      styles: baseLabel("#b7bdc6"),
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

export default positionAvgLine;
