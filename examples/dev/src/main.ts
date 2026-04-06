import { KLineChartPro } from '@wangliang139/klinecharts-pro'

import { MockDatafeed } from './mockDatafeed'

import './main.css'

const root = document.getElementById('app')
if (!root) {
  throw new Error('#app 容器不存在')
}

root.innerHTML = '<div id="chart" class="chart-wrap"></div>'

const chart = new KLineChartPro({
  container: 'chart',
  symbol: {
    ticker: 'DEMO',
    // name: '演示标的',
    // shortName: 'DEMO',
    market: 'demo',
    pricePrecision: 2,
    volumePrecision: 0,
    priceCurrency: 'USD',
    type: 'stock',
  },
  period: { span: 1, type: 'minute', text: '1m' },
  periods: [
    { span: 1, type: 'minute', text: '1m' },
    { span: 5, type: 'minute', text: '5m' },
    { span: 15, type: 'minute', text: '15m' },
    { span: 1, type: 'hour', text: '1H' },
    { span: 2, type: 'hour', text: '2H' },
    { span: 4, type: 'hour', text: '4H' },
  ],
  datafeed: new MockDatafeed(),
  theme: 'dark',
  locale: 'zh-CN',
  drawingBarVisible: false,
})

chart.setStyles({
  candle: {
    tooltip: {
      title: {show: true, template: '{ticker} · {period}'},
    },
  },
})

setTimeout(() => {
  console.log(chart.getInstanceApi()?.getStyles())
}, 1000)

window.addEventListener('resize', () => {
  chart.resize()
})
