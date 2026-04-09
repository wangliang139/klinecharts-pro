import { Component, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import type { HisOrder } from "../../types/types";

export interface HisOrderHoverProps {
  order: HisOrder;
  formattedTime: string;
  anchorX?: number | null;
  anchorY?: number | null;
  /** 若传入，浮层限制在该元素可视矩形内（与 position:fixed 一致，使用 getBoundingClientRect） */
  clipElement?: HTMLElement | null;
}

const rowStyle = { display: "flex", "justify-content": "space-between", gap: "8px" } as const;
const valueStyle = { "text-align": "right" } as const;

/** 锚点（标记中心）到弹窗贴合角之间的轴向间距，与圆点半径配合可避免盖住标记 */
const ANCHOR_GAP_PX = 20;

type Quadrant = "topRight" | "bottomRight" | "bottomLeft" | "topLeft";

function rectFitsClip(
  left: number,
  top: number,
  w: number,
  h: number,
  boxLeft: number,
  boxTop: number,
  boxRight: number,
  boxBottom: number,
  margin: number,
): boolean {
  const minL = boxLeft + margin;
  const minT = boxTop + margin;
  const maxR = boxRight - margin;
  const maxB = boxBottom - margin;
  return left >= minL && top >= minT && left + w <= maxR && top + h <= maxB;
}

/** 与 hisOrderMark 圆点（r≈6）+ 少量余量，用于兜底布局时避免压住标记 */
function rectCoversMarker(
  left: number,
  top: number,
  w: number,
  h: number,
  anchorX: number,
  anchorY: number,
  markerRadius: number,
): boolean {
  const closestX = Math.max(left, Math.min(anchorX, left + w));
  const closestY = Math.max(top, Math.min(anchorY, top + h));
  const dx = anchorX - closestX;
  const dy = anchorY - closestY;
  return dx * dx + dy * dy < markerRadius * markerRadius;
}

/**
 * 四角候选（相对锚点）：右上 / 右下 / 左下 / 左上，贴合角与锚点轴向间隔 gap。
 * 依次过滤超出 clip 的候选；若均不可用则按同顺序做边界夹紧并尽量避免压住标记。
 */
function pickQuadrantPosition(
  anchorX: number,
  anchorY: number,
  w: number,
  h: number,
  boxLeft: number,
  boxTop: number,
  boxRight: number,
  boxBottom: number,
  margin: number,
  gap: number,
): { left: number; top: number } {
  const order: Quadrant[] = ["topRight", "bottomRight", "bottomLeft", "topLeft"];
  const candidates: Record<Quadrant, { left: number; top: number }> = {
    topRight: { left: anchorX + gap, top: anchorY - gap - h },
    bottomRight: { left: anchorX + gap, top: anchorY + gap },
    bottomLeft: { left: anchorX - gap - w, top: anchorY + gap },
    topLeft: { left: anchorX - gap - w, top: anchorY - gap - h },
  };

  for (const q of order) {
    const { left, top } = candidates[q];
    if (rectFitsClip(left, top, w, h, boxLeft, boxTop, boxRight, boxBottom, margin)) {
      return { left, top };
    }
  }

  const minL = boxLeft + margin;
  const minT = boxTop + margin;
  const maxL = boxRight - w - margin;
  const maxT = boxBottom - h - margin;
  const markerR = 8;
  for (const q of order) {
    const c = candidates[q];
    const left = Math.min(Math.max(minL, c.left), Math.max(minL, maxL));
    const top = Math.min(Math.max(minT, c.top), Math.max(minT, maxT));
    if (!rectCoversMarker(left, top, w, h, anchorX, anchorY, markerR)) {
      return { left, top };
    }
  }
  return {
    left: Math.min(Math.max(minL, candidates.topRight.left), Math.max(minL, maxL)),
    top: Math.min(Math.max(minT, candidates.topRight.top), Math.max(minT, maxT)),
  };
}

const HisOrderHover: Component<HisOrderHoverProps> = (props) => {
  const isBuy = () => props.order.isBuy;
  const panelWidthCss = 220;
  const [panelRef, setPanelRef] = createSignal<HTMLDivElement | undefined>();
  /** 首帧用估算值布局，挂载后由 DOM 测量覆盖 */
  const [measured, setMeasured] = createSignal({ w: panelWidthCss, h: 196 });

  createEffect(() => {
    props.order;
    props.formattedTime;
    const el = panelRef();
    if (!el) return;

    const apply = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setMeasured({ w: r.width, h: r.height });
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const margin = 12;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  const layout = createMemo(() => {
    const w = measured().w;
    const h = measured().h;
    const clip = props.clipElement?.getBoundingClientRect();
    const boxLeft = clip?.left ?? 0;
    const boxTop = clip?.top ?? 0;
    const boxRight = clip?.right ?? viewportW;
    const boxBottom = clip?.bottom ?? viewportH;
    const hasAnchor = typeof props.anchorX === "number" && typeof props.anchorY === "number";
    const anchorX = hasAnchor ? (props.anchorX as number) : boxRight - w - 16;
    const anchorY = hasAnchor ? (props.anchorY as number) : boxTop + 84;

    const pos = hasAnchor
      ? pickQuadrantPosition(
          anchorX,
          anchorY,
          w,
          h,
          boxLeft,
          boxTop,
          boxRight,
          boxBottom,
          margin,
          ANCHOR_GAP_PX,
        )
      : (() => {
          const minL = boxLeft + margin;
          const maxL = boxRight - w - margin;
          const minT = boxTop + margin;
          const maxT = boxBottom - h - margin;
          const rawLeft = boxRight - w - 16;
          const rawTop = boxTop + 84;
          return {
            left: Math.min(Math.max(minL, rawLeft), Math.max(minL, maxL)),
            top: Math.min(Math.max(minT, rawTop), Math.max(minT, maxT)),
          };
        })();

    return {
      left: pos.left,
      top: pos.top,
      anchorX,
      anchorY,
      hasAnchor,
      w,
      h,
    };
  });

  createEffect(() => {
    const L = layout();
    console.log("[HisOrderHover]", {
      orderId: props.order.orderId ?? props.order.id,
      hover: { x: L.anchorX, y: L.anchorY, hasAnchor: L.hasAnchor },
      popupSize: { width: L.w, height: L.h },
      popupPosition: { left: L.left, top: L.top },
    });
  });

  return (
    <div
      ref={setPanelRef}
      class={`klinecharts-pro-his-order-hover ${isBuy() ? "is-buy" : "is-sell"}`}
      style={{ left: `${layout().left}px`, top: `${layout().top}px` }}
    >
      <div class={`klinecharts-pro-his-order-hover-title ${isBuy() ? "is-buy" : "is-sell"}`}>
        {isBuy() ? "买入" : "卖出"}
      </div>
      <div style={rowStyle}><strong>订单ID：</strong><span style={valueStyle}>{String(props.order.orderId ?? props.order.id ?? "-")}</span></div>
      <div style={rowStyle}><strong>价格：</strong><span style={valueStyle}>{String(props.order.price)}</span></div>
      <div style={rowStyle}><strong>数量：</strong><span style={valueStyle}>{String(props.order.size)}</span></div>
      <div style={rowStyle}><strong>手续费：</strong><span style={valueStyle}>{String(props.order.fee ?? "-")}</span></div>
      <div style={rowStyle}><strong>已实现盈亏：</strong><span style={valueStyle}>{String(props.order.pnl ?? "-")}</span></div>
      <div style={rowStyle}><strong>成交时间：</strong><span style={valueStyle}>{props.formattedTime}</span></div>
    </div>
  );
};

export default HisOrderHover;
