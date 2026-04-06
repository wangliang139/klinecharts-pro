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
    name: '演示标的',
    shortName: 'DEMO',
    market: 'demo',
    pricePrecision: 2,
    volumePrecision: 0,
    priceCurrency: 'USD',
    type: 'stock',
  },
  period: { span: 1, type: 'minute', text: '1m' },
  datafeed: new MockDatafeed(),
  theme: 'light',
  locale: 'zh-CN',
  drawingBarVisible: true,
})

window.addEventListener('resize', () => {
  chart.resize()
})
