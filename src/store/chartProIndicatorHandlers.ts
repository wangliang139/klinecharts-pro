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
  createIndicator: (chart: ProChart, indicatorName: string, isStack?: boolean, paneOptions?: { id: string }) => string | null | undefined;
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
        api.overrideIndicator({ name: payload.indicator.name, visible: true, paneId: payload.paneId });
        break;
      case "invisible":
        api.overrideIndicator({ name: payload.indicator.name, visible: false, paneId: payload.paneId });
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
          api.removeIndicator({ paneId: payload.paneId, name: payload.indicator.name, id: payload.indicator.id });
          nextMainIndicators.splice(nextMainIndicators.indexOf(payload.indicator.name), 1);
          options.setMainIndicators(nextMainIndicators);
        } else {
          const nextSubIndicators = { ...options.subIndicators() };
          api.removeIndicator({ paneId: payload.paneId, name: payload.indicator.name, id: payload.indicator.id });
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
      api.removeIndicator({ name: data.name, paneId: "candle_pane", id: data.id ?? undefined });
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
      api.removeIndicator({ name: data.name, id: data.id });
      delete nextSubIndicators[data.name];
    }
    options.setSubIndicators(nextSubIndicators);
  };

  const onIndicatorSettingConfirm = (params: Array<number>) => {
    const api = options.getApi();
    if (!api) return;
    const modalParams = options.indicatorSettingModalParams();
    api.overrideIndicator({ name: modalParams.indicatorName, calcParams: params, paneId: modalParams.paneId });
  };

  return {
    onIndicatorTooltipFeatureClick,
    onMainIndicatorChange,
    onSubIndicatorChange,
    onIndicatorSettingConfirm,
  };
}
