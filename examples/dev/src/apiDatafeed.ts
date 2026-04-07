import type { ApolloClient } from '@apollo/client'
import type { KLineData } from 'klinecharts'

import type {
  Datafeed,
  DatafeedSubscribeCallback,
  Period,
  SymbolInfo,
} from '@wangliang139/klinecharts-pro'

import { SUB_STREAM, queryKline, type Kline } from './api'

/** 空闲检测间隔：超过此时间未收到数据会触发重连 */
const IDLE_RECONNECT_MS = 50_000
/** 错误重连最大次数 */
const MAX_ERROR_RETRY = 10
/** 与 ChartDataLoader.adjustFromTo 的 count 对齐 */
const HISTORY_KLINE_LIMIT = 500

type StreamPayload = { data?: { Stream?: { kline?: Kline } } }
type SubscriptionHandle = { unsubscribe: () => void }
type ApolloSubClient = {
  subscribe(options: { query: unknown; variables: object }): {
    subscribe(handlers: {
      next: (v: StreamPayload) => void
      error: (e: unknown) => void
    }): SubscriptionHandle
  }
}

function klinesToKLineData(klines: Kline[]): KLineData[] {
  if (!Array.isArray(klines) || klines.length === 0) return []
  const byTime = new Map<number, KLineData>()
  for (const k of klines) {
    const ts = Number(k?.openTs)
    const open = Number(k?.open)
    const high = Number(k?.high)
    const low = Number(k?.low)
    const close = Number(k?.close)
    const volume = Number(k?.volume)
    const turnover = Number(k?.quoteVolume)
    if (!Number.isFinite(ts) || ts <= 0) continue
    if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) continue
    byTime.set(ts, {
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : undefined,
      turnover: Number.isFinite(turnover) ? turnover : undefined,
    })
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
}

function klineToKLineDataItem(k: Kline): KLineData | null {
  const ts = Number(k?.openTs)
  const open = Number(k?.open)
  const high = Number(k?.high)
  const low = Number(k?.low)
  const close = Number(k?.close)
  const volume = Number(k?.volume)
  const turnover = Number(k?.quoteVolume)
  if (!Number.isFinite(ts) || ts <= 0) return null
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return null
  return {
    timestamp: ts,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : undefined,
    turnover: Number.isFinite(turnover) ? turnover : undefined,
  }
}

function shouldSkipKlineByInterval(
  eventInterval: string | undefined,
  currentPeriod: string | undefined,
): boolean {
  const current = (currentPeriod ?? '').trim()
  const event = String(eventInterval ?? '').trim()
  if (!current || !event) return false
  if (event === current) return false
  console.warn('[ApiDatafeed] 跳过 interval 不匹配的 K 线事件', { eventInterval, currentInterval: currentPeriod })
  return true
}

/**
 * 使用 `queryKline` 拉历史 K 线、`SUB_STREAM` 推送更新；需配合 `createApolloClient()`。
 */
export function createApiDatafeed(apolloClient: ApolloClient): Datafeed {
  const client = apolloClient as unknown as ApolloSubClient

  let sub: SubscriptionHandle | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let lastReceiveTime = 0
  let currentCallback: DatafeedSubscribeCallback | null = null
  let isReconnecting = false
  let errorRetryCount = 0

  const snapshot: { exchange: string; symbol: string; period: string } = {
    exchange: '',
    symbol: '',
    period: '1m',
  }

  const doSubscribe = () => {
    if (!snapshot.exchange || !snapshot.symbol || !currentCallback) return
    const variables = {
      input: {
        type: 'kline' as const,
        exchange: snapshot.exchange,
        symbol: snapshot.symbol,
        interval: snapshot.period,
      },
    }
    const handle = client
      .subscribe({ query: SUB_STREAM, variables })
      .subscribe({
        next: (payload: StreamPayload) => {
          const nextKline = payload?.data?.Stream?.kline
          if (!nextKline) return
          if (shouldSkipKlineByInterval(nextKline.interval, snapshot.period)) return
          lastReceiveTime = Date.now()
          if (isReconnecting) {
            console.log('[ApiDatafeed] 重新订阅成功')
            isReconnecting = false
          }
          const item = klineToKLineDataItem(nextKline)
          if (item) currentCallback?.(item)
        },
        error: (e: unknown) => {
          console.error('[ApiDatafeed] 订阅失败', e)
          scheduleErrorReconnect()
        },
      })
    sub = handle
    lastReceiveTime = Date.now()
    errorRetryCount = 0
    startReconnectTimer()
  }

  const startReconnectTimer = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      if (!currentCallback) return
      const diff = Date.now() - lastReceiveTime
      if (diff >= IDLE_RECONNECT_MS) {
        console.log('[ApiDatafeed] 长时间未收到数据，尝试重新订阅...')
        isReconnecting = true
        resubscribe()
      } else {
        startReconnectTimer()
      }
    }, IDLE_RECONNECT_MS)
  }

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    errorRetryCount = 0
  }

  const scheduleErrorReconnect = () => {
    if (!currentCallback) return
    if (errorRetryCount >= MAX_ERROR_RETRY) {
      console.warn('[ApiDatafeed] 订阅多次重试失败，停止自动重连')
      return
    }
    errorRetryCount += 1
    const delay = Math.min(1000 * 2 ** (errorRetryCount - 1), IDLE_RECONNECT_MS)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    console.warn(`[ApiDatafeed] 订阅断开，${delay}ms 后第 ${errorRetryCount} 次重试`)
    reconnectTimer = setTimeout(() => {
      if (!currentCallback) return
      isReconnecting = true
      resubscribe()
    }, delay)
  }

  const resubscribe = () => {
    if (sub) {
      try {
        sub.unsubscribe()
      } catch {
        /* ignore */
      }
      sub = null
    }
    doSubscribe()
  }

  return {
    searchSymbols(search?: string): Promise<SymbolInfo[]> {
      const exchange = import.meta.env.VITE_KLINE_EXCHANGE ?? 'binance'
      const ticker = import.meta.env.VITE_KLINE_SYMBOL ?? 'BTC/USDT:FUTURE'
      const all: SymbolInfo[] = [
        {
          ticker,
          name: ticker,
          shortName: ticker,
          market: exchange,
          exchange,
          pricePrecision: 2,
          volumePrecision: 2,
          priceCurrency: 'USDT',
          type: 'crypto',
        },
      ]
      const q = (search ?? '').trim().toUpperCase()
      if (!q) return Promise.resolve(all)
      return Promise.resolve(all.filter((s) => s.ticker.toUpperCase().includes(q)))
    },

    async getHistoryKLineData(
      symbol: SymbolInfo,
      period: Period,
      from: number,
      to: number,
    ): Promise<KLineData[]> {
      console.log('[ApiDatafeed] getHistoryKLineData', symbol, period, from, to)
      if (from >= to) return []
      const exchange = symbol.exchange ?? symbol.market
      const sym = symbol.ticker
      if (!exchange || !sym) return []
      const interval = period.text || '1m'

      try {
        const history = await queryKline({
          exchange,
          symbol: sym,
          interval,
          startTime: from,
          endTime: to,
          limit: HISTORY_KLINE_LIMIT,
        })
        const list = klinesToKLineData(history)
        if (list.length === 0) return []
        const filtered = list.filter((d) => d.timestamp >= from && d.timestamp <= to)
        return filtered.length > 0 ? filtered : list
      } catch (e: unknown) {
        console.error('[ApiDatafeed] 加载历史 K 线失败', e)
        return []
      }
    },

    subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
      console.log('[ApiDatafeed] subscribe', symbol, period, callback)
      this.unsubscribe(symbol, period)

      const exchange = symbol.exchange ?? symbol.market
      const sym = symbol.ticker
      if (!exchange || !sym) return

      snapshot.exchange = exchange
      snapshot.symbol = sym
      snapshot.period = period.text || '1m'

      currentCallback = callback
      lastReceiveTime = Date.now()
      isReconnecting = false
      clearReconnectTimer()

      doSubscribe()
    },

    unsubscribe(_symbol: SymbolInfo, _period: Period): void {
      clearReconnectTimer()
      currentCallback = null
      if (sub) {
        try {
          sub.unsubscribe()
        } catch (e) {
          console.error('[ApiDatafeed] unsubscribe error', e)
        }
        sub = null
      }
    },
  }
}
