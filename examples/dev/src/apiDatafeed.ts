import type { ApolloClient } from '@apollo/client/core'
import type { KLineData } from 'klinecharts'

import type {
  Datafeed,
  DatafeedSubscribeCallback,
  Period,
  SymbolInfo,
} from '@wangliang139/klinecharts-pro'

import { Order, SUB_STREAM, getOrders, queryKline, type Kline } from './api'

/** 空闲检测间隔：超过此时间未收到数据会触发重连 */
const IDLE_RECONNECT_MS = 50_000
/** 错误重连最大次数 */
const MAX_ERROR_RETRY = 10
/** 与 ChartDataLoader.adjustFromTo 的 count 对齐 */
const HISTORY_KLINE_LIMIT = 300

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

type ApiDatafeedOptions = {
  accountId?: string
  onHisOrdersLoaded?: (orders: Order[]) => void
  hisOrdersPageSize?: number
  hisOrdersMaxPages?: number
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

/** 与 Apollo `isApolloError` 一致，避免从 Vite 预构建的 `@apollo/client` 入口取 `ApolloError` 时缺失导出 */
function isApolloLikeError(
  e: unknown,
): e is {
  graphQLErrors?: ReadonlyArray<{ message?: string; extensions?: Record<string, unknown> }>
  networkError?: { statusCode?: number }
} {
  return typeof e === 'object' && e !== null && Object.prototype.hasOwnProperty.call(e, 'graphQLErrors')
}

/** graphql-ws 关闭码 4401=未授权；HTTP 401/403；GraphQL extensions.code */
function isLikelyAuthFailure(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = Number((e as { code: number }).code)
    if (code === 4401 || code === 4403 || code === 401 || code === 403) return true
  }

  if (isApolloLikeError(e)) {
    for (const err of e.graphQLErrors ?? []) {
      const ext = String(err.extensions?.code ?? '').toUpperCase()
      if (ext === 'UNAUTHENTICATED' || ext === 'FORBIDDEN') return true
      const m = (err.message ?? '').toLowerCase()
      if (m.includes('unauthenticated') || m.includes('unauthorized')) return true
      if (
        (m.includes('token') || m.includes('jwt')) &&
        (m.includes('expir') || m.includes('invalid') || m.includes('revoked'))
      )
        return true
    }
    const ne = e.networkError
    if (ne?.statusCode === 401 || ne?.statusCode === 403) return true
  }

  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (!msg) return false
  const lower = msg.toLowerCase()
  if (/\b4401\b/.test(msg) || /\b4403\b/.test(msg) || /\b401\b/.test(msg) || /\b403\b/.test(msg)) return true
  if (lower.includes('unauthorized') || lower.includes('unauthenticated')) return true
  if (
    (lower.includes('token') || lower.includes('jwt')) &&
    (lower.includes('expir') || lower.includes('invalid') || lower.includes('revoked'))
  )
    return true
  if (lower.includes('认证') && (lower.includes('失败') || lower.includes('无效'))) return true
  if (lower.includes('未授权')) return true
  return false
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
export function createApiDatafeed(apolloClient: ApolloClient, options: ApiDatafeedOptions = {}): Datafeed {
  const client = apolloClient as unknown as ApolloSubClient
  const accountId = options.accountId
  const hisOrdersPageSize = Math.max(1, Math.min(options.hisOrdersPageSize ?? 200, 500))
  const hisOrdersMaxPages = Math.max(1, options.hisOrdersMaxPages ?? 10)
  
  let sub: SubscriptionHandle | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let lastReceiveTime = 0
  let currentCallback: DatafeedSubscribeCallback | null = null
  let isReconnecting = false
  let errorRetryCount = 0
  let hisOrdersRequestSeq = 0
  /** Token 等认证被拒后不再自动重连/空闲重连，直至用户再次 subscribe */
  let fatalAuthError = false

  const snapshot: { exchange: string; symbol: string; period: string } = {
    exchange: '',
    symbol: '',
    period: '1m',
  }

  const loadHisOrders = async (symbol: string, from: number, to: number) => {
    if (!accountId || !symbol) return
    const requestId = ++hisOrdersRequestSeq
    const rangeFrom = Math.floor(Number(from))
    const rangeTo = Math.floor(Number(to))
    if (!Number.isFinite(rangeFrom) || !Number.isFinite(rangeTo) || rangeFrom >= rangeTo) return
    try {
      const merged: Order[] = []
      for (let page = 1; page <= hisOrdersMaxPages; page++) {
        const conn = await getOrders({
          accountId,
          symbol,
          includeFinished: true,
          finishedStartTsMs: rangeFrom,
          finishedEndTsMs: rangeTo,
          page,
          size: hisOrdersPageSize,
        })
        // 避免慢请求覆盖新周期/新品种的结果
        if (requestId !== hisOrdersRequestSeq) return
        const batch = conn?.list ?? []
        merged.push(...batch)
        const total = Number(conn?.totalCount) || 0
        if (merged.length >= total || batch.length < hisOrdersPageSize) break
      }
      if (requestId !== hisOrdersRequestSeq) return
      options.onHisOrdersLoaded?.(merged)
    } catch (err) {
      console.warn('[ApiDatafeed] 加载历史订单失败', err)
    }
  }

  const doSubscribe = () => {
    if (fatalAuthError || !snapshot.exchange || !snapshot.symbol || !currentCallback) return
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
          errorRetryCount = 0
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
          if (isLikelyAuthFailure(e)) {
            fatalAuthError = true
            if (reconnectTimer) {
              clearTimeout(reconnectTimer)
              reconnectTimer = null
            }
            try {
              sub?.unsubscribe()
            } catch {
              /* ignore */
            }
            sub = null
            console.warn(
              '[ApiDatafeed] 服务端拒绝认证（Bearer 无效或已过期）。已停止自动重试；请更新 VITE_GRAPHQL_AUTH_TOKEN 后刷新页面或重新订阅。',
            )
            return
          }
          scheduleErrorReconnect()
        },
      })
    sub = handle
    lastReceiveTime = Date.now()
    startReconnectTimer()
  }

  const startReconnectTimer = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      if (!currentCallback || fatalAuthError) return
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
    if (!currentCallback || fatalAuthError) return
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
      const all: SymbolInfo[] = [
        {
          ticker: 'BTC/USDT:FUTURE',
          name: 'BTC/USDT:FUTURE',
          shortName: 'BTC/USDT:FUTURE',
          market: 'binance',
          exchange: 'binance',
          pricePrecision: 2,
          volumePrecision: 2,
          priceCurrency: 'USDT',
          type: 'crypto',
        },
        {
          ticker: 'BTC/USDT:FUTURE',
          name: 'BTC/USDT:FUTURE',
          shortName: 'BTC/USDT:FUTURE',
          market: 'okx',
          exchange: 'okx',
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
      void loadHisOrders(sym, from, to)

      try {
        const history = await queryKline({
          exchange,
          symbol: sym,
          interval,
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
      const exchange = symbol.exchange ?? symbol.market
      const sym = symbol.ticker
      const periodText = period.text || '1m'
      if (!exchange || !sym) return

      fatalAuthError = false

      // 避免图表重复以相同参数订阅时先退订再订阅，导致 lazy WebSocket 反复开关与 connection_init 风暴
      if (
        sub !== null &&
        currentCallback === callback &&
        snapshot.exchange === exchange &&
        snapshot.symbol === sym &&
        snapshot.period === periodText
      ) {
        return
      }

      console.log('[ApiDatafeed] subscribe', symbol, period, callback)
      this.unsubscribe(symbol, period)

      snapshot.exchange = exchange
      snapshot.symbol = sym
      snapshot.period = periodText

      currentCallback = callback
      lastReceiveTime = Date.now()
      isReconnecting = false
      clearReconnectTimer()

      doSubscribe()
    },

    unsubscribe(_symbol: SymbolInfo, _period: Period): void {
      fatalAuthError = false
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
