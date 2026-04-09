import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, utils } from "klinecharts";

import { formatWesternGrouped } from "../../helpers";
import { AlertItem } from "../../types/types";
import { ALERT_DETAIL_OPEN_EVENT } from "./constants";
import { isPriceInVisibleCandleRange } from "./chartVisibleRange";

const ALERT_LINE_COLOR = "#bfbfbf";

type AlertExtendData = {
  alert: AlertItem;
  showInfo?: boolean;
};

const ALERT_HOVER_LEAVE_MS = 140;

const alertHoverHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getOverlayEventContainer(event: OverlayEvent<unknown>): HTMLElement | null {
  const paneDom = event.chart.getDom("candle_pane", "main");
  if (!paneDom) return null;
  return paneDom.closest(".klinecharts-pro") as HTMLElement | null;
}

function dispatchAlertDetailOpen(detail: { alert: AlertItem; sourceContainer: HTMLElement | null }): void {
  const target: Window | HTMLElement = detail.sourceContainer ?? window;
  target.dispatchEvent(
    new CustomEvent(ALERT_DETAIL_OPEN_EVENT, {
      detail,
    }),
  );
}

function clearAlertHoverHideTimer(overlayId: string) {
  const t = alertHoverHideTimers.get(overlayId);
  if (t != null) {
    clearTimeout(t);
    alertHoverHideTimers.delete(overlayId);
  }
}

function scheduleAlertHoverHide(chart: OverlayEvent<unknown>["chart"], overlayId: string) {
  clearAlertHoverHideTimer(overlayId);
  const t = setTimeout(() => {
    alertHoverHideTimers.delete(overlayId);
    const list = chart.getOverlays({ id: overlayId });
    const o = list[0];
    if (!o) return;
    const ext = o.extendData as AlertExtendData;
    chart.overrideOverlay({
      id: overlayId,
      extendData: { ...ext, showInfo: false },
    });
  }, ALERT_HOVER_LEAVE_MS);
  alertHoverHideTimers.set(overlayId, t);
}

function alertHoverFigureKey(key: string | undefined): boolean {
  return key === "alert-triangle" || key === "alert-info-text" || key === "alert-info-close";
}

let removeHandler: ((alertItem: AlertItem) => void) | undefined;

export function setPriceAlertOverlayHandlers(handlers: { onRemove?: (alertItem: AlertItem) => void }) {
  removeHandler = handlers.onRemove;
}

const alertLineStyle = (): LineStyle => ({
  style: "dashed",
  size: 1,
  color: "rgba(255, 255, 255, 1)",
  dashedValue: [4, 4],
});

function getAlertLineLabelText(alertItem: AlertItem, precision = 2): string {
  if (alertItem.type === "price_reach") return `价格达到 ${formatWesternGrouped(alertItem.price ?? 0, precision)}`;
  if (alertItem.type === "price_rise_to") return `价格涨到 ${formatWesternGrouped(alertItem.price ?? 0, precision)}`;
  if (alertItem.type === "price_fall_to") return `价格跌到 ${formatWesternGrouped(alertItem.price ?? 0, precision)}`;
  if (alertItem.type === "price_rise_pct_over") return `价格${alertItem.window ?? "5m"}涨幅 ${alertItem.percent ?? 0}%`;
  return `价格${alertItem.window ?? "5m"}跌幅 ${alertItem.percent ?? 0}%`;
}

const priceAlertLine = (): OverlayTemplate => ({
  name: "priceAlertLine",
  mode: "normal",
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const price = overlay.points[0]?.value;
    const ext = overlay.extendData as AlertExtendData | undefined;
    const alertItem = ext?.alert;
    const last = chart.getDataList().at(-1);
    if (price === undefined || !Number.isFinite(price) || !alertItem || !last) {
      return [];
    }
    if (!isPriceInVisibleCandleRange(chart, price)) {
      return [];
    }
    const y =
      (chart.convertToPixel({ timestamp: last.timestamp, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y;
    const precision = chart.getSymbol()?.pricePrecision ?? 2;
    const text = getAlertLineLabelText(alertItem, precision);
    const textW = utils.calcTextWidth(text);
    /** 等腰三角：底边在左，顶点贴齐主图画布右缘 */
    const triangleTipX = bounding.width;
    const triangleBaseX = triangleTipX - 10;
    const lineEndX = triangleBaseX - 2;
    const figures: any[] = [
      {
        key: "alert-line",
        type: "line",
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: lineEndX, y },
          ],
        },
        styles: alertLineStyle(),
        ignoreEvent: true,
      },
      {
        key: "alert-triangle",
        type: "polygon",
        attrs: {
          coordinates: [
            { x: triangleBaseX, y: y - 6 },
            { x: triangleTipX, y },
            { x: triangleBaseX, y: y + 6 },
          ],
        },
        styles: { style: "fill", color: ALERT_LINE_COLOR },
        ignoreEvent: false,
      },
    ];
    if (ext?.showInfo) {
      const boxW = Math.max(120, textW + 28);
      const boxX = Math.max(8, triangleBaseX - boxW - 10);
      figures.push(
        {
          key: "alert-info-text",
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
          key: "alert-info-close",
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
    if (!alertHoverFigureKey(key)) {
      return false;
    }
    clearAlertHoverHideTimer(event.overlay.id);
    const ext = (event.overlay.extendData ?? {}) as AlertExtendData;
    event.overlay.extendData = { ...ext, showInfo: true };
    return false;
  },
  onMouseLeave: (event: OverlayEvent<unknown>) => {
    const key = event.figure?.key;
    if (!alertHoverFigureKey(key)) {
      return false;
    }
    scheduleAlertHoverHide(event.chart, event.overlay.id);
    return false;
  },
  onRemoved: (event: OverlayEvent<unknown>) => {
    clearAlertHoverHideTimer(event.overlay.id);
    return false;
  },
  onSelected: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    event.overlay.mode = "normal";
    const ext = (event.overlay.extendData ?? {}) as AlertExtendData;
    const key = event.figure?.key ?? "";
    if (key === "alert-info-close") {
      if (ext.alert) {
        removeHandler?.(ext.alert);
      }
      return false;
    }
    return false;
  },
  onRightClick: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault();
    return false;
  },
  onDoubleClick: (event: OverlayEvent<unknown>) => {
    if (event.figure?.key !== "alert-info-text") {
      return false;
    }
    if (event.preventDefault) event.preventDefault();
    const ext = (event.overlay.extendData ?? {}) as AlertExtendData;
    if (!ext.alert) {
      return false;
    }
    dispatchAlertDetailOpen({
      alert: ext.alert,
      sourceContainer: getOverlayEventContainer(event),
    });
    return false;
  },
});

export default priceAlertLine;
