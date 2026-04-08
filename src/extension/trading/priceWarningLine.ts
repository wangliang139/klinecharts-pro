import { Coordinate, LineStyle, OverlayEvent, OverlayTemplate, TextStyle, utils } from 'klinecharts'

import { formatWesternGrouped, getPrecision } from '../../helpers'
import { WarningItem } from '../../types/types'
import { isPriceInVisibleCandleRange } from './chartVisibleRange'

const WARNING_COLOR = '#bfbfbf'

type WarningExtendData = {
  warning: WarningItem
  showInfo?: boolean
}

let removeHandler: ((warning: WarningItem) => void) | undefined

export function setPriceWarningOverlayHandlers(handlers: {
  onRemove?: (warning: WarningItem) => void
}) {
  removeHandler = handlers.onRemove
}

const warningLineStyle = (): LineStyle => ({
  style: 'dashed',
  size: 1,
  color: WARNING_COLOR,
  dashedValue: [4, 4],
})

const axisPriceStyle: TextStyle = {
  style: 'fill',
  size: 12,
  family: 'Arial, sans-serif',
  weight: 'normal',
  color: 'white',
  backgroundColor: WARNING_COLOR,
  borderColor: WARNING_COLOR,
  borderStyle: 'solid',
  borderSize: 1,
  borderDashedValue: [],
  borderRadius: 2,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 3,
  paddingBottom: 3,
}

function getWarningText(warning: WarningItem, precision = 2): string {
  if (warning.type === 'price_reach') return `价格达到 ${formatWesternGrouped(warning.price ?? 0, precision)}`
  if (warning.type === 'price_rise_to') return `价格涨到 ${formatWesternGrouped(warning.price ?? 0, precision)}`
  if (warning.type === 'price_fall_to') return `价格跌到 ${formatWesternGrouped(warning.price ?? 0, precision)}`
  if (warning.type === 'price_rise_pct_over') return `价格${warning.window ?? '5m'}涨幅 ${warning.percent ?? 0}%`
  return `价格${warning.window ?? '5m'}跌幅 ${warning.percent ?? 0}%`
}

const priceWarningLine = (): OverlayTemplate => ({
  name: 'priceWarningLine',
  mode: 'normal',
  totalStep: 1,
  lock: true,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    const price = overlay.points[0]?.value
    const ext = overlay.extendData as WarningExtendData | undefined
    const warning = ext?.warning
    const last = chart.getDataList().at(-1)
    if (price === undefined || !Number.isFinite(price) || !warning || !last) {
      return []
    }
    if (!isPriceInVisibleCandleRange(chart, price)) {
      return []
    }
    const y = (chart.convertToPixel({ timestamp: last.timestamp, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y
    const precision = chart.getSymbol()?.pricePrecision ?? 2
    const text = getWarningText(warning, precision)
    const textW = utils.calcTextWidth(text)
    const triangleX = bounding.width - 14
    const lineEndX = triangleX - 8
    const figures: any[] = [
      {
        key: 'warning-line',
        type: 'line',
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: lineEndX, y },
          ],
        },
        styles: warningLineStyle(),
        ignoreEvent: true,
      },
      {
        key: 'warning-triangle',
        type: 'polygon',
        attrs: {
          coordinates: [
            { x: triangleX, y: y - 6 },
            { x: triangleX + 10, y },
            { x: triangleX, y: y + 6 },
          ],
        },
        styles: { style: 'fill', color: WARNING_COLOR },
        ignoreEvent: false,
      },
    ]
    if (ext?.showInfo) {
      const boxW = Math.max(120, textW + 28)
      const boxX = Math.max(8, triangleX - boxW - 10)
      figures.push(
        {
          key: 'warning-info-text',
          type: 'text',
          attrs: {
            x: boxX + 8,
            y,
            text,
            align: 'left',
            baseline: 'middle',
          },
          styles: {
            style: 'stroke_fill',
            size: 12,
            family: 'Arial, sans-serif',
            weight: 'normal',
            color: '#fff',
            backgroundColor: 'rgba(56, 56, 56, 0.92)',
            borderColor: 'rgba(56, 56, 56, 0.92)',
            borderStyle: 'solid',
            borderSize: 1,
            borderDashedValue: [],
            borderRadius: 3,
            paddingLeft: 8,
            paddingRight: 24,
            paddingTop: 4,
            paddingBottom: 4,
          },
          ignoreEvent: true,
        },
        {
          key: 'warning-info-close',
          type: 'text',
          attrs: {
            x: boxX + boxW - 10,
            y,
            text: 'x',
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            style: 'fill',
            size: 12,
            family: 'Arial, sans-serif',
            weight: 'bold',
            color: '#fff',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderStyle: 'solid',
            borderSize: 0,
            borderDashedValue: [],
            borderRadius: 0,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
          },
          ignoreEvent: false,
        },
      )
    }
    return figures
  },
  createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
    const price = overlay.points[0]?.value
    const precision = getPrecision(chart, overlay, yAxis)
    if (price === undefined || !Number.isFinite(price)) {
      return {
        type: 'text' as const,
        attrs: { x: 0, y: coordinates[0].y, text: '', align: 'right' as const, baseline: 'middle' as const },
        styles: axisPriceStyle,
      }
    }
    const last = chart.getDataList().at(-1)
    if (!last) {
      return {
        type: 'text' as const,
        attrs: { x: 0, y: coordinates[0].y, text: '', align: 'right' as const, baseline: 'middle' as const },
        styles: axisPriceStyle,
      }
    }
    const y = (chart.convertToPixel({ timestamp: last.timestamp, value: price }) as Partial<Coordinate>).y ?? coordinates[0].y
    const isFromZero = yAxis?.isFromZero() ?? false
    return {
      type: 'text',
      attrs: {
        x: isFromZero ? 0 : bounding.width,
        y,
        text: formatWesternGrouped(price, precision.price),
        align: isFromZero ? 'left' : 'right',
        baseline: 'middle',
      },
      styles: axisPriceStyle,
    }
  },
  onPressedMoveStart: () => false,
  onPressedMoving: () => false,
  onPressedMoveEnd: () => false,
  onMouseEnter: () => false,
  onMouseLeave: () => false,
  onSelected: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault()
    event.overlay.mode = 'normal'
    const ext = (event.overlay.extendData ?? {}) as WarningExtendData
    const key = ((event as unknown as { figureKey?: string }).figureKey ?? '')
    if (key === 'warning-info-close') {
      if (ext.warning) {
        removeHandler?.(ext.warning)
      }
      return false
    }
    const nextShow = !ext.showInfo
    event.overlay.extendData = { ...ext, showInfo: nextShow }
    return false
  },
  onRightClick: (event: OverlayEvent<unknown>) => {
    if (event.preventDefault) event.preventDefault()
    return false
  },
})

export default priceWarningLine
