import { KLineChartPro } from "@wangliang139/klinecharts-pro";

import { createApiDatafeed } from "./apiDatafeed";
import { createApolloClient } from "./apollo";

import "./main.css";

const apolloClient = createApolloClient();
const datafeed = createApiDatafeed(apolloClient);

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

const chart = new KLineChartPro({
  container: "chart",
  symbol: {
    ticker: "BTC/USDT:FUTURE",
    name: "BTC/USDT:FUTURE",
    shortName: "BTC/USDT:FUTURE",
    market: "binance",
    exchange: "binance",
    pricePrecision: 4,
    volumePrecision: 4,
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
  theme: "dark",
  locale: "zh-CN",
  drawingBarVisible: false,
});

chart.setStyles({
  candle: {
    tooltip: {
      title: { show: false, template: "{ticker} · {period}" },
    },
  },
});

setTimeout(() => {
  console.log("style:", chart.getInstanceApi()?.getStyles());
  console.log("overlay:", chart.getInstanceApi()?.getOverlays());
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
  const rightBar = list.at(Math.max(0, list.length - 3));
  chart.setHisOrders([
    {
      id: "his-buy-1",
      orderId: "10001",
      isBuy: true,
      side: "long",
      timestamp: Date.now(),
      price: close - 120,
      size: 4,
      fee: 1.5,
      pnl: 36.2,
    },
    {
      id: "his-buy-2",
      orderId: "10002",
      isBuy: true,
      side: "long",
      timestamp: Date.now(),
      price: close - 120,
      size: 4,
      fee: 1.5,
      pnl: 36.2,
    },
    {
      id: "his-sell-1",
      orderId: "10002",
      isBuy: false,
      side: "short",
      timestamp: rightBar?.timestamp ?? Date.now(),
      price: close + 140,
      size: 3,
      fee: 1.2,
      pnl: -12.8,
    },
  ]);
}, 1000);

setTimeout(() => {
  const symbol = chart.getSymbol();
  chart.setSymbol({
    ...symbol,
    pricePrecision: 2,
    volumePrecision: 2,
  });
}, 2000);

window.addEventListener("resize", () => {
  chart.resize();
});
