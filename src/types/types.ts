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
  Chart,
  DataLoader,
  DeepPartial,
  Period as DefaultPeriod,
  FigureCreate,
  IndicatorCreate,
  KLineData,
  Nullable,
  Overlay,
  PaneOptions,
} from "klinecharts";
import { PaneProperties } from "../store/chartStore";
import { ProOverlayCreate } from "./overlayTypes";

export type FontWeights =
  | "thin"
  | "extra-light"
  | "light"
  | "normal"
  | "medium"
  | "semi-bold"
  | "bold"
  | "extra-bold"
  | "black";

export type DatafeedSubscribeCallback = (data: KLineData, timestamp?: number) => void;

export interface UndoOptions {
  /**
   * A boolean flag. Controls if undo should be disabled.
   */
  disableUndo?: boolean;
}

export interface SymbolInfo {
  ticker: string;
  name?: string;
  shortName?: string;
  exchange?: string;
  market?: string;
  pricePrecision?: number;
  volumePrecision?: number;
  priceCurrency?: string;
  dollarPerPip?: number;
  type?: string;
  logo?: string;
}

export interface Period extends DefaultPeriod {
  text: string;
}

export interface ProChart extends Chart {
  chart: Chart;
  charts: Array<Chart>;

  setActiveChart(id: string): void;
  chartById(id: string): Chart | undefined;
  getOverlayById(id: string): Nullable<Overlay>;
}

type IndicatorsType = {
  value?: IndicatorCreate;
  isStack?: boolean;
  paneOptions?: PaneOptions;
};

type OverlaysType = {
  value?: ProOverlayCreate;
  paneId: string;
};

type FiguresType = {
  value?: string | FigureCreate;
  ctx: CanvasRenderingContext2D;
};

/** 设置中「交易展示」持久化（不写入 Styles / styleObj） */
export interface TradingConfig {
  showPositions: boolean;
  showLiquidation: boolean;
  showOpenOrders: boolean;
  showHisOrders: boolean;
}

export interface PendingOrder {
  id?: string;
  side: PositionSide;
  isBuy: boolean;
  price?: number;
  size: number;
  orderType?: "limit" | "market";
}

export interface HisOrder {
  id?: string;
  orderId?: string | number;
  symbol?: string;
  side?: PositionSide;
  isBuy: boolean;
  timestamp: number;
  price: number;
  size: number;
  fee?: number;
  pnl?: number;
}

export type WarningType =
  | "price_reach"
  | "price_rise_to"
  | "price_fall_to"
  | "price_rise_pct_over"
  | "price_fall_pct_over";

export type WarningFrequency = "repeat" | "once";

export type WarningWindow = "5m" | "1h" | "4h" | "24h";

export interface WarningItem {
  id: string;
  type: WarningType;
  frequency: WarningFrequency;
  price?: number;
  window?: WarningWindow;
  percent?: number;
  remark?: string;
  symbol?: string;
}

export type WarningItemInput = Omit<WarningItem, "id"> & { id?: string };

export type PositionSide = "long" | "short";

export interface Position {
  id?: string;
  side: PositionSide;
  avgPrice: number;
  size: number;
  multiplier?: number;
}

export interface ChartObjType {
  styleObj?: DeepPartial<PaneProperties>;
  overlays?: OverlaysType[];
  figures?: FiguresType[];
  indicators?: IndicatorsType[];
  trading?: TradingConfig;
}

export interface Datafeed {
  searchSymbols(search?: string): Promise<SymbolInfo[]>;
  getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]>;
  subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void;
  unsubscribe(symbol: SymbolInfo, period: Period): void;
}

export interface ChartDataLoaderType extends DataLoader {
  searchSymbols(search?: string): Promise<SymbolInfo[]>;
  loading: boolean;
}

export interface ChartProOptions {
  container: string | HTMLElement;
  rootElementId?: string;
  watermark?: string | Node;
  theme?: string;
  locale?: string;
  drawingBarVisible?: boolean;
  symbol: SymbolInfo;
  period: Period;
  periods?: Period[];
  timezone?: string;
  mainIndicators?: string[];
  subIndicators?: string[];
  datafeed: Datafeed;
  dataTimestamp?: number;
  overrides?: DeepPartial<PaneProperties>;
  warnings?: WarningItem[];
  onAddWarning?: (warning: WarningItemInput) => void | Promise<void>;
  onRemoveWarning?: (warning: WarningItem) => void | Promise<void>;
}

export interface ChartPro {
  setTheme(theme: string): void;
  getTheme(): string;
  setStyles(styles: DeepPartial<PaneProperties>): void;
  getStyles(): DeepPartial<PaneProperties>;
  setLocale(locale: string): void;
  getLocale(): string;
  setTimezone(timezone: string): void;
  getTimezone(): string;
  setSymbol(symbol: SymbolInfo): void;
  getSymbol(): SymbolInfo;
  setPeriod(period: Period): void;
  getPeriod(): Period;
  getInstanceApi(): Nullable<Chart>;
  resize(): void;
  dispose(): void;
  setPositions(positions: Position[]): void;
  setLiqPrice(price: number | null): void;
  setOpenOrders(orders: PendingOrder[]): void;
  setHisOrders(orders: HisOrder[]): void;
  setWarnings(warnings: WarningItem[]): void;
}
