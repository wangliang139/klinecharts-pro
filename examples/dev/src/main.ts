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

const chart = new KLineChartPro({
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
}, 1500);

window.addEventListener("resize", () => {
  chart.resize();
});
