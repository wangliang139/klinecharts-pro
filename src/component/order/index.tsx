import { Component } from "solid-js";

import type { HisOrder } from "../../types/types";

export interface HisOrderHoverProps {
  order: HisOrder;
  formattedTime: string;
}

const rowStyle = { display: "flex", "justify-content": "space-between", gap: "8px" } as const;
const valueStyle = { "text-align": "right" } as const;

const HisOrderHover: Component<HisOrderHoverProps> = (props) => {
  const isBuy = () => props.order.isBuy;
  return (
    <div class={`klinecharts-pro-his-order-hover ${isBuy() ? "is-buy" : "is-sell"}`}>
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
