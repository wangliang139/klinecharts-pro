/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount, Show,
  startTransition,
  untrack
} from 'solid-js'

import {
  ActionCallback,
  Crosshair,
  dispose,
  FormatDateParams,
  SymbolInfo as KLineSymbolInfo,
  OverlayMode,
  PickPartial,
  Styles,
  utils
} from 'klinecharts'

import lodashClone from 'lodash/cloneDeep'
import lodashSet from 'lodash/set'

import { HisOrderHover, Loading, Modal, SelectDataSourceItem } from './component'

import {
  DrawingBar, IndicatorModal,
  IndicatorSettingModal,
  PeriodBar,
  ScreenshotModal,
  SettingModal,
  SymbolSearchModal,
  TimezoneModal
} from './widget'
import AlertModal from './widget/alert-modal'
import { AlertDetailFields } from './widget/alert-modal/alert-detail-fields'

import i18n from './i18n'
import { translateTimezone } from './widget/timezone-modal/data'

import Chart from './Chart'
import { ALERT_DETAIL_OPEN_EVENT, HIS_ORDER_HOVER_EVENT } from './extension/trading/constants'
import { pickBestHisOrderMarkAtPanePixel } from './extension/trading/hisOrderMarkHitTest'
import { setPriceAlertOverlayHandlers } from './extension/trading/priceAlertLine'
import { formatTimeByTz } from './helpers'
import {
  createChartIndicatorHandlers,
  DEFAULT_INDICATOR_SETTING_PARAMS,
  IndicatorSettingParams,
  SubIndicatorMap
} from './store/chartProIndicatorHandlers'
import { useChartState } from './store/chartStateStore'
import {
  ChartProComponentProps, instanceApi, loadingVisible,
  period,
  setPeriod as setCurrentPeriod,
  setInstanceApi,
  setRooltelId, setSelectedOverlay, setStyles, setSymbol, styles, symbol
} from './store/chartStore'
import { findMatchedPeriod, persistPeriod, resolveInitialPeriod } from './store/periodStore'
import { persistTimezone, resolveInitialTimezone } from './store/timezoneStore'
import { createHisOrderHoverController, createResyncScheduler } from './store/tradingEffects'
import {
  bindTradingStore,
  loadTradingConfigFromStorage,
  setAlertsData,
  setHisOrdersData,
  setLiquidationPriceData,
  setOpenOrdersData,
  setPositionsData,
  syncTradingOverlays
} from './store/tradingStore'
import { AlertItem, HisOrder, PendingOrder, Period, Position, ProChart, SymbolInfo } from './types/types'
const { createIndicator, modifyIndicator, pushOverlay, popIndicator, restoreChartState, restoreIndicators, setIndicatorVisible } = useChartState()

interface PrevSymbolPeriod {
  symbol: SymbolInfo
  period: Period
}
const TRADING_RESYNC_DELAYS = [0, 120, 360, 900] as const
const HIS_ORDER_HOVER_HIDE_DELAY = 120

function buildTooltipFeatureStyles(color: string) {
  return {
    indicator: {
      tooltip: {
        features: [
          {
            id: 'visible',
            position: 'middle' as const,
            marginLeft: 6,
            marginTop: 3,
            marginRight: 0,
            marginBottom: 0,
            paddingLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            type: 'icon_font' as const,
            content: {
              code: '\ue903',
              family: 'icomoon',
            },
            size: 14,
            color: color,
            activeColor: color,
            backgroundColor: 'transparent',
            borderRadius: 2,
            activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
          },
          {
            id: 'invisible',
            position: 'middle' as const,
            marginLeft: 6,
            marginTop: 3,
            marginRight: 0,
            marginBottom: 0,
            paddingLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            type: 'icon_font' as const,
            content: {
              code: '\ue901',
              family: 'icomoon',
            },
            size: 14,
            color: color,
            activeColor: color,
            backgroundColor: 'transparent',
            borderRadius: 2,
            activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
          },
          {
            id: 'setting',
            position: 'middle' as const,
            marginLeft: 6,
            marginTop: 3,
            marginBottom: 0,
            marginRight: 0,
            paddingLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            type: 'icon_font' as const,
            content: {
              code: '\ue902',
              family: 'icomoon',
            },
            size: 14,
            color: color,
            activeColor: color,
            backgroundColor: 'transparent',
            borderRadius: 2,
            activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
          },
          {
            id: 'close',
            position: 'middle' as const,
            marginLeft: 6,
            marginTop: 3,
            marginRight: 0,
            marginBottom: 0,
            paddingLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            type: 'icon_font' as const,
            content: {
              code: '\ue900',
              family: 'icomoon',
            },
            size: 14,
            color: color,
            activeColor: color,
            backgroundColor: 'transparent',
            borderRadius: 2,
            activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
          }
        ]
      }
    }
  }
}

const ChartProComponent: Component<ChartProComponentProps> = props => {
  let widgetRef: HTMLDivElement | undefined = undefined
  /** 本实例 Chart；勿用全局 instanceApi 同步 overlay，多图表时后者指向最后 mount 的那张 */
  let chartApiRef: ProChart | null = null

  let priceUnitDom: HTMLElement

  const [theme, setTheme] = createSignal(props.theme)
  const [locale, setLocale] = createSignal(props.locale)

  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
  const [mainIndicators, setMainIndicators] = createSignal([...(props.mainIndicators!)])
  const [subIndicators, setSubIndicators] = createSignal<SubIndicatorMap>({})

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false)

  const [settingModalVisible, setSettingModalVisible] = createSignal(false)
  const [alertModalVisible, setAlertModalVisible] = createSignal(false)
  const [widgetDefaultStyles, setWidgetDefaultStyles] = createSignal<Styles>()

  const [screenshotUrl, setScreenshotUrl] = createSignal('')

  const [drawingBarVisible, setDrawingBarVisible] = createSignal(props.drawingBarVisible)
  const [alerts, setAlerts] = createSignal<AlertItem[]>([...(props.alerts ?? [])])
  const [chartAlertDetail, setChartAlertDetail] = createSignal<AlertItem | null>(null)

  const [symbolSearchModalVisible, setSymbolSearchModalVisible] = createSignal(false)
  const [hisOrderHoverVisible, setHisOrderHoverVisible] = createSignal(false)
  const [hisOrderHoverData, setHisOrderHoverData] = createSignal<HisOrder | null>(null)
  const [hisOrderHoverAnchor, setHisOrderHoverAnchor] = createSignal<{ x: number | null; y: number | null }>({ x: null, y: null })
  let resizeRafId: number | null = null
  let isDisposed = false
  let lastTooltipFeatureColor: string | null = null
  let lastExternalStyles: ReturnType<typeof styles>

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal<IndicatorSettingParams>(DEFAULT_INDICATOR_SETTING_PARAMS)

  const applyPeriod = (nextPeriod: Period) => {
    const actualPeriod = findMatchedPeriod(props.periods, nextPeriod) ?? nextPeriod
    setCurrentPeriod(actualPeriod)
    persistPeriod(actualPeriod)
  }

  const initialPeriod = resolveInitialPeriod(props.periods, props.period)
  const initialTimezone = resolveInitialTimezone(props.timezone)
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({
    key: initialTimezone,
    text: translateTimezone(initialTimezone, props.locale)
  })

  const applyTimezone = (nextTimezone: string) => {
    setTimezone({ key: nextTimezone, text: translateTimezone(nextTimezone, locale()) })
    persistTimezone(nextTimezone)
  }

  const handleRemoveAlert = async (alertItem: AlertItem) => {
    return (await props.onRemoveAlert?.(alertItem)) ?? true
  }

  setPriceAlertOverlayHandlers({
    onRemove: (alertItem) => {
      void handleRemoveAlert(alertItem)
    },
  })

  setCurrentPeriod(initialPeriod)
  persistPeriod(initialPeriod)
  persistTimezone(initialTimezone)
  setSymbol(props.symbol)

  const hoverController = createHisOrderHoverController(
    HIS_ORDER_HOVER_HIDE_DELAY,
    (detail) => {
      setHisOrderHoverVisible(detail.visible)
      setHisOrderHoverData(detail.order)
      setHisOrderHoverAnchor({ x: detail.x, y: detail.y })
    }
  )
  let lastCrosshairHisOrderPickId: string | null = null
  const onCrosshairForHisOrderHover: ActionCallback = (data) => {
    const cr = data as Crosshair | undefined
    if (!cr) return
    const api = instanceApi()
    const chartEl = widgetRef as HTMLElement | undefined
    const currentContainer = chartEl?.closest('.klinecharts-pro') as HTMLElement | null
    if (!api || !currentContainer) return
    if (cr.paneId !== 'candle_pane') return
    if (typeof cr.x !== 'number' || typeof cr.y !== 'number') return

    const pick = pickBestHisOrderMarkAtPanePixel(api, cr.x, cr.y)
    if (pick) {
      if (pick.overlayId === lastCrosshairHisOrderPickId) return
      lastCrosshairHisOrderPickId = pick.overlayId
      hoverController.setExclusiveHover({
        order: pick.order,
        anchorX: pick.anchorX,
        anchorY: pick.anchorY,
      })
      return
    }
    if (lastCrosshairHisOrderPickId != null) {
      lastCrosshairHisOrderPickId = null
      hoverController.resetHoverToHidden()
    }
  }
  const resyncScheduler = createResyncScheduler(
    () => syncTradingOverlays(instanceApi()),
    TRADING_RESYNC_DELAYS
  )
  const indicatorHandlers = createChartIndicatorHandlers({
    getApi: () => instanceApi(),
    mainIndicators,
    setMainIndicators,
    subIndicators,
    setSubIndicators,
    indicatorSettingModalParams,
    setIndicatorSettingModalParams,
    createIndicator: (chart, indicatorName, isStack, paneOptions) => createIndicator(chart, indicatorName, isStack, paneOptions, true),
    popIndicator,
    setIndicatorVisible,
    modifyIndicator
  })

  const onAlertDetailOpen = (e: Event) => {
    const d = (e as CustomEvent<{ alert: AlertItem, sourceContainer?: HTMLElement | null }>).detail
    const sourceContainer = d?.sourceContainer ?? null
    const currentContainer = (widgetRef as HTMLElement | undefined)?.closest('.klinecharts-pro') as HTMLElement | null
    if (!currentContainer) {
      return
    }
    if (sourceContainer && sourceContainer !== currentContainer) {
      return
    }
    if (d?.alert) {
      setChartAlertDetail(d.alert)
    }
  }
  const onHisOrderHover = (evt: Event) => {
    const detail = (evt as CustomEvent<{ visible: boolean, sourceContainer?: HTMLElement | null }>).detail
    const sourceContainer = detail?.sourceContainer ?? null
    const currentContainer = (widgetRef as HTMLElement | undefined)?.closest('.klinecharts-pro') as HTMLElement | null
    if (!currentContainer) {
      return
    }
    if (sourceContainer && sourceContainer !== currentContainer) {
      return
    }
    hoverController.onEvent(evt)
  }

  const disposeChart = () => {
    if (isDisposed) return
    isDisposed = true
    const disposedChart = chartApiRef
    disposedChart?.unsubscribeAction('onCrosshairChange', onCrosshairForHisOrderHover)
    lastCrosshairHisOrderPickId = null
    hoverController.clear()
    resyncScheduler.clear()
    if (resizeRafId != null) {
      window.cancelAnimationFrame(resizeRafId)
      resizeRafId = null
    }
    const currentContainer = (widgetRef as HTMLElement | undefined)?.closest('.klinecharts-pro') as HTMLElement | null
    currentContainer?.removeEventListener(HIS_ORDER_HOVER_EVENT, onHisOrderHover as EventListener)
    currentContainer?.removeEventListener(ALERT_DETAIL_OPEN_EVENT, onAlertDetailOpen as EventListener)
    window.removeEventListener(HIS_ORDER_HOVER_EVENT, onHisOrderHover as EventListener)
    window.removeEventListener(ALERT_DETAIL_OPEN_EVENT, onAlertDetailOpen)
    window.removeEventListener('resize', documentResize)
    if (widgetRef) {
      dispose(widgetRef)
    }
    if (instanceApi() === disposedChart) {
      setInstanceApi(null)
    }
    chartApiRef = null
  }

  const exposedApi = {
    setTheme,
    getTheme: () => theme(),
    setStyles,
    getStyles: () => styles() ?? {},
    setLocale,
    getLocale: () => locale(),
    setTimezone: applyTimezone,
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol()!,
    setPeriod: applyPeriod,
    getPeriod: () => period()!,
    getInstanceApi: () => instanceApi(),
    resize: () => instanceApi()?.resize(),
    dispose: () => { disposeChart() },
    setPositions: (list: Position[]) => { setPositionsData(list, instanceApi()) },
    setLiqPrice: (price: number | null) => { setLiquidationPriceData(price, instanceApi()) },
    setOpenOrders: (list: PendingOrder[]) => { setOpenOrdersData(list, instanceApi()) },
    setHisOrders: (list: HisOrder[]) => { setHisOrdersData(list, instanceApi()) },
    setAlerts: (list: AlertItem[]) => {
      setAlerts([...list])
      setAlertsData(list, instanceApi())
    },
  }

  props.ref(exposedApi)

  const documentResize = () => {
    if (resizeRafId != null) return
    resizeRafId = window.requestAnimationFrame(() => {
      resizeRafId = null
      instanceApi()?.resize()
    })
  }

  const scheduleTradingOverlayResync = () => {
    // 周期/品种切换后数据加载是异步的，分段重试可覆盖“先清空后到数”的窗口。
    resyncScheduler.schedule()
  }

  onMount(() => {
    const currentContainer = (widgetRef as HTMLElement | undefined)?.closest('.klinecharts-pro') as HTMLElement | null
    currentContainer?.addEventListener(HIS_ORDER_HOVER_EVENT, onHisOrderHover as EventListener)
    currentContainer?.addEventListener(ALERT_DETAIL_OPEN_EVENT, onAlertDetailOpen as EventListener)
    // Fallback for legacy/global emitters.
    window.addEventListener(HIS_ORDER_HOVER_EVENT, onHisOrderHover as EventListener)
    // Fallback for legacy/global emitters.
    window.addEventListener(ALERT_DETAIL_OPEN_EVENT, onAlertDetailOpen)
    window.addEventListener('resize', documentResize)
    const chart = Chart.init(widgetRef!, {
      formatter: {
        formatDate: (params: FormatDateParams) => {
          const p = period()!
          switch (p.type) {
            case 'minute': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'HH:mm')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'hour': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'MM-DD HH:mm')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'day':
            case 'week': return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            case 'month': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            }
            case 'year': {
              if (params.type === 'xAxis') {
                return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY')
              }
              return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD')
            }
          }
          return utils.formatDate(params.dateTimeFormat, params.timestamp, 'YYYY-MM-DD HH:mm')
        }
      }
    })
    chartApiRef = chart
    setInstanceApi(chart)

    if (chart) {
      setRooltelId(props.rootElementId)
      // console.info('ChartPro widget initialized')
      const watermarkContainer = chart.getDom('candle_pane', 'main')
      if (watermarkContainer) {
        let watermark = document.createElement('div')
        watermark.className = 'klinecharts-pro-watermark'
        if (utils.isString(props.watermark)) {
          const str = (props.watermark as string).replace(/(^\s*)|(\s*$)/g, '')
          watermark.innerHTML = str
        } else {
          watermark.appendChild(props.watermark as Node)
        }
        watermarkContainer.appendChild(watermark)
      }

      const priceUnitContainer = chart.getDom('candle_pane', 'yAxis')
      priceUnitDom = document.createElement('span')
      priceUnitDom.className = 'klinecharts-pro-price-unit'
      priceUnitContainer?.appendChild(priceUnitDom)

      chart.setZoomAnchor({ main: 'last_bar', xAxis: 'last_bar' })
      chart.setBarSpace(400)

      chart.subscribeAction('onCrosshairFeatureClick', (data) => {
        // console.info('onCrosshairFeatureClick', data)
      })

      chart.subscribeAction('onIndicatorTooltipFeatureClick', indicatorHandlers.onIndicatorTooltipFeatureClick)

      chart.subscribeAction('onCandleTooltipFeatureClick', (data) => {
        // console.info('onCandleTooltipFeatureClick', data)
      })

      chart.subscribeAction('onZoom', (data) => {
        // console.info('chart zoomed: ', data)
      })

      chart.subscribeAction('onCrosshairChange', onCrosshairForHisOrderHover)
      restoreChartState(props.overrides)
      bindTradingStore(chart)
      loadTradingConfigFromStorage(chart)
      setAlertsData(props.alerts ?? [], chart)

      const s = symbol()
      if (s?.priceCurrency) {
        priceUnitDom.innerHTML = s?.priceCurrency.toLocaleUpperCase()
        priceUnitDom.style.display = 'flex'
      } else {
        priceUnitDom.style.display = 'none'
      }
      chart.setSymbol({
        ...s!,
        pricePrecision: s?.pricePrecision ?? 2,
        volumePrecision: s?.volumePrecision ?? 0,
      } as PickPartial<KLineSymbolInfo, 'pricePrecision' | 'volumePrecision'>)
      chart.setPeriod(period()!)
      chart.setDataLoader(props.dataloader)
      scheduleTradingOverlayResync()
    }

    const w = chartApiRef
    if (w) {
      const restoredIndicatorState = restoreIndicators(w, props.mainIndicators!, props.subIndicators!)
      setMainIndicators(restoredIndicatorState.mainIndicators)
      setSubIndicators(restoredIndicatorState.subIndicators as SubIndicatorMap)
    }
    if (chart) {
      setWidgetDefaultStyles(lodashClone(chart.getStyles()))
    }
  })

  onCleanup(() => {
    disposeChart()
  })

  createEffect((prev?: PrevSymbolPeriod) => {
    const s = symbol()
    const p = period()
    const api = instanceApi()
    if (!s || !p) {
      return { symbol: s!, period: p! }
    }

    const periodChanged =
      prev !== undefined &&
      (prev.period.span !== p.span ||
        prev.period.type !== p.type ||
        prev.period.text !== p.text)

    const symbolKeyChanged =
      prev !== undefined &&
      (prev.symbol?.ticker !== s.ticker ||
        (prev.symbol?.pricePrecision ?? 2) !== (s.pricePrecision ?? 2) ||
        (prev.symbol?.volumePrecision ?? 0) !== (s.volumePrecision ?? 0))
    /** ticker/精度不变时，展示或接入相关字段变化也需 setSymbol，避免图内文案/币种等滞后 */
    const symbolDisplayMetaChanged =
      prev !== undefined &&
      prev.symbol?.ticker === s.ticker &&
      (prev.symbol?.name !== s.name ||
        prev.symbol?.shortName !== s.shortName ||
        prev.symbol?.exchange !== s.exchange ||
        prev.symbol?.market !== s.market ||
        prev.symbol?.priceCurrency !== s.priceCurrency ||
        prev.symbol?.type !== s.type ||
        prev.symbol?.logo !== s.logo ||
        prev.symbol?.dollarPerPip !== s.dollarPerPip)
    const symbolBindingChanged = symbolKeyChanged || symbolDisplayMetaChanged
    const precisionChangedOnly =
      prev !== undefined &&
      prev.symbol?.ticker === s.ticker &&
      ((prev.symbol?.pricePrecision ?? 2) !== (s.pricePrecision ?? 2) ||
        (prev.symbol?.volumePrecision ?? 0) !== (s.volumePrecision ?? 0))

    if (prev !== undefined && prev.symbol?.ticker !== s.ticker) {
      setSelectedOverlay(null)
    }

    if (periodChanged) {
      api?.setPeriod(p)
    }

    if (symbolBindingChanged) {
      api?.setSymbol({
        ...s,
        pricePrecision: s.pricePrecision ?? 2,
        volumePrecision: s.volumePrecision ?? 0,
      } as PickPartial<KLineSymbolInfo, 'pricePrecision' | 'volumePrecision'>)
      if (chartApiRef && s) {
        if (s.priceCurrency) {
          priceUnitDom.innerHTML = s.priceCurrency.toLocaleUpperCase()
          priceUnitDom.style.display = 'flex'
        } else {
          priceUnitDom.style.display = 'none'
        }
      }
    }

    if (periodChanged || symbolBindingChanged) {
      scheduleTradingOverlayResync()
    }

    // klinecharts 在 ticker 不变时更新精度，可能不会立即重绘 y 轴刻度。
    // 这里补一次轻量刷新，确保刻度文本即时按新精度生效。
    if (precisionChangedOnly) {
      api?.resize()
    }

    syncTradingOverlays(chartApiRef ?? api)

    return { symbol: s, period: p }
  })

  createEffect(() => {
    const api = instanceApi()
    if (!api) return
    const t = theme()
    api.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    if (lastTooltipFeatureColor !== color) {
      lastTooltipFeatureColor = color
      api.setStyles(buildTooltipFeatureStyles(color))
    }
    syncTradingOverlays(chartApiRef ?? api)
  })

  createEffect(() => {
    const api = instanceApi()
    if (!api) return
    api.setLocale(locale())
    api.setTimezone(timezone().key)
  })

  createEffect(() => {
    const current = timezone()
    const text = translateTimezone(current.key, locale())
    if (current.text !== text) {
      setTimezone({ ...current, text })
    }
  })

  createEffect(() => {
    const api = instanceApi()
    if (!api) return
    const nextStyles = styles()
    if (!nextStyles || lastExternalStyles === nextStyles) return
    lastExternalStyles = nextStyles
    api.setStyles(nextStyles)
  })

  createEffect(() => {
    const chartContainer = widgetRef as HTMLDivElement | undefined
    if (!chartContainer) return
    if (!settingModalVisible() && !alertModalVisible() && !chartAlertDetail()) return

    const canScrollWithinTarget = (target: EventTarget | null, deltaY: number): boolean => {
      if (!target || !(target instanceof Element) || deltaY === 0) {
        return false
      }
      let current: Element | null = target
      while (current) {
        const style = window.getComputedStyle(current)
        const isScrollableY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
          current.scrollHeight > current.clientHeight
        if (isScrollableY) {
          if (deltaY > 0) {
            return current.scrollTop + current.clientHeight < current.scrollHeight
          }
          return current.scrollTop > 0
        }
        current = current.parentElement
      }
      return false
    }

    let lastTouchY: number | null = null

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches.length > 0 ? event.touches[0].clientY : null
    }

    const lockChartScroll = (event: WheelEvent | TouchEvent) => {
      if (event instanceof WheelEvent) {
        if (canScrollWithinTarget(event.target, event.deltaY)) {
          return
        }
      } else {
        if (event.touches.length === 0) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        const currentY = event.touches[0].clientY
        if (lastTouchY != null) {
          const deltaY = lastTouchY - currentY
          if (canScrollWithinTarget(event.target, deltaY)) {
            lastTouchY = currentY
            return
          }
        }
        lastTouchY = currentY
      }
      event.preventDefault()
      event.stopPropagation()
    }

    chartContainer.addEventListener('touchstart', handleTouchStart, { passive: true })
    chartContainer.addEventListener('wheel', lockChartScroll, { passive: false })
    chartContainer.addEventListener('touchmove', lockChartScroll, { passive: false })

    onCleanup(() => {
      chartContainer.removeEventListener('touchstart', handleTouchStart)
      chartContainer.removeEventListener('wheel', lockChartScroll)
      chartContainer.removeEventListener('touchmove', lockChartScroll)
    })
  })

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon" />
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={locale()}
          datafeed={props.dataloader}
          onSymbolSelected={symbol => { setSymbol(symbol) }}
          onClose={() => { setSymbolSearchModalVisible(false) }} />
      </Show>
      <Show when={indicatorModalVisible()}>
        <IndicatorModal
          locale={locale()}
          mainIndicators={mainIndicators()}
          subIndicators={subIndicators()}
          onClose={() => { setIndicatorModalVisible(false) }}
          onMainIndicatorChange={indicatorHandlers.onMainIndicatorChange}
          onSubIndicatorChange={indicatorHandlers.onSubIndicatorChange} />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={locale()}
          timezone={timezone()}
          onClose={() => { setTimezoneModalVisible(false) }}
          onConfirm={(timezone) => { applyTimezone(timezone.key) }}
        />
      </Show>
      <Show when={alertModalVisible()}>
        <AlertModal
          locale={locale()}
          alerts={alerts()}
          onClose={() => { setAlertModalVisible(false) }}
          onAddAlert={props.onAddAlert}
          onRemoveAlert={handleRemoveAlert}
        />
      </Show>
      <Show when={chartAlertDetail()}>
        {(w) => (
          <Modal
            title={i18n('alert_detail', locale())}
            width={400}
            height={260}
            onClose={() => { setChartAlertDetail(null) }}
          >
            <div class="klinecharts-pro-alert-detail">
              <AlertDetailFields locale={locale()} alert={w()} />
            </div>
          </Modal>
        )}
      </Show>
      <Show when={settingModalVisible()}>
        <SettingModal
          locale={locale()}
          currentStyles={utils.clone(instanceApi()!.getStyles())}
          onClose={() => { setSettingModalVisible(false) }}
          onChange={style => {
            instanceApi()?.setStyles(style)
          }}
          onRestoreDefault={(options: SelectDataSourceItem[]) => {
            const style = {}
            options.forEach(option => {
              const key = option.key
              lodashSet(style, key, utils.formatValue(widgetDefaultStyles(), key))
            })
            instanceApi()?.setStyles(style)
          }}
        />
      </Show>
      <Show when={screenshotUrl().length > 0}>
        <ScreenshotModal
          locale={locale()}
          url={screenshotUrl()}
          onClose={() => { setScreenshotUrl('') }}
        />
      </Show>
      <Show when={indicatorSettingModalParams().visible}>
        <IndicatorSettingModal
          locale={locale()}
          params={indicatorSettingModalParams()}
          onClose={() => { setIndicatorSettingModalParams(DEFAULT_INDICATOR_SETTING_PARAMS) }}
          onConfirm={indicatorHandlers.onIndicatorSettingConfirm}
        />
      </Show>
      <Show when={hisOrderHoverVisible() && !!hisOrderHoverData()}>
        <HisOrderHover
          locale={locale()}
          order={hisOrderHoverData()!}
          formattedTime={formatTimeByTz(hisOrderHoverData()!.timestamp, locale(), timezone().key)}
          anchorX={hisOrderHoverAnchor().x}
          anchorY={hisOrderHoverAnchor().y}
          clipElement={
            (widgetRef as HTMLDivElement | undefined)?.closest('.klinecharts-pro') as
            | HTMLElement
            | null
          }
        />
      </Show>
      <PeriodBar
        locale={locale()}
        symbol={symbol()!}
        spread={drawingBarVisible()}
        period={period()!}
        periods={props.periods}
        onMenuClick={async () => {
          try {
            await startTransition(() => setDrawingBarVisible(!drawingBarVisible()))
            instanceApi()?.resize()
          } catch (e) { }
        }}
        onSymbolClick={() => { setSymbolSearchModalVisible(!symbolSearchModalVisible()) }}
        onPeriodChange={applyPeriod}
        onIndicatorClick={() => { setIndicatorModalVisible((visible => !visible)) }}
        onTimezoneClick={() => { setTimezoneModalVisible((visible => !visible)) }}
        onAlertClick={() => { setAlertModalVisible(true) }}
        onSettingClick={() => { setSettingModalVisible((visible => !visible)) }}
        onScreenshotClick={() => {
          if (instanceApi()) {
            const url = instanceApi()!.getConvertPictureUrl(true, 'jpeg', props.theme === 'dark' ? '#151517' : '#ffffff')
            setScreenshotUrl(url)
          }
        }}
      />
      <div class="klinecharts-pro-content">
        <Show when={loadingVisible()}>
          <Loading />
        </Show>
        <Show when={drawingBarVisible()}>
          <DrawingBar
            locale={locale()}
            onDrawingItemClick={(overlay) => {
              pushOverlay(overlay, 'candle_pane')
            }}
            onModeChange={(mode) => {
              instanceApi()?.overrideOverlay({ groupId: 'drawing_tools', mode: mode as OverlayMode })
            }}
            onLockChange={(lock) => {
              instanceApi()?.overrideOverlay({ groupId: 'drawing_tools', lock })
            }}
            onVisibleChange={(visible) => {
              instanceApi()?.overrideOverlay({ groupId: 'drawing_tools', visible })
            }}
            onRemoveClick={(groupId) => {
              instanceApi()?.removeOverlay({ groupId })
            }}
          />
        </Show>
        <div
          ref={widgetRef}
          class="klinecharts-pro-widget"
          data-pane-style={props.overrides.backgroundType ?? 'solid'}
          data-drawing-bar-visible={drawingBarVisible()} />
      </div>
    </>
  )
}

export default ChartProComponent
