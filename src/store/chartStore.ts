import { Color } from "chroma-js"
import { DeepPartial, Nullable, Styles } from "klinecharts"
import { createSignal } from "solid-js"
import { ChartDataLoaderType, ChartPro, ChartProOptions, Datafeed, Period, ProChart, ProOverlay, SymbolInfo } from "../types"

export interface PaneProperties extends Styles {
  backgroundType: 'solid' | 'gradient'
  background: string
  backgroundGradientStartColor: string
  backgroundGradientEndColor: string
}

export interface ChartProComponentProps extends Required<Omit<ChartProOptions, 'container' | 'datafeed' | 'orderController'>> {
  ref: (chart: ChartPro) => void
  dataloader: ChartDataLoaderType
}

export const [drawingBarVisible, setDrawingBarVisible] = createSignal(false)
export const [orderModalVisible, setOrderModalVisible] = createSignal(false)
export const [orderPanelVisible, setOrderPanelVisible] = createSignal(false)
export const [settingModalVisible, setSettingModalVisible] = createSignal(false)
export const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
export const [periodModalVisible, setPeriodModalVisible] = createSignal(false)
export const [showSpeed, setShowSpeed] = createSignal(false)

export const [screenshotUrl, setScreenshotUrl] = createSignal('')
export const [rootlelID, setRooltelId] = createSignal('')

/** 全屏目标：有 rootElementId 时用 getElementById；否则从触发节点向上找 .klinecharts-pro，再退回首个图表容器。 */
export function resolveRootNode(fromNode?: Node | null): HTMLElement | null {
  const id = rootlelID()
  if (id) {
    return document.getElementById(id)
  }
  if (fromNode instanceof Element) {
    const closest = fromNode.closest('.klinecharts-pro')
    if (closest instanceof HTMLElement) return closest
  }
  return document.querySelector('.klinecharts-pro')
}

/** 当前处于全屏的节点（含各浏览器前缀），无则 null */
export function getDocumentFullscreenElement (): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null
    mozFullScreenElement?: Element | null
    msFullscreenElement?: Element | null
  }
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  )
}

/** 图表根节点是否正处于（或包含）文档全屏元素 */
export function isChartRootFullscreen (fromNode?: Node | null): boolean {
  const root = resolveRootNode(fromNode)
  const fs = getDocumentFullscreenElement()
  return !!(root && fs && (root === fs || root.contains(fs)))
}

export const [loadingVisible, setLoadingVisible] = createSignal(false)
export const [symbol, setSymbol] = createSignal<Nullable<SymbolInfo>>(null)
export const [period, setPeriod] = createSignal<Nullable<Period>>(null)
export const [appBackgroundColor, setAppBackgroundColor] = createSignal<Color>()
export const [instanceApi, setInstanceApi] = createSignal<Nullable<ProChart>>(null)
export const [styles, setStyles] = createSignal<Nullable<DeepPartial<PaneProperties>>>(null)

export const [mainIndicators, setMainIndicators] = createSignal([''])
export const [subIndicators, setSubIndicators] = createSignal({})
export const [chartModified, setChartModified] = createSignal(false)
export const [theme, setTheme] = createSignal('')
export const [fullScreen, setFullScreen] = createSignal(false)
export const [range, setRange] = createSignal(1)
export const [datafeed, setDatafeed] = createSignal<Datafeed>()

export const [selectedOverlay, setSelectedOverlay] = createSignal<Nullable<ProOverlay>>(null)