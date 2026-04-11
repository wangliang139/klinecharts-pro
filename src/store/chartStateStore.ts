import {
  DeepPartial,
  Indicator,
  IndicatorCreate,
  IndicatorTooltipData,
  Nullable,
  Overlay,
  OverlayCreate,
  OverlayEvent,
  PaneOptions,
  TooltipFeatureStyle,
} from "klinecharts";
import loadash from "lodash";
import { ChartObjType, IndicatorsType, OverlayProperties, ProChart, ProOverlay } from "../types";
import {
  instanceApi,
  mainIndicators,
  PaneProperties,
  selectedOverlay,
  setChartModified,
  setMainIndicators,
  setSelectedOverlay,
  setStyles,
  setSubIndicators,
  subIndicators,
} from "./chartStore";

export const documentResize = () => {
  instanceApi()?.resize();
};

export const cleanup = async () => {
  //Cleanup objects when leaving chart page
  const doJob = async () => {
    // clearInterval(timerid())
    // datafeed()!.unsubscribe()
    // dispose(widgetref()!)
  };
  doJob();
};

type IndicatorChageType = {
  name: string;
  paneId: string;
  added: boolean;
};

type IndicatorSettingsType = {
  visible: boolean;
  indicatorName: string;
  paneId: string;
  calcParams: any[];
};

type RestoredIndicators = {
  mainIndicators: string[];
  subIndicators: Record<string, string>;
};

type CssRootVar =
  | "--klinecharts-pro-primary-color"
  | "--klinecharts-pro-primary-color"
  | "--klinecharts-pro-hover-background-color"
  | "--klinecharts-pro-background-color"
  | "--klinecharts-pro-popover-background-color"
  | "--klinecharts-pro-text-color"
  | "--klinecharts-pro-text-second-color"
  | "--klinecharts-pro-border-color"
  | "--klinecharts-pro-selected-color"
  | "--klinecharts-pro-period-hover-background-color"
  | "--klinecharts-pro-popup-shadow-color"
  | "--klinecharts-pro-pane-background"
  | "--klinecharts-pro-pane-background-gradient-start"
  | "--klinecharts-pro-pane-background-gradient-end";

const refineIndiObj = (indicator: Indicator): IndicatorCreate => {
  const keys = ["calc", "figures", "regenerateFigures", "draw", "createTooltipDataSource"];

  let cleanIndicator: IndicatorCreate = indicator;

  keys.forEach((key) => {
    // @ts-expect-error
    delete cleanIndicator[key];
  });

  return cleanIndicator;
};

/**
 * Removes all event listeners from the overlay object
 *
 * @param overlay
 * @returns
 */
const refineOverlayObj = (overlay: Overlay): OverlayCreate => {
  const keys = [
    "onDrawStart",
    "onDrawing",
    "onDrawEnd",
    "onClick",
    "onDoubleClick",
    "onRightClick",
    "onMouseEnter",
    "onMouseLeave",
    "onPressedMoveStart",
    "onPressedMoving",
    "onPressedMoveEnd",
    "onRemoved",
    "onSelected",
    "onDeselected",
    "performEventMoveForDrawing",
    "performEventPressedMove",
    "_prevPressedPoint",
    "_prevPressedPoints",
    "createPointFigures",
    "createXAxisFigures",
    "createYAxisFigures",
  ];
  let cleanOverlay: OverlayCreate = overlay;

  keys.forEach((key) => {
    // @ts-expect-error
    delete cleanOverlay[key];
  });
  return cleanOverlay;
};

function readChartStateObj(): ChartObjType {
  try {
    const raw = localStorage.getItem("chartstatedata");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChartObjType;
    if (Array.isArray(parsed.indicators)) {
      parsed.indicators = parsed.indicators
        .map(indicator => normalizeIndicatorsType(indicator))
        .filter((indicator): indicator is IndicatorsType => indicator !== null);
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeChartStateObj(chartObj: ChartObjType): void {
  localStorage.setItem("chartstatedata", JSON.stringify(chartObj));
}

function isSubIndicatorPane(paneId?: string): boolean {
  return !!paneId && paneId !== "candle_pane";
}

function toIndicatorsType(indicator: Indicator, paneOptions?: PaneOptions): IndicatorsType {
  return {
    name: indicator.name,
    visible: indicator.visible ?? true,
    calcParams: Array.isArray(indicator.calcParams) ? [...indicator.calcParams] as Array<number> : [],
    isMainPane: paneOptions?.id === "candle_pane",
  };
}

function toIndicatorCreate(indicator: IndicatorsType): IndicatorCreate {
  return {
    name: indicator.name,
    visible: indicator.visible,
    calcParams: indicator.calcParams,
  };
}

function normalizeIndicatorsType(input: unknown): IndicatorsType | null {
  if (!input || typeof input !== "object") return null;

  const next = input as Partial<IndicatorsType> & {
    value?: Partial<IndicatorCreate>;
    paneOptions?: Partial<PaneOptions>;
  };

  if (typeof next.name === "string" && typeof next.visible === "boolean" && Array.isArray(next.calcParams)) {
    return {
      name: next.name,
      visible: next.visible,
      calcParams: next.calcParams.map(value => Number(value)).filter(value => Number.isFinite(value)),
      isMainPane: next.isMainPane === true,
    };
  }

  if (typeof next.value?.name === "string") {
    return {
      name: next.value.name,
      visible: typeof next.value.visible === "boolean" ? next.value.visible : true,
      calcParams: Array.isArray(next.value.calcParams)
        ? next.value.calcParams.map(value => Number(value)).filter(value => Number.isFinite(value))
        : [],
      isMainPane: next.paneOptions?.id === "candle_pane",
    };
  }

  return null;
}

export const useChartState = () => {
  const syncIndiObject = (indicator: Indicator, isStack?: boolean, paneOptions?: PaneOptions): boolean => {
    const chartObj = readChartStateObj();
    const indi = toIndicatorsType(refineIndiObj(loadash.cloneDeep(indicator)) as Indicator, paneOptions);
    if (!chartObj.indicators) {
      chartObj.indicators = [indi];
    } else {
      const matchedIndex = chartObj.indicators.findIndex(
        (_indi) => _indi.name === indi.name && _indi.isMainPane === indi.isMainPane,
      );
      if (matchedIndex > -1) {
        chartObj.indicators[matchedIndex] = indi;
      } else {
        chartObj.indicators.push(indi);
      }
    }
    writeChartStateObj(chartObj);
    setChartModified(true);
    return false;
  };

  const syncObject = (overlay: ProOverlay): boolean => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    let chartObj: ChartObjType;

    const overly = refineOverlayObj(loadash.cloneDeep(overlay));
    if (chartStateObj) {
      chartObj = JSON.parse(chartStateObj!);
      if (!chartObj.overlays) {
        chartObj.overlays = [
          {
            value: overlay,
            paneId: overlay.paneId,
          },
        ];
      } else {
        if (chartObj.overlays.find((ovaly) => ovaly.value?.id === overly.id)) {
          chartObj.overlays = chartObj.overlays.map((ovaly) =>
            ovaly.value?.id !== overly.id
              ? ovaly
              : {
                  value: overly,
                  paneId: overlay.paneId,
                },
          );
        } else {
          chartObj.overlays!.push({
            value: overly,
            paneId: overlay.paneId,
          });
        }
      }
    } else {
      chartObj = {
        overlays: [
          {
            value: overly,
            paneId: overlay.paneId,
          },
        ],
      };
    }
    localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
    setChartModified(true);
    return false;
  };

  function createIndicator(
    widget: ProChart,
    indicatorName: string | IndicatorCreate,
    isStack?: boolean,
    paneOptions?: PaneOptions,
    docallback = false,
  ): Nullable<string> {
    const resolvedIndicatorName = typeof indicatorName === "string" ? indicatorName : indicatorName.name;
    if (resolvedIndicatorName === "VOL") {
      paneOptions = { axis: { gap: { bottom: 2 } }, ...paneOptions };
    }
    const isCandlePane = paneOptions?.id === "candle_pane";
    const indicatorValue = typeof indicatorName === "string" ? { name: indicatorName } : loadash.cloneDeep(indicatorName);
    const id =
      widget.createIndicator(
        {
          ...indicatorValue,
          name: resolvedIndicatorName,
          createTooltipDataSource: (param): IndicatorTooltipData => {
            const indiStyles = param.chart.getStyles().indicator;
            const features = indiStyles.tooltip.features;
            const icons: TooltipFeatureStyle[] = [];

            if (isCandlePane) {
              icons.push(param.indicator.visible ? features[1] : features[0]);
            }
            icons.push(features[2]);
            icons.push(features[3]);

            // 仅覆盖 features；name / calcParamsText / legends 由库内默认逻辑生成（见 KLineChart IndicatorTooltipView）
            return { features: icons } as IndicatorTooltipData;
          },
        },
        isStack,
        paneOptions,
      ) ?? null;

    if (id && docallback) {
      const indi = widget?.getIndicators({ id, name: resolvedIndicatorName })[0];
      if (indi) {
        const nextPaneOptions = paneOptions?.id === "candle_pane" ? paneOptions : { ...(paneOptions ?? {}), id };
        syncIndiObject(indi as Indicator, isStack, nextPaneOptions);
      }
    }

    return id;
  }

  const restoreIndicators = (
    widget: ProChart,
    fallbackMainIndicators: string[],
    fallbackSubIndicators: string[],
  ): RestoredIndicators => {
    const chartObj = readChartStateObj();
    const storedIndicators = chartObj.indicators ?? [];
    const hasStoredIndicators = Array.isArray(chartObj.indicators);
    const mainIndicatorNames: string[] = [];
    const subIndicatorMap: Record<string, string> = {};

    if (hasStoredIndicators) {
      const restoredSubIndicatorNames = new Set<string>();
      storedIndicators.forEach((indicator) => {
        const isSubIndicator = !indicator.isMainPane;
        if (isSubIndicator && restoredSubIndicatorNames.has(indicator.name)) {
          return;
        }
        const id = createIndicator(
          widget,
          toIndicatorCreate(indicator),
          indicator.isMainPane,
          indicator.isMainPane ? { id: "candle_pane" } : undefined,
        );
        if (indicator.isMainPane) {
          mainIndicatorNames.push(indicator.name);
        } else if (id) {
          subIndicatorMap[indicator.name] = id;
          restoredSubIndicatorNames.add(indicator.name);
        }
      });
      return { mainIndicators: mainIndicatorNames, subIndicators: subIndicatorMap };
    }

    fallbackMainIndicators.forEach((indicator) => {
      createIndicator(widget, indicator, true, { id: "candle_pane" }, true);
      mainIndicatorNames.push(indicator);
    });
    fallbackSubIndicators.forEach((indicator) => {
      const id = createIndicator(widget, indicator, false, undefined, true);
      if (id) {
        subIndicatorMap[indicator] = id;
      }
    });

    return { mainIndicators: mainIndicatorNames, subIndicators: subIndicatorMap };
  };

  const pushOverlay = (
    overlay: OverlayCreate & { properties?: DeepPartial<OverlayProperties> },
    paneId?: string,
    redrawing = false,
  ) => {
    const id = instanceApi()?.createOverlay({ ...overlay, paneId }) as Nullable<string>;

    if (!id) return false;

    const ovrly = instanceApi()?.getOverlays({ id: id })[0];

    const handleOverlayDeleteGesture = (event: OverlayEvent<unknown>) => {
      if (event.preventDefault) event.preventDefault();
      popOverlay(event.overlay.id);
      return true;
    };
    if (ovrly) {
      // const style = !redrawing && useGetOverlayStyle[`${ovrly.name}Style`] ? useGetOverlayStyle[`${ovrly.name}Style`]() : undefined
      if (overlay.properties) (ovrly as ProOverlay).setProperties(overlay.properties, id);
      instanceApi()?.overrideOverlay({
        id: ovrly.id,
        // styles: overlay.styles ?? style,
        onDrawEnd: (event) => {
          // console.info("on draw end called");
          if (!["measure"].includes(ovrly.name)) return syncObject(event.overlay as ProOverlay);
          return false;
        },
        onPressedMoveEnd: (event) => {
          // console.info("on pressed move end called");
          if (!["measure"].includes(ovrly.name)) return syncObject(event.overlay as ProOverlay);
          return false;
        },
        onSelected: (event) => setSelectedOverlay(event.overlay as ProOverlay),
        onDeselected: () => setSelectedOverlay(null),
        onRightClick: ovrly.onRightClick ? ovrly.onRightClick : handleOverlayDeleteGesture,
        onDoubleClick: ovrly.onDoubleClick ? ovrly.onDoubleClick : handleOverlayDeleteGesture,
      });
      if (!redrawing) syncObject(ovrly as ProOverlay);
    }
  };

  const popOverlay = (id: string) => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    if (chartStateObj) {
      let chartObj: ChartObjType = JSON.parse(chartStateObj);

      chartObj.overlays = chartObj.overlays?.filter((overlay) => overlay.value?.id !== id);
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
    }
    instanceApi()?.removeOverlay({ id });
    if (selectedOverlay()?.id === id) setSelectedOverlay(null);
  };

  const modifyOverlay = (id: string, modifyInfo: Partial<OverlayCreate<unknown>>) => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    if (chartStateObj) {
      let chartObj: ChartObjType = JSON.parse(chartStateObj);

      chartObj.overlays = chartObj.overlays?.map((overlay) => {
        if (overlay.value?.id === id) {
          overlay.value = { ...overlay.value, ...modifyInfo };
          overlay.paneId = modifyInfo.paneId ?? overlay.paneId;
        }
        return overlay;
      });
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
      instanceApi()?.overrideOverlay({ ...modifyInfo, id });
    }
  };

  const modifyOverlayProperties = (id: string, properties: DeepPartial<OverlayProperties>) => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    if (chartStateObj) {
      let chartObj: ChartObjType = JSON.parse(chartStateObj);

      chartObj.overlays = chartObj.overlays?.map((overlay) => {
        if (overlay.value?.id === id) {
          overlay.value.properties = { ...overlay.value.properties, ...properties };
        }
        return overlay;
      });
      const ovrl = instanceApi()?.getOverlayById(id);
      if (ovrl) {
        (ovrl as ProOverlay).setProperties(properties, id);
      }
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
    }
  };

  const pushMainIndicator = (data: IndicatorChageType) => {
    const newMainIndicators = [...mainIndicators()];
    if (data.added) {
      createIndicator(instanceApi()!, data.name, true, { id: "candle_pane" }, true);
      newMainIndicators.push(data.name);
    } else {
      popIndicator(data.name, "candle_pane");
      newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1);
    }
    setMainIndicators(newMainIndicators);
  };

  const pushSubIndicator = (data: IndicatorChageType) => {
    const newSubIndicators = { ...subIndicators() };
    if (data.added) {
      const paneId = createIndicator(instanceApi()!, data.name, false, undefined, true);
      if (paneId) {
        // @ts-expect-error
        newSubIndicators[data.name] = paneId;
      }
    } else {
      if (data.paneId) {
        popIndicator(data.name, data.paneId);
        // @ts-expect-error
        delete newSubIndicators[data.name];
      }
    }
    setSubIndicators(newSubIndicators);
  };

  const modifyIndicator = (modalParams: IndicatorSettingsType, params: any) => {
    const chartObj = readChartStateObj();
    const isMainPane = modalParams.paneId === "candle_pane";
    chartObj.indicators = chartObj.indicators?.map((indi) => {
      if (indi.name === modalParams.indicatorName && indi.isMainPane === isMainPane) {
        indi.calcParams = [...params];
      }
      return indi;
    });
    writeChartStateObj(chartObj);
    setChartModified(true);
    instanceApi()?.overrideIndicator({
      name: modalParams.indicatorName,
      calcParams: params,
      paneId: modalParams.paneId,
    });
  };
  const setIndicatorVisible = (name: string, paneId: string, visible: boolean, id?: string) => {
    const chartObj = readChartStateObj();
    const isMainPane = paneId === "candle_pane";
    chartObj.indicators = chartObj.indicators?.map((indi) => {
      if (indi.name === name && indi.isMainPane === isMainPane) {
        indi.visible = visible;
      }
      return indi;
    });
    writeChartStateObj(chartObj);
    setChartModified(true);
    instanceApi()?.overrideIndicator({ name, paneId, visible, id });
  };
  const popIndicator = (name: string, paneId?: string, id?: string): boolean => {
    const api = instanceApi();
    if (!api) {
      return false;
    }
    let removed = false;
    if (paneId && paneId !== "candle_pane") {
      removed = api.removeIndicator({ paneId, name });
    }
    if (!removed && id) {
      removed = api.removeIndicator({ id });
    }
    if (!removed && paneId) {
      removed = api.removeIndicator({ paneId, name });
    }
    if (!removed) {
      return false;
    }
    const chartObj = readChartStateObj();
    chartObj.indicators = chartObj.indicators?.filter((indi) => {
      if (isSubIndicatorPane(paneId)) {
        return indi.name !== name || indi.isMainPane;
      }
      return !(indi.name === name && indi.isMainPane);
    });
    writeChartStateObj(chartObj);
    setChartModified(true);
    return true;
  };

  const setCssRootVar = (name: CssRootVar, value: string) => {
    document.documentElement.style.setProperty(name, value, "important");
    const root = document.querySelector("[data-theme]");
    if (root) (root as HTMLElement).style.setProperty(name, value, "important");
  };

  const applyStyleOverrides = (overrides: DeepPartial<PaneProperties>) => {
    // background
    if (overrides.background) {
      setCssRootVar("--klinecharts-pro-pane-background", overrides.background as string);
    }

    // gradient
    if (overrides.backgroundGradientStartColor) {
      setCssRootVar(
        "--klinecharts-pro-pane-background-gradient-start",
        overrides.backgroundGradientStartColor as string,
      );
    }
    if (overrides.backgroundGradientEndColor) {
      setCssRootVar("--klinecharts-pro-pane-background-gradient-end", overrides.backgroundGradientEndColor as string);
    }

    // separator -> use border color var
    if (overrides.separator?.color) {
      setCssRootVar("--klinecharts-pro-border-color", overrides.separator.color as string);
    }
  };

  const restoreChartState = async (overrides?: DeepPartial<PaneProperties>) => {
    const redraw = (chartStateObj: string) => {
      const chartObj = JSON.parse(chartStateObj) as ChartObjType;

      if (chartObj.figures) {
      }
      if (chartObj.overlays) {
        chartObj.overlays.forEach((overlay) => {
          pushOverlay(overlay.value!, overlay.paneId, true);
        });
      }
    };

    // if (chartsession()?.chart) {
    //   let chartStateObj = atob(chartsession()?.chart!)

    //   if (chartStateObj) {
    //     if (chartStateObj !== localStorage.getItem(`chartstatedata`))
    //       localStorage.setItem(`chartstatedata`, chartStateObj)

    //     return redraw(chartStateObj)
    //   }
    // }

    const chartStateObj = localStorage.getItem(`chartstatedata`)!;
    if (chartStateObj) redraw(chartStateObj);

    const chartObj = (JSON.parse(chartStateObj) as ChartObjType) ?? {};
    if (overrides) {
      applyStyleOverrides(overrides);

      if (!chartObj.styleObj) {
        chartObj.styleObj = overrides;
        localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      }
    }
    if (chartObj.styleObj) setStyles(chartObj.styleObj);
  };

  return {
    createIndicator,
    modifyIndicator,
    popIndicator,
    syncIndiObject,
    syncObject,
    pushOverlay,
    modifyOverlay,
    modifyOverlayProperties,
    popOverlay,
    pushMainIndicator,
    pushSubIndicator,
    restoreChartState,
    restoreIndicators,
    setIndicatorVisible,
  };
};
