import { Chart, DomPosition, Nullable, Overlay, YAxis } from "klinecharts"
import { FontWeights } from "./types/types"

/** 与 `base.less` 中变量名一致，供 canvas 内 overlay 与 trading overlay signature 共用 */
/** 价格预警虚线与右侧三角箭头共用 */
export const KLINE_PRO_VAR_PRICE_ALERT_LINE = "--klinecharts-pro-price-alert-line-color"

/** 与 light 主题下 `--klinecharts-pro-price-alert-line-color` 默认一致，无 DOM/CSS 时的兜底 */
export const KLINE_PRO_FALLBACK_PRICE_ALERT_LINE = "#76808F"

function getKlineProScope(chart: {
  getDom: (paneId?: string, position?: DomPosition) => Nullable<HTMLElement>;
}): HTMLElement | null {
  const paneDom = chart.getDom("candle_pane", "main");
  if (!paneDom) return null;
  return paneDom.closest(".klinecharts-pro") as HTMLElement | null;
}

/**
 * 从 `.klinecharts-pro` 作用域读取 CSS 变量（已解析为可传给 canvas 的颜色字符串，如 `#76808f` / `rgb(...)`）。
 * 无窗口或变量未定义时返回 fallback。
 */
export function getKlineProCssVariable(
  chart: {
    getDom: (paneId?: string, position?: DomPosition) => Nullable<HTMLElement>;
  },
  varName: string,
  fallback: string,
): string {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return fallback;
  }
  const scope = getKlineProScope(chart);
  if (!scope) return fallback;
  const raw = window.getComputedStyle(scope).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  return raw;
}

/** 西式分组：千分位 `,`、小数 `.`（如 12,345.67） */
export function formatWesternGrouped(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(value)
}

export const getScreenSize = () => {
	return {x: window.innerWidth, y: window.innerHeight}
}

export const getPrecision = (chart: Chart, overlay: Overlay<unknown>, yAxis: Nullable<YAxis>):{ price: number, volume: number } => {
	const precision = {
		price: 0,
		volume: 0
	}

	const symbol = chart.getSymbol()
	if ((yAxis?.isInCandle() ?? true) && symbol) {
		precision.price = symbol.pricePrecision
		precision.volume = symbol.volumePrecision
	} else {
		const indicators = chart.getIndicators({ paneId: overlay.paneId })
		indicators.forEach(indicator => {
			precision.price = Math.max(precision.price, indicator.precision)
		})
	}

	return precision
}

export const convertFontweightNameToNumber = (weight: FontWeights): number => {
	const weights: { [key: string]: number } = {
		'thin': 100, 'extra-light': 200, 'light': 300, 'normal': 400, 'medium': 500, 'semi-bold': 600, 'bold': 700, 'extra-bold': 800, 'black': 900
	}

	return weights[weight]
}

export const formatTimeByTz = (timestamp: number, locale: string, timezone: string): string => {
	try {
		return new Intl.DateTimeFormat(locale, {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		}).format(timestamp)
	} catch {
		return new Date(timestamp).toLocaleString(locale)
	}
}