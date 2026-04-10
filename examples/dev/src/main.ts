import type { AlertItem, AlertItemInput, HisOrder } from "@wangliang139/klinecharts-pro";
import { KLineChartPro } from "@wangliang139/klinecharts-pro";

import type { Order } from "./api";
import { createApiDatafeed } from "./apiDatafeed";
import { createApolloClient } from "./apollo";

import "./main.css";

const apolloClient = createApolloClient();
let chart: KLineChartPro;
let hisOrdersState: HisOrder[] = [];

function orderMergeKey(order: HisOrder): string {
  const id = String(order.id ?? "").trim();
  if (id) return `id:${id}`;
  const oid = String(order.orderId ?? "").trim();
  if (oid) return `oid:${oid}`;
  return `fallback:${order.timestamp}|${order.isBuy ? "B" : "S"}|${order.price}|${order.size}`;
}

function mergeHisOrders(existing: HisOrder[], incoming: HisOrder[]): HisOrder[] {
  const merged = new Map<string, HisOrder>();
  for (const item of existing) {
    merged.set(orderMergeKey(item), item);
  }
  for (const item of incoming) {
    merged.set(orderMergeKey(item), item);
  }
  return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function mapOrdersToHisOrders(orders: Order[]): HisOrder[] {
  const result: HisOrder[] = [];
  for (const o of orders) {
    const timestamp = Number(o.finishedTs || o.updatedTs || o.createdTs);
    const price = Number(o.avgPrice || o.price);
    const size = Number(o.executedQty || o.originalQty);
    const side: HisOrder["side"] = o.side === "short" ? "short" : "long";
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(size) || size <= 0) continue;
    result.push({
      id: o.clientOrderId || o.orderId,
      orderId: o.orderId,
      symbol: o.symbol,
      side,
      isBuy: !!o.isBuy,
      timestamp,
      price,
      size,
      fee: Number.isFinite(Number(o.fee)) ? Number(o.fee) : undefined,
      pnl: Number.isFinite(Number(o.realizedPnl)) ? Number(o.realizedPnl) : undefined,
    });
  }
  return result;
}

const datafeed = createApiDatafeed(apolloClient, {
  accountId: "2027981616834920448",
  onHisOrdersLoaded: (orders) => {
    const hisOrders = mapOrdersToHisOrders(orders);
    hisOrdersState = mergeHisOrders(hisOrdersState, hisOrders);
    console.log("[dev] onHisOrdersLoaded", { incoming: hisOrders.length, total: hisOrdersState.length });
    chart?.setHisOrders(hisOrdersState);
  },
});

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app 容器不存在");
}

root.innerHTML = '<div id="chart" class="chart-wrap"></div>';
const chartContainer = document.getElementById("chart");
if (!chartContainer) {
  throw new Error("#chart 容器不存在");
}

const lockPageScrollWhenInteractingChart = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};
chartContainer.addEventListener("wheel", lockPageScrollWhenInteractingChart, { passive: false });
chartContainer.addEventListener("touchmove", lockPageScrollWhenInteractingChart, { passive: false });

let alertSeq = 3;
let alertState: AlertItem[] = [
  {
    id: "alert-1",
    type: "price_reach",
    frequency: "repeat",
    price: "72000",
    remark: "示例：价格达到",
    symbol: "BTC/USDT:FUTURE",
  },
  {
    id: "alert-2",
    type: "price_rise_to",
    frequency: "once",
    price: 71000,
    remark: "示例：价格上涨至",
    symbol: "BTC/USDT:FUTURE",
  },
];

const normalizeAlert = (input: AlertItemInput): AlertItem => {
  const id = input.id?.trim() || `alert-${alertSeq++}`;
  return {
    ...input,
    id,
    symbol: input.symbol ?? "BTC/USDT:FUTURE",
  };
};

chart = new KLineChartPro({
  container: "chart",
  symbol: {
    ticker: "BTC/USDT:FUTURE",
    name: "BTC/USDT:FUTURE",
    shortName: "BTC/USDT:FUTURE",
    market: "binance",
    exchange: "binance",
    pricePrecision: 2,
    volumePrecision: 2,
    priceCurrency: "USDT",
    type: "crypto",
  },
  period: { span: 1, type: "minute", text: "1m" },
  periods: [
    { span: 1, type: "minute", text: "1m" },
    { span: 5, type: "minute", text: "5m" },
    { span: 15, type: "minute", text: "15m" },
    { span: 1, type: "hour", text: "1h" },
    { span: 4, type: "hour", text: "4h" },
    { span: 1, type: "day", text: "1d" },
  ],
  datafeed,
  theme: "light",
  locale: "zh-CN",
  drawingBarVisible: false,
  alerts: alertState,
  onAddAlert: async (payload) => {
    const alertItem = normalizeAlert(payload);
    alertState = [...alertState, alertItem];
    chart.setAlerts(alertState);
    console.log("[dev] onAddAlert", alertItem);
    return true;
  },
  onRemoveAlert: async (alertItem) => {
    alertState = alertState.filter((item) => item.id !== alertItem.id);
    chart.setAlerts(alertState);
    console.log("[dev] onRemoveAlert", alertItem);
    return true;
  },
});

chart.setStyles({
  candle: {
    tooltip: {
      title: { show: false, template: "{ticker} · {period}" },
    },
  },
});

setTimeout(() => {
  const api = chart.getInstanceApi();
  const list = api?.getDataList() ?? [];
  const last = list.at(-1);
  const close = typeof last?.close === "number" && Number.isFinite(last.close) ? last.close : 95000;
  chart.setPositions([
    { side: "long", avgPrice: close-100, size: 10 },
    { side: "short", avgPrice: close+100, size: 10 },
  ]);
  chart.setLiqPrice(70000);
  chart.setOpenOrders([
    { side: "long", isBuy: true, price: close - 200, size: 10 },
    { side: "short", isBuy: false, price: close + 200, size: 10 },
    { side: "short", isBuy: false, size: 10 , orderType: "market"},
  ]);
  chart.setAlerts(alertState);
}, 1000);

window.addEventListener("resize", () => {
  chart.resize();
});
