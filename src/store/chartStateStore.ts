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
import { ChartObjType, OverlayProperties, ProChart, ProOverlay } from "../types";
import {
  instanceApi,
  mainIndicators,
  PaneProperties,
  setChartModified,
  setMainIndicators,
  setSelectedOverlay,
  setStyles,
  setSubIndicators,
  subIndicators,
} from "./chartStore";
import { ctrlKeyedDown } from "./keyEventStore";
import { overlayType, useOverlaySettings } from "./overlaySettingStore";

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

export const useChartState = () => {
  const syncIndiObject = (indicator: Indicator, isStack?: boolean, paneOptions?: PaneOptions): boolean => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    let chartObj: ChartObjType;

    const indi = refineIndiObj(loadash.cloneDeep(indicator));
    if (chartStateObj) {
      chartObj = JSON.parse(chartStateObj!);
      if (!chartObj.indicators) {
        chartObj.indicators = [
          {
            value: indi,
            isStack: isStack,
            paneOptions,
          },
        ];
        // chartObj = {
        //   styleObj: chartObj.styleObj,
        //   overlays: chartObj.overlays,
        //   figures: chartObj.figures,
        //   indicators: [{
        //     value: indi,
        //     isStack: isStack,
        //     paneOptions
        //   }]
        // }
      } else {
        if (
          chartObj.indicators.find(
            (_indi) => _indi.value?.name === indi.name && _indi.paneOptions?.id === paneOptions?.id,
          )
        ) {
          chartObj.indicators = chartObj.indicators.map((_indi) =>
            _indi.value?.id !== indi.id
              ? _indi
              : {
                  value: indi,
                  isStack,
                  paneOptions,
                },
          );
        } else {
          chartObj.indicators!.push({
            value: indi,
            isStack,
            paneOptions,
          });
        }
      }
    } else {
      chartObj = {
        indicators: [
          {
            value: indi,
            isStack,
            paneOptions,
          },
        ],
      };
    }
    localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
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
    indicatorName: string,
    isStack?: boolean,
    paneOptions?: PaneOptions,
    docallback = false,
  ): Nullable<string> {
    if (indicatorName === "VOL") {
      paneOptions = { axis: { gap: { bottom: 2 } }, ...paneOptions };
    }
    const isCandlePane = paneOptions?.id === "candle_pane";
    const id =
      widget.createIndicator(
        {
          name: indicatorName,
          createTooltipDataSource: (param): IndicatorTooltipData => {
            const indiStyles = param.chart.getStyles().indicator;
            const features = indiStyles.tooltip.features;
            const icons: TooltipFeatureStyle[] = [];

            if (isCandlePane) {
              icons.push(param.indicator.visible ? features[1] : features[0]);
            }
            icons.push(features[2]);
            icons.push(features[3]);

            return {
              // name: `${indicatorName}_${id}`,
              // calcParamsText: indicatorName,
              features: icons,
              // legends: []
            };
          },
        },
        isStack,
        paneOptions,
      ) ?? null;

    if (id && docallback) {
      const indi = widget?.getIndicators({ id, name: indicatorName })[0];
      if (indi) syncIndiObject(indi as Indicator, isStack, { id: id });
    }

    return id;
  }

  const pushOverlay = (
    overlay: OverlayCreate & { properties?: DeepPartial<OverlayProperties> },
    paneId?: string,
    redrawing = false,
  ) => {
    const id = instanceApi()?.createOverlay({ ...overlay, paneId }) as Nullable<string>;

    if (!id) return false;

    const ovrly = instanceApi()?.getOverlays({ id: id })[0];

    const handleRightClick = (event: OverlayEvent<unknown>) => {
      if (event.preventDefault) event.preventDefault();
      console.info("on right click called", event.preventDefault);
      if (ctrlKeyedDown()) {
        console.info("control key down");
        popOverlay(event.overlay.id);
        return true;
      }
      useOverlaySettings().openPopup(event, { overlayType: event.overlay.name as overlayType });
      // popOverlay(event.overlay.id)
      return true;
    };
    if (ovrly) {
      // const style = !redrawing && useGetOverlayStyle[`${ovrly.name}Style`] ? useGetOverlayStyle[`${ovrly.name}Style`]() : undefined
      if (overlay.properties) (ovrly as ProOverlay).setProperties(overlay.properties, id);
      instanceApi()?.overrideOverlay({
        id: ovrly.id,
        // styles: overlay.styles ?? style,
        onDrawEnd: (event) => {
          console.info("on draw end called");
          if (!["measure"].includes(ovrly.name)) return syncObject(event.overlay as ProOverlay);
          return false;
        },
        onPressedMoveEnd: (event) => {
          console.info("on pressed move end called");
          if (!["measure"].includes(ovrly.name)) return syncObject(event.overlay as ProOverlay);
          return false;
        },
        onSelected: (event) => setSelectedOverlay(event.overlay as ProOverlay),
        onDeselected: () => setSelectedOverlay(null),
        onRightClick: ovrly.onRightClick ? ovrly.onRightClick : handleRightClick,
        onDoubleClick: ovrly.onDoubleClick ? ovrly.onDoubleClick : handleRightClick,
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
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    if (chartStateObj) {
      let chartObj: ChartObjType = JSON.parse(chartStateObj);

      chartObj.indicators = chartObj.indicators?.map((indi) => {
        if (indi.value?.name === modalParams.indicatorName) {
          indi.value.name = modalParams.indicatorName;
          indi.value.calcParams = params;
          indi.paneOptions!.id = modalParams.paneId;
        }
        return indi;
      });
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
      instanceApi()?.overrideIndicator({
        name: modalParams.indicatorName,
        calcParams: params,
        paneId: modalParams.paneId,
      });
    }
  };
  const popIndicator = (id: string, name?: string, paneId?: string) => {
    const chartStateObj = localStorage.getItem(`chartstatedata`);
    instanceApi()?.removeIndicator({ id, paneId, name });

    if (chartStateObj) {
      let chartObj: ChartObjType = JSON.parse(chartStateObj);

      chartObj.indicators = chartObj.indicators?.filter(
        (indi) => indi.paneOptions?.id !== paneId && indi.value?.name !== name,
      );
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
    }
    return;
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
      if (chartObj.indicators) {
        setTimeout(() => {
          const newMainIndicators = [...mainIndicators()];
          const newSubIndicators = { ...subIndicators };

          chartObj.indicators!.forEach((indicator) => {
            if (indicator.value) {
              instanceApi()?.createIndicator(indicator.value, indicator.isStack, indicator.paneOptions);
              if (indicator.paneOptions?.id === "candle_pane") {
                newMainIndicators.push(indicator.value.name);
              } else {
                //@ts-expect-error
                newSubIndicators[indicator.value.name] = indicator.paneOptions?.id;
              }
            }
          });
          setMainIndicators(newMainIndicators);
          setSubIndicators(newSubIndicators);
        }, 500);
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
  };
};
