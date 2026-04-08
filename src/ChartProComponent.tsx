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
  dispose,
  FormatDateParams,
  Indicator,
  SymbolInfo as KLineSymbolInfo,
  OverlayMode,
  PickPartial,
  Styles,
  TooltipFeatureStyle,
  utils
} from 'klinecharts'

import lodashClone from 'lodash/cloneDeep'
import lodashSet from 'lodash/set'

import { HisOrderHover, Loading, SelectDataSourceItem } from './component'

import {
  DrawingBar, IndicatorModal,
  IndicatorSettingModal,
  PeriodBar,
  ScreenshotModal,
  SettingModal,
  SymbolSearchModal,
  TimezoneModal
} from './widget'

import { translateTimezone } from './widget/timezone-modal/data'

import Chart from './Chart'
import { formatTimeByTz } from './helpers'
import { useChartState } from './store/chartStateStore'
import {
  ChartProComponentProps, instanceApi, loadingVisible,
  period, setInstanceApi, setPeriod, setRooltelId, setSelectedOverlay, setStyles, setSymbol, styles, symbol
} from './store/chartStore'
import {
  loadTradingConfigFromStorage,
  setHisOrdersData,
  setLiquidationPriceData,
  setOpenOrdersData,
  setPositionsData,
  syncTradingOverlays
} from './store/tradingStore'
import { HisOrder, Period, SymbolInfo } from './types/types'
const { createIndicator, pushOverlay, restoreChartState } = useChartState()

interface PrevSymbolPeriod {
  symbol: SymbolInfo
  period: Period
}

const ChartProComponent: Component<ChartProComponentProps> = props => {
  let widgetRef: HTMLDivElement | undefined = undefined

  let priceUnitDom: HTMLElement

  const [theme, setTheme] = createSignal(props.theme)
  const [locale, setLocale] = createSignal(props.locale)

  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
  const [mainIndicators, setMainIndicators] = createSignal([...(props.mainIndicators!)])
  const [subIndicators, setSubIndicators] = createSignal({})

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false)
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({ key: props.timezone, text: translateTimezone(props.timezone, props.locale) })

  const [settingModalVisible, setSettingModalVisible] = createSignal(false)
  const [widgetDefaultStyles, setWidgetDefaultStyles] = createSignal<Styles>()

  const [screenshotUrl, setScreenshotUrl] = createSignal('')

  const [drawingBarVisible, setDrawingBarVisible] = createSignal(props.drawingBarVisible)

  const [symbolSearchModalVisible, setSymbolSearchModalVisible] = createSignal(false)
  const [hisOrderHoverVisible, setHisOrderHoverVisible] = createSignal(false)
  const [hisOrderHoverData, setHisOrderHoverData] = createSignal<HisOrder | null>(null)
  const [hisOrderHoverAnchor, setHisOrderHoverAnchor] = createSignal<{ x: number | null; y: number | null }>({ x: null, y: null })
  let hisOrderHoverHideTimer: number | null = null

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal({
    visible: false, indicatorName: '', paneId: '', calcParams: [] as Array<any>
  })

  
  setPeriod(props.period)
  setSymbol(props.symbol)

  props.ref({
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
    dispose: () => { },
    setPositions: (list) => { setPositionsData(list) },
    setLiqPrice: (price) => { setLiquidationPriceData(price) },
    setOpenOrders: (list) => { setOpenOrdersData(list) },
    setHisOrders: (list) => { setHisOrdersData(list) },
  })

  const documentResize = () => {
    instanceApi()?.resize()
  }

  const onHisOrderHover = (evt: Event) => {
    const event = evt as CustomEvent<{ visible: boolean; order: HisOrder | null; anchorX?: number | null; anchorY?: number | null }>
    const visible = !!event.detail?.visible
    if (visible) {
      if (hisOrderHoverHideTimer != null) {
        window.clearTimeout(hisOrderHoverHideTimer)
        hisOrderHoverHideTimer = null
      }
      setHisOrderHoverData(event.detail?.order ?? null)
      setHisOrderHoverAnchor({ x: event.detail?.anchorX ?? null, y: event.detail?.anchorY ?? null })
      setHisOrderHoverVisible(true)
      return
    }
    if (hisOrderHoverHideTimer != null) {
      window.clearTimeout(hisOrderHoverHideTimer)
    }
    hisOrderHoverHideTimer = window.setTimeout(() => {
      setHisOrderHoverVisible(false)
      setHisOrderHoverData(null)
      setHisOrderHoverAnchor({ x: null, y: null })
      hisOrderHoverHideTimer = null
    }, 120)
  }

  onMount(() => {
    window.addEventListener('klinecharts-pro-his-order-hover', onHisOrderHover as EventListener)
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

      instanceApi()?.subscribeAction('onIndicatorTooltipFeatureClick', (data) => {
        // console.info('onIndicatorTooltipFeatureClick', data)
        const _data = data as { paneId: string, feature: TooltipFeatureStyle, indicator: Indicator }
        switch (_data.feature.id) {
          case 'visible': {
            instanceApi()?.overrideIndicator({ name: _data.indicator.name, visible: true, paneId: _data.paneId })
            break
          }
          case 'invisible': {
            instanceApi()?.overrideIndicator({ name: _data.indicator.name, visible: false, paneId: _data.paneId })
            break
          }
          case 'setting': {
            const indicator = instanceApi()?.getIndicators({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id }).at(0)
            if (!indicator) return
            setIndicatorSettingModalParams({
              visible: true, indicatorName: _data.indicator.name, paneId: _data.paneId, calcParams: indicator.calcParams
            })
            break
          }
          case 'close': {
            if (_data.paneId === 'candle_pane') {
              const newMainIndicators = [...mainIndicators()]
              instanceApi()?.removeIndicator({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id })
              newMainIndicators.splice(newMainIndicators.indexOf(_data.indicator.name), 1)
              setMainIndicators(newMainIndicators)
            } else {
              const newIndicators = { ...subIndicators() }
              instanceApi()?.removeIndicator({ paneId: _data.paneId, name: _data.indicator.name, id: _data.indicator.id })
              // @ts-expect-error
              delete newIndicators[_data.indicator.name]
              setSubIndicators(newIndicators)
            }
          }
        }
      })

      instanceApi()?.subscribeAction('onCandleTooltipFeatureClick', (data) => {
        // console.info('onCandleTooltipFeatureClick', data)
      })

      instanceApi()?.subscribeAction('onZoom', (data) => {
        // console.info('chart zoomed: ', data)
      })

      instanceApi()?.subscribeAction('onCrosshairChange', (data) => {
        // console.info('crosshair change: ', data)
      })
      restoreChartState(props.overrides)
      loadTradingConfigFromStorage()
      syncTradingOverlays()

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
      const subIndicatorMap = {}
      props.subIndicators!.forEach(indicator => {
        const paneId = createIndicator(w, indicator, true)
        if (paneId) {
          // @ts-expect-error
          subIndicatorMap[indicator] = paneId
        }
      })
      setSubIndicators(subIndicatorMap)
    }
  })

  onCleanup(() => {
    if (hisOrderHoverHideTimer != null) {
      window.clearTimeout(hisOrderHoverHideTimer)
      hisOrderHoverHideTimer = null
    }
    window.removeEventListener('klinecharts-pro-his-order-hover', onHisOrderHover as EventListener)
    window.removeEventListener('resize', documentResize)
    dispose(widgetRef!)
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
    }

    const onlyPeriodChanged = periodChanged && !symbolKeyChanged
    if (!onlyPeriodChanged) {
      api?.setSymbol({
        ...s,
        pricePrecision: s.pricePrecision ?? 2,
        volumePrecision: s.volumePrecision ?? 0,
      } as PickPartial<KLineSymbolInfo, 'pricePrecision' | 'volumePrecision'>)
      // klinecharts 在 ticker 不变时更新精度，可能不会立即重绘 y 轴刻度。
      // 这里补一次轻量刷新，确保刻度文本即时按新精度生效。
      if (precisionChangedOnly) {
        api?.resize()
      }
    }

    return { symbol: s, period: p }
  })

  createEffect(() => {
    const t = theme()
    instanceApi()?.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    instanceApi()?.setStyles({
      indicator: {
        tooltip: {
          features: [
            {
              id: 'visible',
              position: 'middle',
              marginLeft: 6,
              marginTop: 3,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue903',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'invisible',
              position: 'middle',
              marginLeft: 6,
              marginTop: 3,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue901',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'setting',
              position: 'middle',
              marginLeft: 6,
              marginTop: 3,
              marginBottom: 0,
              marginRight: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue902',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'close',
              position: 'middle',
              marginLeft: 6,
              marginTop: 3,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: {
                code: '\ue900',
                family: 'icomoon',
              },
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            }
          ]
        }
      }
    })
  })

  createEffect(() => {
    instanceApi()?.setLocale(locale())
  })

  createEffect(() => {
    instanceApi()?.setTimezone(timezone().key)
  })

  createEffect(() => {
    setWidgetDefaultStyles(lodashClone(instanceApi()!.getStyles()))
  })

  createEffect(() => {
    if (styles()) {
      instanceApi()?.setStyles(styles()!)
    }
  })

  createEffect(() => {
    const chartContainer = widgetRef as HTMLDivElement | undefined
    if (!chartContainer) return
    if (!settingModalVisible()) return

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
          onMainIndicatorChange={data => {
            const newMainIndicators = [...mainIndicators()]
            if (data.added) {
              createIndicator(instanceApi()!, data.name, true, { id: 'candle_pane' })
              newMainIndicators.push(data.name)
            } else {
              instanceApi()?.removeIndicator({ name: data.name, paneId: 'candle_pane', id: data.id ?? undefined })
              newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1)
            }
            setMainIndicators(newMainIndicators)
          }}
          onSubIndicatorChange={data => {
            // console.info('onSubIndicatorChange', data)
            const newSubIndicators = { ...subIndicators() }
            if (data.added) {
              const id = createIndicator(instanceApi()!, data.name)
              if (id) {
                // @ts-expect-error
                newSubIndicators[data.name] = id
              }
            } else {
              if (data.id) {
                instanceApi()?.removeIndicator({ name: data.name, id: data.id })
                // @ts-expect-error
                delete newSubIndicators[data.name]
              }
            }
            setSubIndicators(newSubIndicators)
          }} />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={props.locale}
          timezone={timezone()}
          onClose={() => { setTimezoneModalVisible(false) }}
          onConfirm={setTimezone}
        />
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
          onClose={() => { setIndicatorSettingModalParams({ visible: false, indicatorName: '', paneId: '', calcParams: [] }) }}
          onConfirm={(params) => {
            const modalParams = indicatorSettingModalParams()
            instanceApi()?.overrideIndicator({ name: modalParams.indicatorName, calcParams: params, paneId: modalParams.paneId })
          }}
        />
      </Show>
      <Show when={hisOrderHoverVisible() && !!hisOrderHoverData()}>
        <HisOrderHover
          order={hisOrderHoverData()!}
          formattedTime={formatTimeByTz(hisOrderHoverData()!.timestamp, props.locale, timezone().key)}
          anchorX={hisOrderHoverAnchor().x}
          anchorY={hisOrderHoverAnchor().y}
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
