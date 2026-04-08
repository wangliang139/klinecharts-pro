import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, utils } from "klinecharts";

import { formatWesternGrouped } from "../../helpers";
import { WarningItem } from "../../types/types";
import { isPriceInVisibleCandleRange } from "./chartVisibleRange";

const WARNING_COLOR = "#bfbfbf";

type WarningExtendData = {
  warning: WarningItem;
  showInfo?: boolean;
};

const WARNING_HOVER_LEAVE_MS = 140;

const warningHoverHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearWarningHoverHideTimer(overlayId: string) {
  const t = warningHoverHideTimers.get(overlayId);
  if (t != null) {
    clearTimeout(t);
    warningHoverHideTimers.delete(overlayId);
  }
}

function scheduleWarningHoverHide(chart: OverlayEvent<unknown>["chart"], overlayId: string) {
  clearWarningHoverHideTimer(overlayId);
  const t = setTimeout(() => {
    warningHoverHideTimers.delete(overlayId);
    const list = chart.getOverlays({ id: overlayId });
    const o = list[0];
    if (!o) return;
    const ext = o.extendData as WarningExtendData;
    chart.overrideOverlay({
      id: overlayId,
      extendData: { ...ext, showInfo: false },
    });
  }, WARNING_HOVER_LEAVE_MS);
  warningHoverHideTimers.set(overlayId, t);
}

function warningHoverFigureKey(key: string | undefined): boolean {
  return key === "warning-triangle" || key === "warning-info-text" || key === "warning-info-close";
}

let removeHandler: ((warning: WarningItem) => void) | undefined;

export function setPriceWarningOverlayHandlers(handlers: { onRemove?: (warning: WarningItem) => void }) {
  removeHandler = handlers.onRemove;
}

const warningLineStyle = (): LineStyle => ({
  style: "dashed",
  size: 1,
  color: "rgba(255, 255, 255, 1)",
  dashedValue: [4, 4],
});

function getWarningText(warning: WarningItem, precision = 2): string {
  if (warning.type === "price_reach") return `价格达到 ${formatWesternGrouped(warning.price ?? 0, precision)}`;
  if (warning.type === "price_rise_to") return `价格涨到 ${formatWesternGrouped(warning.price ?? 0, precision)}`;
  if (warning.type === "price_fall_to") return `价格跌到 ${formatWesternGrouped(warning.price ?? 0, precision)}`;
  if (warning.type === "price_rise_pct_over") return `价格${warning.window ?? "5m"}涨幅 ${warning.percent ?? 0}%`;
  return `价格${warning.window ?? "5m"}跌幅 ${warning.percent ?? 0}%`;
}

const priceWarningLine = (): OverlayTemplate => ({
  name: "priceWarningLine",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const price = overlay.points[0]?.value;
    const ext = overlay.extendData as WarningExtendData | undefined;
    const warning = ext?.warning;
    const last = chart.getDataList().at(-1);
    if (price === undefined || !Number.isFinite(price) || !warning || !last) {
      return [];
    }
    if (!isPriceInVisibleCandleRange(chart, price)) {
      return [];
    }
    const y =
      (chart.convertToPixel({ timestamp: last.timestamp, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y;
    const precision = chart.getSymbol()?.pricePrecision ?? 2;
    const text = getWarningText(warning, precision);
    const textW = utils.calcTextWidth(text);
    /** 等腰三角：底边在左，顶点贴齐主图画布右缘 */
    const triangleTipX = bounding.width;
    const triangleBaseX = triangleTipX - 10;
    const lineEndX = triangleBaseX - 2;
    const figures: any[] = [
      {
        key: "warning-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: lineEndX, y },
          ],
        },
        styles: warningLineStyle(),
        ignoreEvent: true,
      },
      {
        key: "warning-triangle",
        type: "polygon",
        attrs: {
          coordinates: [
            { x: triangleBaseX, y: y - 6 },
            { x: triangleTipX, y },
            { x: triangleBaseX, y: y + 6 },
          ],
        },
        styles: { style: "fill", color: WARNING_COLOR },
        ignoreEvent: false,
      },
    ];
    if (ext?.showInfo) {
      const boxW = Math.max(120, textW + 28);
      const boxX = Math.max(8, triangleBaseX - boxW - 10);
      figures.push(
        {
          key: "warning-info-text",
          type: "text",
          attrs: {
            x: boxX + 8,
            y,
            text,
            align: "left",
            baseline: "middle",
          },
          styles: {
            style: "stroke_fill",
            size: 12,
            family: "Arial, sans-serif",
            weight: "normal",
            color: "#fff",
            backgroundColor: "rgba(56, 56, 56, 0.92)",
            borderColor: "rgba(56, 56, 56, 0.92)",
            borderStyle: "solid",
            borderSize: 1,
            borderDashedValue: [],
            borderRadius: 3,
            paddingLeft: 8,
            paddingRight: 24,
            paddingTop: 4,
            paddingBottom: 4,
          },
          ignoreEvent: false,
        },
        {
          key: "warning-info-close",
          type: "text",
          attrs: {
            x: boxX + boxW - 0,
            y,
            text: "×",
            fontFamily: "Apple Color Emoji",
            align: "center",
            baseline: "middle",
          },
          styles: {
            style: "fill",
            size: 18,
            family: "Arial, sans-serif",
            color: "#fff",
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
          },
          ignoreEvent: false,
        },
      );
    }
    return figures;
  },
  onPressedMoveStart: () => false,
  onPressedMoving: () => false,
  onPressedMoveEnd: () => false,
  onMouseEnter: (event: OverlayEvent<unknown>) => {
    const key = event.figure?.key;
    if (!warningHoverFigureKey(key)) {
      return false;
    }
    clearWarningHoverHideTimer(event.overlay.id);
    const ext = (event.overlay.extendData ?? {}) as WarningExtendData;
    event.overlay.extendData = { ...ext, showInfo: true };
    return false;
  },
  onMouseLeave: (event: OverlayEvent<unknown>) => {
    const key = event.figure?.key;
    if (!warningHoverFigureKey(key)) {
      return false;
    }
    scheduleWarningHoverHide(event.chart, event.overlay.id);
    return false;
  },
  onRemoved: (event: OverlayEvent<unknown>) => {
    clearWarningHoverHideTimer(event.overlay.id);
    return false;
  },
  onSelected: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    event.overlay.mode = "normal";
    const ext = (event.overlay.extendData ?? {}) as WarningExtendData;
    const key = event.figure?.key ?? "";
    if (key === "warning-info-close") {
      if (ext.warning) {
        removeHandler?.(ext.warning);
      }
      return false;
    }
    return false;
  },
  onRightClick: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    return false;
  },
});

export default priceWarningLine;
