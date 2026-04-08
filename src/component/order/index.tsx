import { Component } from "solid-js";

import type { HisOrder } from "../../types/types";

export interface HisOrderHoverProps {
  order: HisOrder;
  formattedTime: string;
  anchorX?: number | null;
  anchorY?: number | null;
}

const rowStyle = { display: "flex", "justify-content": "space-between", gap: "8px" } as const;
const valueStyle = { "text-align": "right" } as const;

const HisOrderHover: Component<HisOrderHoverProps> = (props) => {
  const isBuy = () => props.order.isBuy;
  const panelWidth = 220;
  const panelHeight = 196;
  const margin = 12;
  const offset = 12;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;
  const hasAnchor = typeof props.anchorX === "number" && typeof props.anchorY === "number";
  const anchorX = hasAnchor ? (props.anchorX as number) : viewportW - panelWidth - 16;
  const anchorY = hasAnchor ? (props.anchorY as number) : 84;

  const rightSpace = viewportW - anchorX - margin;
  const leftSpace = anchorX - margin;
  const bottomSpace = viewportH - anchorY - margin;
  const topSpace = anchorY - margin;

  const placeRight = rightSpace >= panelWidth + offset || rightSpace >= leftSpace;
  const placeBottom = bottomSpace >= panelHeight + offset || bottomSpace >= topSpace;

  const rawLeft = placeRight ? anchorX + offset : anchorX - panelWidth - offset;
  const rawTop = placeBottom ? anchorY + offset : anchorY - panelHeight - offset;

  const left = Math.min(Math.max(margin, rawLeft), viewportW - panelWidth - margin);
  const top = Math.min(Math.max(margin, rawTop), viewportH - panelHeight - margin);
  return (
    <div class={`klinecharts-pro-his-order-hover ${isBuy() ? "is-buy" : "is-sell"}`} style={{ left: `${left}px`, top: `${top}px` }}>
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
