import type { KLineData } from 'klinecharts'

import type {
  Datafeed,
  DatafeedSubscribeCallback,
  Period,
  SymbolInfo,
} from '@wangliang139/klinecharts-pro'

function periodToMs(period: Period): number {
  const { span, type } = period
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  switch (type) {
    case 'second':
      return span * 1000
    case 'minute':
      return span * minute
    case 'hour':
      return span * hour
    case 'day':
      return span * day
    case 'week':
      return span * 7 * day
    case 'month':
      return span * 30 * day
    case 'year':
      return span * 365 * day
    default:
      return minute
  }
}

function buildBar(
  timestamp: number,
  prevClose: number,
  seed: number,
): { bar: KLineData; close: number } {
  const drift = Math.sin(seed / 17) * (prevClose * 0.002)
  const noise = (Math.sin(seed / 7) + Math.cos(seed / 11)) * (prevClose * 0.003)
  const open = prevClose
  const close = Math.max(0.01, open + drift + noise)
  const high = Math.max(open, close) * (1 + Math.abs(Math.sin(seed)) * 0.004)
  const low = Math.min(open, close) * (1 - Math.abs(Math.cos(seed)) * 0.004)
  const volume = 1e6 + Math.abs(Math.sin(seed * 1.3)) * 5e5
  return {
    bar: {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    },
    close,
  }
}

/**
 * 不依赖外网的本地 Datafeed，用于在 examples/dev 里调试图表逻辑。
 */
export class MockDatafeed implements Datafeed {
  private _timer: ReturnType<typeof setInterval> | null = null

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const all: SymbolInfo[] = [
      {
        ticker: 'DEMO',
        name: '演示标的',
        shortName: 'DEMO',
        market: 'demo',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'stock',
      },
      {
        ticker: 'TEST',
        name: '测试标的',
        shortName: 'TEST',
        market: 'demo',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'stock',
      },
    ]
    const q = (search ?? '').trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        (s.name?.toLowerCase().includes(q) ?? false),
    )
  }

  async getHistoryKLineData(
    _symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number,
  ): Promise<KLineData[]> {
    const step = periodToMs(period)
    const list: KLineData[] = []
    let t = Math.floor(from / step) * step
    if (t < from) t += step
    let close = 100
    let seed = 0
    while (t <= to) {
      const { bar, close: next } = buildBar(t, close, seed++)
      list.push(bar)
      close = next
      t += step
    }
    return list
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback,
  ): void {
    this.unsubscribe(symbol, period)
    let close = 100 + Math.random() * 5
    let seed = 0
    const step = periodToMs(period)
    this._timer = setInterval(() => {
      const now = Date.now()
      const t = Math.floor(now / step) * step
      const { bar } = buildBar(t, close, seed++)
      close = bar.close!
      callback(bar, t)
    }, 2000)
  }

  unsubscribe(_symbol: SymbolInfo, _period: Period): void {
    if (this._timer != null) {
      clearInterval(this._timer)
      this._timer = null
    }
  }
}
