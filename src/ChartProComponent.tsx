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

import { createSignal, createEffect, onMount, Show, onCleanup, startTransition, Component } from 'solid-js'

import {
  init, dispose, utils, Nullable, Chart, OverlayMode, Styles,
  PaneOptions, Indicator,
  type Period as KLinePeriod,
  type DataLoader,
  type IndicatorTooltipData,
  type TooltipFeatureStyle,
  type SymbolInfo as KLineChartSymbolInfo
} from 'klinecharts'

import lodashSet from 'lodash/set'
import lodashClone from 'lodash/cloneDeep'

import { SelectDataSourceItem, Loading } from './component'

import {
  PeriodBar, DrawingBar, IndicatorModal, TimezoneModal, SettingModal,
  ScreenshotModal, IndicatorSettingModal, SymbolSearchModal
} from './widget'

import { translateTimezone } from './widget/timezone-modal/data'

import { SymbolInfo, Period, ChartProOptions, ChartPro } from './types'

export interface ChartProComponentProps extends Required<Omit<ChartProOptions, 'container'>> {
  ref: (chart: ChartPro) => void
}

function toKLinePeriod (p: Period): KLinePeriod {
  const span = p.multiplier
  switch (p.timespan) {
    case 'minute': return { type: 'minute', span }
    case 'hour': return { type: 'hour', span }
    case 'day': return { type: 'day', span }
    case 'week': return { type: 'week', span }
    case 'month': return { type: 'month', span }
    case 'year': return { type: 'year', span }
    default: return { type: 'minute', span: 1 }
  }
}

function toProPeriod (p: KLinePeriod): Period {
  const typeMap: Record<KLinePeriod['type'], Period['timespan']> = {
    second: 'minute',
    minute: 'minute',
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
    year: 'year'
  }
  return {
    multiplier: p.span,
    timespan: typeMap[p.type],
    text: ''
  }
}

function toKLineSymbol (s: SymbolInfo): KLineChartSymbolInfo {
  return {
    ...s,
    ticker: s.ticker,
    pricePrecision: s.pricePrecision ?? 2,
    volumePrecision: s.volumePrecision ?? 0
  } as KLineChartSymbolInfo
}

function indicatorTooltipFeatures (color: string): TooltipFeatureStyle[] {
  const common: Pick<TooltipFeatureStyle, 'marginRight' | 'marginBottom' | 'paddingLeft' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'borderRadius' | 'type' | 'backgroundColor' | 'activeBackgroundColor'> = {
    marginRight: 0,
    marginBottom: 0,
    paddingLeft: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    borderRadius: 0,
    type: 'icon_font',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
  }
  return [
    { id: 'visible', position: 'middle', marginLeft: 8, marginTop: 7, size: 14, color, activeColor: color, content: { family: 'icomoon', code: '\ue903' }, ...common },
    { id: 'invisible', position: 'middle', marginLeft: 8, marginTop: 7, size: 14, color, activeColor: color, content: { family: 'icomoon', code: '\ue901' }, ...common },
    { id: 'setting', position: 'middle', marginLeft: 6, marginTop: 7, size: 14, color, activeColor: color, content: { family: 'icomoon', code: '\ue902' }, ...common },
    { id: 'close', position: 'middle', marginLeft: 6, marginTop: 7, size: 14, color, activeColor: color, content: { family: 'icomoon', code: '\ue900' }, ...common }
  ]
}

function createIndicator (widget: Nullable<Chart>, indicatorName: string, isStack?: boolean, paneOptions?: PaneOptions): Nullable<string> {
  if (indicatorName === 'VOL') {
    paneOptions = { axis: { gap: { bottom: 2 } }, ...paneOptions }
  }
  return widget?.createIndicator({
    name: indicatorName,
    createTooltipDataSource: ({ indicator, chart }): IndicatorTooltipData => {
      const fs = chart.getStyles().indicator.tooltip.features ?? []
      const features = indicator.visible
        ? [fs[1], fs[2], fs[3]]
        : [fs[0], fs[2], fs[3]]
      return { features: features as TooltipFeatureStyle[] } as IndicatorTooltipData
    }
  }, isStack, paneOptions) ?? null
}

const ChartProComponent: Component<ChartProComponentProps> = props => {
  let widgetRef: HTMLDivElement | undefined = undefined
  let widget: Nullable<Chart> = null

  let priceUnitDom: HTMLElement | undefined

  const [theme, setTheme] = createSignal(props.theme)
  const [styles, setStyles] = createSignal(props.styles)
  const [locale, setLocale] = createSignal(props.locale)

  const [symbol, setSymbol] = createSignal(props.symbol)
  const [period, setPeriod] = createSignal(props.period)
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

  const [loadingVisible, setLoadingVisible] = createSignal(false)

  const [chartMounted, setChartMounted] = createSignal(false)

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal({
    visible: false, indicatorName: '', paneId: '', calcParams: [] as Array<any>
  })

  props.ref({
    setTheme,
    getTheme: () => theme(),
    setStyles,
    getStyles: () => widget!.getStyles(),
    setLocale,
    getLocale: () => locale(),
    setTimezone: (timezone: string) => { setTimezone({ key: timezone, text: translateTimezone(props.timezone, locale()) }) },
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol(),
    setPeriod,
    getPeriod: () => period()
  })

  const documentResize = () => {
    widget?.resize()
  }

  const adjustFromTo = (period: Period, toTimestamp: number, count: number) => {
    let to = toTimestamp
    let from = to
    switch (period.timespan) {
      case 'minute': {
        to = to - (to % (60 * 1000))
        from = to - count * period.multiplier * 60 * 1000
        break
      }
      case 'hour': {
        to = to - (to % (60 * 60 * 1000))
        from = to - count * period.multiplier * 60 * 60 * 1000
        break
      }
      case 'day': {
        to = to - (to % (60 * 60 * 1000))
        from = to - count * period.multiplier * 24 * 60 * 60 * 1000
        break
      }
      case 'week': {
        const date = new Date(to)
        const week = date.getDay()
        const dif = week === 0 ? 6 : week - 1
        to = to - dif * 60 * 60 * 24
        const newDate = new Date(to)
        to = new Date(`${newDate.getFullYear()}-${newDate.getMonth() + 1}-${newDate.getDate()}`).getTime()
        from = count * period.multiplier * 7 * 24 * 60 * 60 * 1000
        break
      }
      case 'month': {
        const date = new Date(to)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        to = new Date(`${year}-${month}-01`).getTime()
        from = count * period.multiplier * 30 * 24 * 60 * 60 * 1000
        const fromDate = new Date(from)
        from = new Date(`${fromDate.getFullYear()}-${fromDate.getMonth() + 1}-01`).getTime()
        break
      }
      case 'year': {
        const date = new Date(to)
        const year = date.getFullYear()
        to = new Date(`${year}-01-01`).getTime()
        from = count * period.multiplier * 365 * 24 * 60 * 60 * 1000
        const fromDate = new Date(from)
        from = new Date(`${fromDate.getFullYear()}-01-01`).getTime()
        break
      }
    }
    return [from, to]
  }

  onMount(() => {
    window.addEventListener('resize', documentResize)
    widget = init(widgetRef!, {
      formatter: {
        formatDate: ({ dateTimeFormat, timestamp, template, type }) => {
          const p = period()
          switch (p.timespan) {
            case 'minute': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'HH:mm')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'hour': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'MM-DD HH:mm')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'day':
            case 'week': return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            case 'month': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            }
            case 'year': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'YYYY')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            }
            default: break
          }
          return utils.formatDate(dateTimeFormat, timestamp, template)
        }
      }
    })

    if (widget) {
      const watermarkContainer = widget.getDom('candle_pane', 'main')
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

      const priceUnitContainer = widget.getDom('candle_pane', 'yAxis')
      priceUnitDom = document.createElement('span')
      priceUnitDom.className = 'klinecharts-pro-price-unit'
      priceUnitContainer?.appendChild(priceUnitDom)
    }

    mainIndicators().forEach(indicator => {
      createIndicator(widget, indicator, true, { id: 'candle_pane' })
    })
    const subIndicatorMap = {}
    props.subIndicators!.forEach(indicator => {
      const paneId = createIndicator(widget, indicator, true)
      if (paneId) {
        // @ts-expect-error
        subIndicatorMap[indicator] = paneId
      }
    })
    setSubIndicators(subIndicatorMap)

    const dataLoader: DataLoader = {
      getBars: async (params) => {
        const { type, timestamp, symbol: sym, period: klPeriod, callback } = params
        const p = toProPeriod(klPeriod)
        const s = sym as SymbolInfo
        try {
          if (type === 'init') {
            setLoadingVisible(true)
            const [from, to] = adjustFromTo(p, Date.now(), 500)
            const list = await props.datafeed.getHistoryKLineData(s, p, from, to)
            callback(list, list.length > 0)
          } else if (type === 'backward') {
            const [anchor] = adjustFromTo(p, timestamp!, 1)
            const [from] = adjustFromTo(p, anchor, 500)
            const list = await props.datafeed.getHistoryKLineData(s, p, from, anchor)
            callback(list, list.length > 0)
          } else if (type === 'forward') {
            callback([], { forward: false, backward: true })
          }
        } finally {
          if (type === 'init') {
            setLoadingVisible(false)
          }
        }
      },
      subscribeBar: ({ symbol: sym, period: klPeriod, callback }) => {
        props.datafeed.subscribe(sym as SymbolInfo, toProPeriod(klPeriod), callback)
      },
      unsubscribeBar: ({ symbol: sym, period: klPeriod }) => {
        props.datafeed.unsubscribe(sym as SymbolInfo, toProPeriod(klPeriod))
      }
    }
    widget?.setDataLoader(dataLoader)

    setChartMounted(true)

    widget?.subscribeAction('onIndicatorTooltipFeatureClick', (raw) => {
      const data = raw as {
        paneId?: string
        feature?: { id: string }
        indicator?: Indicator
      }
      const name = data.indicator?.name
      const paneId = data.paneId
      const iconId = data.feature?.id
      if (!name || !paneId || !iconId) {
        return
      }
      switch (iconId) {
        case 'visible': {
          widget?.overrideIndicator({ name, visible: true, paneId })
          break
        }
        case 'invisible': {
          widget?.overrideIndicator({ name, visible: false, paneId })
          break
        }
        case 'setting': {
          const ind = widget?.getIndicators({ paneId, name })[0]
          setIndicatorSettingModalParams({
            visible: true, indicatorName: name, paneId, calcParams: ind?.calcParams ?? []
          })
          break
        }
        case 'close': {
          if (paneId === 'candle_pane') {
            const newMainIndicators = [...mainIndicators()]
            widget?.removeIndicator({ paneId: 'candle_pane', name })
            newMainIndicators.splice(newMainIndicators.indexOf(name), 1)
            setMainIndicators(newMainIndicators)
          } else {
            const newIndicators = { ...subIndicators() }
            widget?.removeIndicator({ paneId, name })
            // @ts-expect-error
            delete newIndicators[name]
            setSubIndicators(newIndicators)
          }
        }
      }
    })
  })

  onCleanup(() => {
    window.removeEventListener('resize', documentResize)
    dispose(widgetRef!)
  })

  createEffect(() => {
    const s = symbol()
    if (!priceUnitDom) {
      return
    }
    if (s?.priceCurrency) {
      priceUnitDom.innerHTML = s?.priceCurrency.toLocaleUpperCase()
      priceUnitDom.style.display = 'flex'
    } else {
      priceUnitDom.style.display = 'none'
    }
  })

  createEffect(() => {
    if (!chartMounted() || !widget) {
      return
    }
    widget.setSymbol(toKLineSymbol(symbol()))
  })

  createEffect(() => {
    if (!chartMounted() || !widget) {
      return
    }
    widget.setPeriod(toKLinePeriod(period()))
  })

  createEffect(() => {
    const t = theme()
    widget?.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    widget?.setStyles({
      indicator: {
        tooltip: {
          features: indicatorTooltipFeatures(color)
        }
      }
    })
  })

  createEffect(() => {
    widget?.setLocale(locale())
  })

  createEffect(() => {
    widget?.setTimezone(timezone().key)
  })

  createEffect(() => {
    if (styles()) {
      widget?.setStyles(styles())
      setWidgetDefaultStyles(lodashClone(widget!.getStyles()))
    }
  })

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon"/>
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={props.locale}
          datafeed={props.datafeed}
          onSymbolSelected={symbol => { setSymbol(symbol) }}
          onClose={() => { setSymbolSearchModalVisible(false) }}/>
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
              createIndicator(widget, data.name, true, { id: 'candle_pane' })
              newMainIndicators.push(data.name)
            } else {
              widget?.removeIndicator({ paneId: 'candle_pane', name: data.name })
              newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1)
            }
            setMainIndicators(newMainIndicators)
          }}
          onSubIndicatorChange={data => {
            const newSubIndicators = { ...subIndicators() }
            if (data.added) {
              const paneId = createIndicator(widget, data.name)
              if (paneId) {
                // @ts-expect-error
                newSubIndicators[data.name] = paneId
              }
            } else {
              if (data.paneId) {
                widget?.removeIndicator({ paneId: data.paneId, name: data.name })
                // @ts-expect-error
                delete newSubIndicators[data.name]
              }
            }
            setSubIndicators(newSubIndicators)
          }}/>
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
          currentStyles={utils.clone(widget!.getStyles())}
          onClose={() => { setSettingModalVisible(false) }}
          onChange={style => {
            widget?.setStyles(style)
          }}
          onRestoreDefault={(options: SelectDataSourceItem[]) => {
            const style = {}
            options.forEach(option => {
              const key = option.key
              lodashSet(style, key, utils.formatValue(widgetDefaultStyles(), key))
            })
            widget?.setStyles(style)
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
          onConfirm={(params)=> {
            const modalParams = indicatorSettingModalParams()
            widget?.overrideIndicator({ name: modalParams.indicatorName, calcParams: params, paneId: modalParams.paneId })
          }}
        />
      </Show>
      <PeriodBar
        locale={props.locale}
        symbol={symbol()}
        spread={drawingBarVisible()}
        period={period()}
        periods={props.periods}
        onMenuClick={async () => {
          try {
            await startTransition(() => setDrawingBarVisible(!drawingBarVisible()))
            widget?.resize()
          } catch (e) {}    
        }}
        onSymbolClick={() => { setSymbolSearchModalVisible(!symbolSearchModalVisible()) }}
        onPeriodChange={setPeriod}
        onIndicatorClick={() => { setIndicatorModalVisible((visible => !visible)) }}
        onTimezoneClick={() => { setTimezoneModalVisible((visible => !visible)) }}
        onSettingClick={() => { setSettingModalVisible((visible => !visible)) }}
        onScreenshotClick={() => {
          if (widget) {
            const url = widget.getConvertPictureUrl(true, 'jpeg', props.theme === 'dark' ? '#151517' : '#ffffff')
            setScreenshotUrl(url)
          }
        }}
      />
      <div
        class="klinecharts-pro-content">
        <Show when={loadingVisible()}>
          <Loading/>
        </Show>
        <Show when={drawingBarVisible()}>
          <DrawingBar
            locale={props.locale}
            onDrawingItemClick={overlay => { widget?.createOverlay(overlay) }}
            onModeChange={mode => { widget?.overrideOverlay({ mode: mode as OverlayMode }) }}
            onLockChange={lock => { widget?.overrideOverlay({ lock }) }}
            onVisibleChange={visible => { widget?.overrideOverlay({ visible }) }}
            onRemoveClick={(groupId) => { widget?.removeOverlay({ groupId }) }}/>
        </Show>
        <div
          ref={widgetRef}
          class='klinecharts-pro-widget'
          data-drawing-bar-visible={drawingBarVisible()}/>
      </div>
    </>
  )
}

export default ChartProComponent