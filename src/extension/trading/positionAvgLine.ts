/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, TextStyle, utils } from "klinecharts";

import { formatWesternGrouped, getPrecision } from "../../helpers";
import type { PositionSide } from "../../types/types";

const LONG_COLOR = "#2ebd85";
const SHORT_COLOR = "#f6465d";
const PNL_POSITIVE = "#2ebd85";
const PNL_NEGATIVE = "#f6465d";

type Extend = {
  side: PositionSide;
  size: number;
  multiplier?: number;
};

const lineStyle = (color: string): LineStyle => ({
  style: "solid",
  size: 1,
  color,
  dashedValue: [],
});

/** 与 positionAvgLine Y 轴价签一致的底栏样式 */
const axisPriceBox = (color: string): TextStyle => ({
  style: "stroke_fill",
  size: 12,
  family: "Arial, sans-serif",
  weight: "normal",
  color: color,
  backgroundColor: "rgba(255,255,255,0.75)",
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

const pnlLabel = (color: string): TextStyle => ({
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
  paddingTop: 4,
  paddingBottom: 4,
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
  paddingTop: 4,
  paddingBottom: 4,
});

const positionAvgLine = (): OverlayTemplate => ({
  name: "positionAvgLine",
  totalStep: 1,
  mode: "normal",
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
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
    const pnlRaw = ext.side === "long" ? (mark - avgPrice) * ext.size * mult : (avgPrice - mark) * ext.size * mult;

    const symbol = chart.getSymbol();
    const pricePrecision = symbol?.pricePrecision ?? 2;
    const volumePrecision = symbol?.volumePrecision ?? 4;

    const qtyText = formatWesternGrouped(ext.size, volumePrecision);
    const pnlText = `PNL ${pnlRaw >= 0 ? "+" : ""}${formatWesternGrouped(pnlRaw, pricePrecision)}`;

    const sideColor = ext.side === "long" ? LONG_COLOR : SHORT_COLOR;
    const pnlColor = pnlRaw >= 0 ? PNL_POSITIVE : PNL_NEGATIVE;

    const qtyStyle = qtyLabel(sideColor);
    const pnlStyle = pnlLabel(pnlColor);

    const padL = qtyStyle.paddingLeft!;
    const padR = qtyStyle.paddingRight!;
    const qtyBoxW = utils.calcTextWidth(qtyText) + padL + padR;
    const pnlBoxW = utils.calcTextWidth(pnlText) + padL + padR;
    const marginLeft = 16;
    const gapBetweenLabels = -1;
    const gapAfterLabels = 0;
    const qtyX = marginLeft + pnlBoxW + gapBetweenLabels;
    const lineStartX = qtyX + qtyBoxW + gapAfterLabels;

    return [
      {
        key: "avg-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: Math.min(lineStartX, bounding.width), y },
            { x: bounding.width, y },
          ],
        },
        styles: lineStyle(sideColor),
        ignoreEvent: true,
      },
      {
        key: "pnl",
        type: "text",
        attrs: {
          x: marginLeft,
          y,
          text: pnlText,
          align: "left",
          baseline: "middle",
        },
        styles: pnlStyle,
        ignoreEvent: true,
      },
      {
        key: "qty",
        type: "text",
        attrs: {
          x: qtyX,
          y,
          text: qtyText,
          align: "left",
          baseline: "middle",
        },
        styles: qtyStyle,
        ignoreEvent: true,
      },
    ];
  },
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const avgPrice = overlay.points[0]?.value;
    const ext = overlay.extendData as Extend | undefined;
    const precision = getPrecision(chart, overlay, yAxis);
    if (avgPrice === undefined|| !ext) {
      return {
        type: "text",
        attrs: { x: 0, y: coordinates[0].y, text: "", align: "right", baseline: "middle" },
        styles: axisPriceBox("#888"),
      };
    }
    const lineColor = ext.side === "long" ? LONG_COLOR : SHORT_COLOR;
    const last = chart.getDataList().at(-1);
    const y =
      last && Number.isFinite(last.close)
        ? ((chart.convertToPixel({ timestamp: last.timestamp, value: avgPrice }) as Partial<Coordinate>).y ??
          coordinates[0].y)
        : coordinates[0].y;
    const isFromZero = yAxis?.isFromZero() ?? false;
    const text = formatWesternGrouped(avgPrice, precision.price);
    return {
      type: "text",
      attrs: {
        x: isFromZero ? 0 : bounding.width,
        y,
        text,
        align: isFromZero ? "left" : "right",
        baseline: "middle",
      },
      styles: axisPriceBox(lineColor),
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
