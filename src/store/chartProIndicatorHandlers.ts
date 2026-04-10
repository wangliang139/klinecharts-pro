import type { Indicator, TooltipFeatureStyle } from "klinecharts";

import type { ProChart } from "../types/types";

export type SubIndicatorMap = Record<string, string>;
export type IndicatorSettingParams = {
  visible: boolean;
  indicatorName: string;
  paneId: string;
  calcParams: Indicator["calcParams"];
};

type IndicatorChangeData = {
  added: boolean;
  name: string;
  id?: string;
};

type IndicatorTooltipClickData = {
  paneId: string;
  feature: TooltipFeatureStyle;
  indicator: Indicator;
};

type CreateHandlersOptions = {
  getApi: () => ProChart | null | undefined;
  mainIndicators: () => string[];
  setMainIndicators: (next: string[]) => void;
  subIndicators: () => SubIndicatorMap;
  setSubIndicators: (next: SubIndicatorMap) => void;
  indicatorSettingModalParams: () => IndicatorSettingParams;
  setIndicatorSettingModalParams: (next: IndicatorSettingParams) => void;
  createIndicator: (
    chart: ProChart,
    indicatorName: string,
    isStack?: boolean,
    paneOptions?: { id: string },
  ) => string | null | undefined;
  popIndicator: (name: string, paneId?: string, id?: string) => boolean;
  setIndicatorVisible: (name: string, paneId: string, visible: boolean, id?: string) => void;
  modifyIndicator: (modalParams: IndicatorSettingParams, params: Array<number>) => void;
};

export const DEFAULT_INDICATOR_SETTING_PARAMS: IndicatorSettingParams = {
  visible: false,
  indicatorName: "",
  paneId: "",
  calcParams: [],
};

export function createChartIndicatorHandlers(options: CreateHandlersOptions) {
  const onIndicatorTooltipFeatureClick = (data: unknown) => {
    const payload = data as IndicatorTooltipClickData;
    const api = options.getApi();
    if (!api) return;
    switch (payload.feature.id) {
      case "visible":
        options.setIndicatorVisible(payload.indicator.name, payload.paneId, true, payload.indicator.id);
        break;
      case "invisible":
        options.setIndicatorVisible(payload.indicator.name, payload.paneId, false, payload.indicator.id);
        break;
      case "setting": {
        const indicator = api
          .getIndicators({ paneId: payload.paneId, name: payload.indicator.name, id: payload.indicator.id })
          .at(0);
        if (!indicator) return;
        options.setIndicatorSettingModalParams({
          visible: true,
          indicatorName: payload.indicator.name,
          paneId: payload.paneId,
          calcParams: indicator.calcParams,
        });
        break;
      }
      case "close": {
        if (payload.paneId === "candle_pane") {
          const nextMainIndicators = [...options.mainIndicators()];
          const removed = options.popIndicator(payload.indicator.name, payload.paneId, payload.indicator.id);
          if (!removed) break;
          nextMainIndicators.splice(nextMainIndicators.indexOf(payload.indicator.name), 1);
          options.setMainIndicators(nextMainIndicators);
        } else {
          const nextSubIndicators = { ...options.subIndicators() };
          const removed = options.popIndicator(payload.indicator.name, payload.paneId, payload.indicator.id);
          if (!removed) break;
          delete nextSubIndicators[payload.indicator.name];
          options.setSubIndicators(nextSubIndicators);
        }
        break;
      }
      default:
        break;
    }
  };

  const onMainIndicatorChange = (data: IndicatorChangeData) => {
    const api = options.getApi();
    if (!api) return;
    const nextMainIndicators = [...options.mainIndicators()];
    if (data.added) {
      options.createIndicator(api, data.name, true, { id: "candle_pane" });
      nextMainIndicators.push(data.name);
    } else {
      const removed = options.popIndicator(data.name, "candle_pane");
      if (!removed) return;
      nextMainIndicators.splice(nextMainIndicators.indexOf(data.name), 1);
    }
    options.setMainIndicators(nextMainIndicators);
  };

  const onSubIndicatorChange = (data: IndicatorChangeData) => {
    const api = options.getApi();
    if (!api) return;
    const nextSubIndicators = { ...options.subIndicators() };
    if (data.added) {
      const id = options.createIndicator(api, data.name);
      if (id) {
        nextSubIndicators[data.name] = id;
      }
    } else if (data.id) {
      const removed = options.popIndicator(data.name, undefined, data.id);
      if (!removed) return;
      delete nextSubIndicators[data.name];
    }
    options.setSubIndicators(nextSubIndicators);
  };

  const onIndicatorSettingConfirm = (params: Array<number>) => {
    const api = options.getApi();
    if (!api) return;
    const modalParams = options.indicatorSettingModalParams();
    options.modifyIndicator(modalParams, params);
  };

  return {
    onIndicatorTooltipFeatureClick,
    onMainIndicatorChange,
    onSubIndicatorChange,
    onIndicatorSettingConfirm,
  };
}
