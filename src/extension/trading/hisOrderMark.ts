/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Coordinate, OverlayEvent, OverlayTemplate, TextStyle } from "klinecharts";

import type { HisOrder } from "../../types/types";

const BUY_COLOR = "#2ebd85";
const SELL_COLOR = "#f6465d";
const MARK_RADIUS = 6;
const MARK_OFFSET = 14;
const STACK_GAP = 14;

const HIS_ORDER_HOVER_EVENT = "klinecharts-pro-his-order-hover";
const overlayAnchorMap = new Map<string, { x: number; y: number }>();

const markerTextStyle: TextStyle = {
  style: "fill",
  size: 8,
  family: "Arial, sans-serif",
  weight: "bold",
  color: "#ffffff",
  backgroundColor: "transparent",
  borderColor: "transparent",
  borderStyle: "solid",
  borderSize: 0,
  borderDashedValue: [],
  borderRadius: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
};

const historicalOrderMark = (): OverlayTemplate => ({
  name: "historicalOrderMark",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, overlay }) => {
    const point = overlay.points[0];
    const ext = overlay.extendData as (HisOrder & { stackIndex?: number }) | undefined;
    if (!point || !ext || !Number.isFinite(point.timestamp) || typeof ext.isBuy !== "boolean") {
      return [];
    }
    const bar = chart.getDataList().find((item) => item.timestamp === point.timestamp);
    if (!bar || !Number.isFinite(bar.high) || !Number.isFinite(bar.low)) {
      return [];
    }
    const color = ext.isBuy ? BUY_COLOR : SELL_COLOR;
    const markText = ext.isBuy ? "B" : "S";
    const x = coordinates[0].x;
    const highY =
      (chart.convertToPixel({ timestamp: point.timestamp, value: bar.high }) as Partial<Coordinate>).y ??
      coordinates[0].y;
    const lowY =
      (chart.convertToPixel({ timestamp: point.timestamp, value: bar.low }) as Partial<Coordinate>).y ??
      coordinates[0].y;
    const stackIndex = Math.max(0, ext.stackIndex ?? 0);
    const y = ext.isBuy
      ? lowY + MARK_OFFSET + stackIndex * STACK_GAP
      : highY - MARK_OFFSET - stackIndex * STACK_GAP;
    if (overlay.id) {
      const paneDom = chart.getDom("candle_pane", "main");
      if (paneDom) {
        const rect = paneDom.getBoundingClientRect();
        overlayAnchorMap.set(overlay.id, { x: rect.left + x, y: rect.top + y });
      }
    }

    const figures: any[] = [
      {
        key: "his-order-dot",
        type: "circle",
        attrs: { x, y: y - 0.5, r: MARK_RADIUS },
        styles: { color },
        ignoreEvent: false,
      },
      {
        key: "his-order-char",
        type: "text",
        attrs: { x, y, text: markText, align: "center", baseline: "middle" },
        styles: markerTextStyle,
        ignoreEvent: false,
      },
    ];

    return figures;
  },
  onMouseEnter: (event: OverlayEvent<unknown>) => {
    const anyEvt = event as any;
    const mappedAnchor = event.overlay.id ? overlayAnchorMap.get(event.overlay.id) : undefined;
    const pointerX = mappedAnchor?.x ?? anyEvt?.event?.clientX ?? anyEvt?.mouseEvent?.clientX ?? null;
    const pointerY = mappedAnchor?.y ?? anyEvt?.event?.clientY ?? anyEvt?.mouseEvent?.clientY ?? null;
    const ext = event.overlay.extendData as (HisOrder & { stackIndex?: number }) | undefined;
    if (ext) {
      window.dispatchEvent(
        new CustomEvent(HIS_ORDER_HOVER_EVENT, {
          detail: { visible: true, order: ext, anchorX: pointerX, anchorY: pointerY },
        }),
      );
    }
    return false;
  },
  onMouseLeave: (event: OverlayEvent<unknown>) => {
    if (event.overlay.id) {
      overlayAnchorMap.delete(event.overlay.id);
    }
    window.dispatchEvent(
      new CustomEvent(HIS_ORDER_HOVER_EVENT, {
        detail: { visible: false, order: null, anchorX: null, anchorY: null },
      }),
    );
    return false;
  },
  onPressedMoveStart: () => false,
  onPressedMoving: () => false,
  onPressedMoveEnd: () => false,
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

export default historicalOrderMark;
