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
  startTransition
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
  period, setInstanceApi, setPeriod, setRooltelId, setSelectedOverlay, setStyles, setSymbol, styles, symbol
} from './store/chartStore'
import { createHisOrderHoverController, createResyncScheduler } from './store/tradingEffects'
import {
  bindTradingStore,
  loadTradingConfigFromStorage,
  setHisOrdersData,
  setLiquidationPriceData,
  setOpenOrdersData,
  setPositionsData,
  syncTradingOverlays
} from './store/tradingStore'
import { AlertItem, AlertType, HisOrder, PendingOrder, Period, Position, SymbolInfo } from './types/types'
const { createIndicator, pushOverlay, restoreChartState } = useChartState()

interface PrevSymbolPeriod {
  symbol: SymbolInfo
  period: Period
}
const TRADING_RESYNC_DELAYS = [0, 120, 360, 900] as const
const HIS_ORDER_HOVER_HIDE_DELAY = 120
const ALERT_OVERLAY_GROUP = 'alert_overlays'
const ALERT_PRICE_TYPES: AlertType[] = ['price_reach', 'price_rise_to', 'price_fall_to']

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

  let priceUnitDom: HTMLElement

  const [theme, setTheme] = createSignal(props.theme)
  const [locale, setLocale] = createSignal(props.locale)

  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
  const [mainIndicators, setMainIndicators] = createSignal([...(props.mainIndicators!)])
  const [subIndicators, setSubIndicators] = createSignal<SubIndicatorMap>({})

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false)
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({ key: props.timezone, text: translateTimezone(props.timezone, props.locale) })

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
  let widgetDefaultStylesCaptured = false
  let lastExternalStyles: ReturnType<typeof styles>

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal<IndicatorSettingParams>(DEFAULT_INDICATOR_SETTING_PARAMS)
  const safeOverlaySegment = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '_')

  const syncAlertOverlays = () => {
    const api = instanceApi()
    const currentSymbol = symbol()
    if (!api || !currentSymbol) return
    const lastTs = api.getDataList().at(-1)?.timestamp ?? Date.now()
    const currentAlerts = alerts()
    const priceAlerts = currentAlerts.filter((alertItem) => {
      if (!ALERT_PRICE_TYPES.includes(alertItem.type)) return false
      if (!Number.isFinite(alertItem.price)) return false
      if (alertItem.symbol && alertItem.symbol !== currentSymbol.ticker) return false
      return true
    })
    const aliveIds = new Set<string>()
    priceAlerts.forEach((alertItem, index) => {
      const idSuffix = safeOverlaySegment(alertItem.id || `idx_${index}`)
      const id = `alert-${idSuffix}`
      aliveIds.add(id)
      const existing = (api.getOverlays({ id }) ?? []).length > 0
      const payload = {
        id,
        name: 'priceAlertLine',
        groupId: ALERT_OVERLAY_GROUP,
        paneId: 'candle_pane' as const,
        mode: 'normal' as const,
        points: [{ timestamp: lastTs, value: alertItem.price! }],
        extendData: { alert: alertItem, showInfo: false },
      }
      if (!existing) {
        api.createOverlay(payload)
      } else {
        api.overrideOverlay({
          id,
          points: payload.points,
          extendData: payload.extendData,
        })
      }
    })
    const existing = api.getOverlays({ groupId: ALERT_OVERLAY_GROUP }) ?? []
    existing.forEach((item) => {
      if (item.id && !aliveIds.has(item.id)) {
        api.removeOverlay({ id: item.id })
      }
    })
  }

  const handleRemoveAlert = async (alertItem: AlertItem) => {
    return (await props.onRemoveAlert?.(alertItem)) ?? true
  }

  setPriceAlertOverlayHandlers({
    onRemove: (alertItem) => {
      void handleRemoveAlert(alertItem)
    },
  })



  setPeriod(props.period)
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
    createIndicator
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
    const detail = (evt as CustomEvent<{visible: boolean, sourceContainer?: HTMLElement | null }>).detail
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
    instanceApi()?.unsubscribeAction('onCrosshairChange', onCrosshairForHisOrderHover)
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
  }

  const exposedApi = {
    setTheme,
    getTheme: () => theme(),
    setStyles,
    getStyles: () => styles() ?? {},
    setLocale,
    getLocale: () => locale(),
    setTimezone: (timezone: string) => { setTimezone({ key: timezone, text: translateTimezone(props.timezone, locale()) }) },
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol()!,
    setPeriod,
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
      syncAlertOverlays()
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
    setInstanceApi(Chart.init(widgetRef!, {
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
    }))

    if (instanceApi()) {
      setRooltelId(props.rootElementId)
      // console.info('ChartPro widget initialized')
      const watermarkContainer = instanceApi()!.getDom('candle_pane', 'main')
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

      const priceUnitContainer = instanceApi()!.getDom('candle_pane', 'yAxis')
      priceUnitDom = document.createElement('span')
      priceUnitDom.className = 'klinecharts-pro-price-unit'
      priceUnitContainer?.appendChild(priceUnitDom)

      instanceApi()?.setZoomAnchor({ main: 'last_bar', xAxis: 'last_bar' })
      instanceApi()?.setBarSpace(400)

      instanceApi()?.subscribeAction('onCrosshairFeatureClick', (data) => {
        // console.info('onCrosshairFeatureClick', data)
      })

      instanceApi()?.subscribeAction('onIndicatorTooltipFeatureClick', indicatorHandlers.onIndicatorTooltipFeatureClick)

      instanceApi()?.subscribeAction('onCandleTooltipFeatureClick', (data) => {
        // console.info('onCandleTooltipFeatureClick', data)
      })

      instanceApi()?.subscribeAction('onZoom', (data) => {
        // console.info('chart zoomed: ', data)
      })

      instanceApi()?.subscribeAction('onCrosshairChange', onCrosshairForHisOrderHover)
      restoreChartState(props.overrides)
      bindTradingStore(instanceApi()!)
      loadTradingConfigFromStorage(instanceApi())
      syncTradingOverlays(instanceApi())
      syncAlertOverlays()

      const s = symbol()
      if (s?.priceCurrency) {
        priceUnitDom.innerHTML = s?.priceCurrency.toLocaleUpperCase()
        priceUnitDom.style.display = 'flex'
      } else {
        priceUnitDom.style.display = 'none'
      }
      instanceApi()?.setSymbol({ ticker: s!.ticker, pricePrecision: s?.pricePrecision ?? 2, volumePrecision: s?.volumePrecision ?? 0 })
      instanceApi()?.setPeriod(period()!)
      instanceApi()?.setDataLoader(props.dataloader)
    }

    const w = instanceApi()

    if (w) {
      mainIndicators().forEach(indicator => {
        createIndicator(w, indicator, true, { id: 'candle_pane' })
      })
      const subIndicatorMap: SubIndicatorMap = {}
      props.subIndicators!.forEach(indicator => {
        const paneId = createIndicator(w, indicator, true)
        if (paneId) {
          subIndicatorMap[indicator] = paneId
        }
      })
      setSubIndicators(subIndicatorMap)
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
      scheduleTradingOverlayResync()
    }

    const onlyPeriodChanged = periodChanged && !symbolKeyChanged
    if (!onlyPeriodChanged) {
      api?.setSymbol({
        ...s,
        pricePrecision: s.pricePrecision ?? 2,
        volumePrecision: s.volumePrecision ?? 0,
      } as PickPartial<KLineSymbolInfo, 'pricePrecision' | 'volumePrecision'>)
      scheduleTradingOverlayResync()
      // klinecharts 在 ticker 不变时更新精度，可能不会立即重绘 y 轴刻度。
      // 这里补一次轻量刷新，确保刻度文本即时按新精度生效。
      if (precisionChangedOnly) {
        api?.resize()
      }
    }
    syncAlertOverlays()

    return { symbol: s, period: p }
  })

  createEffect(() => {
    const api = instanceApi()
    if (!api) return
    const t = theme()
    api.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    if (lastTooltipFeatureColor === color) return
    lastTooltipFeatureColor = color
    api.setStyles(buildTooltipFeatureStyles(color))
  })

  createEffect(() => {
    instanceApi()?.setLocale(locale())
  })

  createEffect(() => {
    instanceApi()?.setTimezone(timezone().key)
  })

  createEffect(() => {
    const api = instanceApi()
    if (!api || widgetDefaultStylesCaptured) return
    setWidgetDefaultStyles(lodashClone(api.getStyles()))
    widgetDefaultStylesCaptured = true
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
    alerts()
    syncAlertOverlays()
  })

  createEffect(() => {
    const chartContainer = widgetRef as HTMLDivElement | undefined
    if (!chartContainer) return
    if (!settingModalVisible() && !alertModalVisible() && !chartAlertDetail()) return

    const lockChartScroll = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }

    chartContainer.addEventListener('wheel', lockChartScroll, { passive: false })
    chartContainer.addEventListener('touchmove', lockChartScroll, { passive: false })

    onCleanup(() => {
      chartContainer.removeEventListener('wheel', lockChartScroll)
      chartContainer.removeEventListener('touchmove', lockChartScroll)
    })
  })

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon" />
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={props.locale}
          datafeed={props.dataloader}
          onSymbolSelected={symbol => { setSymbol(symbol) }}
          onClose={() => { setSymbolSearchModalVisible(false) }} />
      </Show>
      <Show when={indicatorModalVisible()}>
        <IndicatorModal
          locale={props.locale}
          mainIndicators={mainIndicators()}
          subIndicators={subIndicators()}
          onClose={() => { setIndicatorModalVisible(false) }}
          onMainIndicatorChange={indicatorHandlers.onMainIndicatorChange}
          onSubIndicatorChange={indicatorHandlers.onSubIndicatorChange} />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={props.locale}
          timezone={timezone()}
          onClose={() => { setTimezoneModalVisible(false) }}
          onConfirm={setTimezone}
        />
      </Show>
      <Show when={alertModalVisible()}>
        <AlertModal
          alerts={alerts()}
          onClose={() => { setAlertModalVisible(false) }}
          onAddAlert={props.onAddAlert}
          onRemoveAlert={handleRemoveAlert}
        />
      </Show>
      <Show when={chartAlertDetail()}>
        {(w) => (
          <Modal
            title="预警详情"
            width={400}
            height={260}
            onClose={() => { setChartAlertDetail(null) }}
          >
            <div class="klinecharts-pro-alert-detail">
              <AlertDetailFields alert={w()} />
            </div>
          </Modal>
        )}
      </Show>
      <Show when={settingModalVisible()}>
        <SettingModal
          locale={props.locale}
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
          locale={props.locale}
          url={screenshotUrl()}
          onClose={() => { setScreenshotUrl('') }}
        />
      </Show>
      <Show when={indicatorSettingModalParams().visible}>
        <IndicatorSettingModal
          locale={props.locale}
          params={indicatorSettingModalParams()}
          onClose={() => { setIndicatorSettingModalParams(DEFAULT_INDICATOR_SETTING_PARAMS) }}
          onConfirm={indicatorHandlers.onIndicatorSettingConfirm}
        />
      </Show>
      <Show when={hisOrderHoverVisible() && !!hisOrderHoverData()}>
        <HisOrderHover
          order={hisOrderHoverData()!}
          formattedTime={formatTimeByTz(hisOrderHoverData()!.timestamp, props.locale, timezone().key)}
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
        locale={props.locale}
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
        onPeriodChange={setPeriod}
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
            locale={props.locale}
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
