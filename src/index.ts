/// <reference path="./vite-env.d.ts" />
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

import { registerOverlay } from 'klinecharts'

import overlays from './extension'

import DefaultDatafeed from './DefaultDatafeed'
import KLineChartPro from './KLineChartPro'

import { load } from './i18n'

import {
  ChartObjType,
  ChartPro,
  ChartProOptions,
  Datafeed,
  DatafeedSubscribeCallback,
  HisOrder,
  PendingOrder,
  Period,
  Position,
  PositionSide,
  ProChart,
  SymbolInfo,
  TradingConfig,
  WarningFrequency,
  WarningItem,
  WarningItemInput,
  WarningType,
  WarningWindow
} from './types/types'

import './index.less'

console.log(`[@wangliang139/klinecharts-pro] v${__KLINECHARTS_PRO_VERSION__}`)

console.log("overlays:", overlays);
overlays.forEach(o => { registerOverlay(o) })

export {
  DefaultDatafeed,
  KLineChartPro,
  load as loadLocales
}

export type { ChartObjType, ChartPro, ChartProOptions, Datafeed, DatafeedSubscribeCallback, HisOrder, PendingOrder, Period, Position, PositionSide, ProChart, SymbolInfo, TradingConfig, WarningFrequency, WarningItem, WarningItemInput, WarningType, WarningWindow }

