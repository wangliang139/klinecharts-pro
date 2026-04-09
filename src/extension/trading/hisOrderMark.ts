/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Coordinate, OverlayEvent, OverlayTemplate, TextStyle } from "klinecharts";

import type { HisOrder } from "../../types/types";
import { HIS_ORDER_HOVER_EVENT } from "./constants";

const BUY_COLOR = "#2ebd85";
const SELL_COLOR = "#f6465d";
const MARK_RADIUS = 6;
const MARK_OFFSET = 14;
const STACK_GAP = 14;
/** K 线在屏幕上过“矮”时额外垫开标记与影线/实体的距离（含最新根与历史根） */
const LATEST_BAR_MIN_PIXEL_SPAN = 18;

const overlayAnchorMap = new Map<string, { x: number; y: number }>();
const overlayContainerMap = new Map<string, HTMLElement | null>();

function getEventContainer(event: OverlayEvent<unknown>): HTMLElement | null {
  if (!event.overlay.id) return null;
  return overlayContainerMap.get(event.overlay.id) ?? null;
}

function dispatchHisOrderHover(detail: {
  visible: boolean;
  order: HisOrderOverlayExtend | null;
  anchorX: number | null;
  anchorY: number | null;
  sourceContainer: HTMLElement | null;
}): void {
  const target: Window | HTMLElement = detail.sourceContainer ?? window;
  target.dispatchEvent(
    new CustomEvent(HIS_ORDER_HOVER_EVENT, {
      detail,
    }),
  );
}
type HisOrderOverlayExtend = HisOrder & {
  stackIndex?: number;
  barHigh?: number;
  barLow?: number;
};

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

const hisOrderMark = (): OverlayTemplate => ({
  name: "hisOrderMark",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, overlay }) => {
    const point = overlay.points[0];
    const ext = overlay.extendData as HisOrderOverlayExtend | undefined;
    if (!point || !ext || !Number.isFinite(point.timestamp) || typeof ext.isBuy !== "boolean") {
      return [];
    }
    const dataList = chart.getDataList();
    const barFromData = dataList.find((d) => d.timestamp === point.timestamp);
    let highValue: number | undefined;
    let lowValue: number | undefined;
    if (
      barFromData &&
      Number.isFinite(barFromData.high) &&
      Number.isFinite(barFromData.low)
    ) {
      highValue = barFromData.high;
      lowValue = barFromData.low;
    } else {
      highValue =
        typeof ext.barHigh === "number" && Number.isFinite(ext.barHigh) ? ext.barHigh : undefined;
      lowValue =
        typeof ext.barLow === "number" && Number.isFinite(ext.barLow) ? ext.barLow : undefined;
    }
    if (highValue === undefined || lowValue === undefined) {
      return [];
    }
    const color = ext.isBuy ? BUY_COLOR : SELL_COLOR;
    const markText = ext.isBuy ? "B" : "S";
    const x = coordinates[0].x;
    const highY =
      (chart.convertToPixel({ timestamp: point.timestamp, value: highValue }) as Partial<Coordinate>).y ??
      coordinates[0].y;
    const lowY =
      (chart.convertToPixel({ timestamp: point.timestamp, value: lowValue }) as Partial<Coordinate>).y ??
      coordinates[0].y;
    const stackIndex = Math.max(0, ext.stackIndex ?? 0);
    const barPixelSpan = Math.abs(lowY - highY);
    /** 任意 K 线在屏幕上过矮时都加垫距（含「刚不再是 lastBar」的前一根），避免与实体重叠 */
    const shortBarExtra =
      Number.isFinite(barPixelSpan) && barPixelSpan < LATEST_BAR_MIN_PIXEL_SPAN
        ? Math.max(0, LATEST_BAR_MIN_PIXEL_SPAN - barPixelSpan) * 0.65
        : 0;
    const markOffset = MARK_OFFSET + shortBarExtra;
    const y = ext.isBuy
      ? lowY + markOffset + stackIndex * STACK_GAP
      : highY - markOffset - stackIndex * STACK_GAP;
    if (overlay.id) {
      const paneDom = chart.getDom("candle_pane", "main");
      if (paneDom) {
        const rect = paneDom.getBoundingClientRect();
        overlayAnchorMap.set(overlay.id, { x: rect.left + x, y: rect.top + y });
        overlayContainerMap.set(overlay.id, paneDom.closest(".klinecharts-pro") as HTMLElement | null);
      }
    }

    const figures = [
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
        ignoreEvent: true,
      },
    ];

    return figures;
  },
  onMouseEnter: (event: OverlayEvent<unknown>) => {
    const eventSource = event as OverlayEvent<unknown> & {
      event?: { clientX?: number; clientY?: number };
      mouseEvent?: { clientX?: number; clientY?: number };
    };
    const mappedAnchor = event.overlay.id ? overlayAnchorMap.get(event.overlay.id) : undefined;
    const pointerX = mappedAnchor?.x ?? eventSource.event?.clientX ?? eventSource.mouseEvent?.clientX ?? null;
    const pointerY = mappedAnchor?.y ?? eventSource.event?.clientY ?? eventSource.mouseEvent?.clientY ?? null;
    const ext = event.overlay.extendData as HisOrderOverlayExtend | undefined;
    if (ext) {
      dispatchHisOrderHover({
        visible: true,
        order: ext,
        anchorX: pointerX,
        anchorY: pointerY,
        sourceContainer: getEventContainer(event),
      });
    }
    return false;
  },
  onMouseLeave: (event: OverlayEvent<unknown>) => {
    const sourceContainer = getEventContainer(event);
    if (event.overlay.id) {
      overlayAnchorMap.delete(event.overlay.id);
      overlayContainerMap.delete(event.overlay.id);
    }
    dispatchHisOrderHover({
      visible: false,
      order: null,
      anchorX: null,
      anchorY: null,
      sourceContainer,
    });
    return false;
  },
  onRemoved: (event: OverlayEvent<unknown>) => {
    if (event.overlay.id) {
      overlayAnchorMap.delete(event.overlay.id);
      overlayContainerMap.delete(event.overlay.id);
    }
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

export default hisOrderMark;
