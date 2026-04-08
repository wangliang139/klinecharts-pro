import {
  ActionCallback,
  ActionType,
  BarSpace,
  Bounding,
  ConvertFilter,
  Coordinate,
  Crosshair,
  DataLoader,
  DecimalFold,
  DeepPartial,
  DomPosition,
  Formatter,
  Indicator,
  IndicatorCreate,
  IndicatorFilter,
  init,
  Chart as KLineChart,
  KLineData,
  Nullable,
  Options,
  Overlay,
  OverlayCreate,
  OverlayFilter,
  PaneOptions,
  Period,
  PickPartial,
  Point,
  Styles,
  SymbolInfo,
  ThousandsSeparator,
  VisibleRange,
  ZoomAnchor,
} from "klinecharts";
import { ProChart } from "./types/types";

export default class Chart implements ProChart {
  private _chart: KLineChart;
  private _charts: Map<string, KLineChart> = new Map<string, KLineChart>();

  public id: string;

  get chart(): KLineChart {
    return this._chart;
  }

  get charts(): KLineChart[] {
    return Array.from(this._charts.values());
  }

  constructor(ds: string | HTMLElement | undefined | null, options?: Options | undefined) {
    if (ds === undefined || ds === null) {
      throw new Error("Chart container is required");
    }
    if (typeof ds !== "string" && !(ds instanceof HTMLElement)) {
      throw new Error("Invalid chart container");
    }
    const chart = init(ds, options);

    if (!chart) {
      throw new Error("Failed to initialize chart");
    }
    this._chart = chart;
    this.id = chart.id;
  }

  static init(ds: string | HTMLElement | undefined | null, options?: Options | undefined): Chart {
    return new Chart(ds, options);
  }

  /**
   * Base Proxy Methods
   */

  getDom(paneId?: string, position?: DomPosition): Nullable<HTMLElement> {
    return this._chart.getDom(paneId, position);
  }
  getSize(paneId?: string, position?: DomPosition): Nullable<Bounding> {
    return this._chart.getSize(paneId, position);
  }
  createIndicator(value: string | IndicatorCreate, isStack?: boolean, paneOptions?: PaneOptions): Nullable<string> {
    return this._chart.createIndicator(value, isStack, paneOptions);
  }
  getIndicators(filter?: IndicatorFilter): Indicator[] {
    return this._chart.getIndicators(filter);
  }
  createOverlay(
    value: string | OverlayCreate | Array<string | OverlayCreate>,
  ): Nullable<string> | Array<Nullable<string>> {
    return this._chart.createOverlay(value);
  }
  getOverlays(filter?: OverlayFilter): Overlay[] {
    return this._chart.getOverlays(filter);
  }
  setPaneOptions(options: PaneOptions): void {
    return this._chart.setPaneOptions(options);
  }
  getPaneOptions(id?: string): Nullable<PaneOptions> | PaneOptions[] {
    return this._chart.getPaneOptions(id);
  }
  scrollByDistance(distance: number, animationDuration?: number): void {
    return this._chart.scrollByDistance(distance, animationDuration);
  }
  scrollToRealTime(animationDuration?: number): void {
    return this._chart.scrollToRealTime(animationDuration);
  }
  scrollToDataIndex(dataIndex: number, animationDuration?: number): void {
    return this._chart.scrollToDataIndex(dataIndex, animationDuration);
  }
  scrollToTimestamp(timestamp: number, animationDuration?: number): void {
    return this._chart.scrollToTimestamp(timestamp, animationDuration);
  }
  zoomAtCoordinate(scale: number, coordinate?: Coordinate, animationDuration?: number): void {
    return this._chart.zoomAtCoordinate(scale, coordinate, animationDuration);
  }
  zoomAtDataIndex(scale: number, dataIndex: number, animationDuration?: number): void {
    return this._chart.zoomAtDataIndex(scale, dataIndex, animationDuration);
  }
  zoomAtTimestamp(scale: number, timestamp: number, animationDuration?: number): void {
    return this._chart.zoomAtTimestamp(scale, timestamp, animationDuration);
  }
  convertToPixel(
    points: Partial<Point> | Array<Partial<Point>>,
    filter?: ConvertFilter,
  ): Partial<Coordinate> | Array<Partial<Coordinate>> {
    return this._chart.convertToPixel(points, filter);
  }
  convertFromPixel(
    coordinates: Array<Partial<Coordinate>>,
    filter?: ConvertFilter,
  ): Partial<Point> | Array<Partial<Point>> {
    return this._chart.convertFromPixel(coordinates, filter);
  }
  executeAction(type: ActionType, data: Crosshair): void {
    return this._chart.executeAction(type, data);
  }
  subscribeAction(type: ActionType, callback: ActionCallback): void {
    return this._chart.subscribeAction(type, callback);
  }
  unsubscribeAction(type: ActionType, callback?: ActionCallback): void {
    return this._chart.unsubscribeAction(type, callback);
  }
  getConvertPictureUrl(includeOverlay?: boolean, type?: "png" | "jpeg" | "bmp", backgroundColor?: string): string {
    return this._chart.getConvertPictureUrl(includeOverlay, type, backgroundColor);
  }
  resize(): void {
    return this._chart.resize();
  }

  /**
   * Store Proxy Methods
   */
  setStyles(value: string | DeepPartial<Styles>): void {
    return this._chart.setStyles(value);
  }
  getStyles(): Styles {
    return this._chart.getStyles();
  }
  setFormatter(formatter: Partial<Formatter>): void {
    return this._chart.setFormatter(formatter);
  }
  getFormatter(): Formatter {
    return this._chart.getFormatter();
  }
  setLocale(locale: string): void {
    return this._chart.setLocale(locale);
  }
  getLocale(): string {
    return this._chart.getLocale();
  }
  setTimezone(timezone: string): void {
    return this._chart.setTimezone(timezone);
  }
  getTimezone(): string {
    return this._chart.getTimezone();
  }
  setThousandsSeparator(thousandsSeparator: Partial<ThousandsSeparator>): void {
    return this._chart.setThousandsSeparator(thousandsSeparator);
  }
  getThousandsSeparator(): ThousandsSeparator {
    return this._chart.getThousandsSeparator();
  }
  setDecimalFold(decimalFold: Partial<DecimalFold>): void {
    return this._chart.setDecimalFold(decimalFold);
  }
  getDecimalFold(): DecimalFold {
    return this._chart.getDecimalFold();
  }
  //Still deciding about using type from klinecharts or our own type
  setSymbol(symbol: PickPartial<SymbolInfo, "pricePrecision" | "volumePrecision">): void {
    return this._chart.setSymbol(symbol);
  }
  //Still deciding about using type from klinecharts or our own type
  getSymbol(): Nullable<SymbolInfo> {
    return this._chart.getSymbol();
  }
  //Still deciding about using type from klinecharts or our own type
  setPeriod(period: Period): void {
    return this._chart.setPeriod(period);
  }
  //Still deciding about using type from klinecharts or our own type
  getPeriod(): Nullable<Period> {
    return this._chart.getPeriod();
  }
  getDataList(): KLineData[] {
    return this._chart.getDataList();
  }
  setOffsetRightDistance(distance: number): void {
    return this._chart.setOffsetRightDistance(distance);
  }
  getOffsetRightDistance(): number {
    return this._chart.getOffsetRightDistance();
  }
  setMaxOffsetLeftDistance(distance: number): void {
    return this._chart.setMaxOffsetLeftDistance(distance);
  }
  setMaxOffsetRightDistance(distance: number): void {
    return this._chart.setMaxOffsetRightDistance(distance);
  }
  setLeftMinVisibleBarCount(barCount: number): void {
    return this._chart.setLeftMinVisibleBarCount(barCount);
  }
  setRightMinVisibleBarCount(barCount: number): void {
    return this._chart.setRightMinVisibleBarCount(barCount);
  }
  setBarSpace(space: number): void {
    return this._chart.setBarSpace(space);
  }
  getBarSpace(): BarSpace {
    return this._chart.getBarSpace();
  }
  getVisibleRange(): VisibleRange {
    return this._chart.getVisibleRange();
  }
  setDataLoader(dataLoader: DataLoader): void {
    return this._chart.setDataLoader(dataLoader);
  }
  overrideIndicator(override: IndicatorCreate): boolean {
    return this._chart.overrideIndicator(override);
  }
  removeIndicator(filter?: IndicatorFilter): boolean {
    return this._chart.removeIndicator(filter);
  }
  overrideOverlay(override: Partial<OverlayCreate>): boolean {
    return this._chart.overrideOverlay(override);
  }
  removeOverlay(filter?: OverlayFilter): boolean {
    return this._chart.removeOverlay(filter);
  }
  setZoomEnabled(enabled: boolean): void {
    return this._chart.setZoomEnabled(enabled);
  }
  isZoomEnabled(): boolean {
    return this._chart.isZoomEnabled();
  }
  setZoomAnchor(Anchor: ZoomAnchor): void {
    this._chart.setZoomAnchor(Anchor);
  }
  getZoomAnchor(): ZoomAnchor {
    return this._chart.getZoomAnchor();
  }
  setScrollEnabled(enabled: boolean): void {
    return this._chart.setScrollEnabled(enabled);
  }
  isScrollEnabled(): boolean {
    return this._chart.isScrollEnabled();
  }
  resetData(): void {
    return this._chart.resetData();
  }

  /**
   * Custom methods
   */

  setActiveChart(id: string) {
    const chart = this._charts.get(id);
    if (chart) {
      this._chart = chart;
    }

    return this;
  }

  chartById(id: string): KLineChart | undefined {
    return this._charts.get(id);
  }

  getOverlayById(id: string): Nullable<Overlay> {
    return this._chart.getOverlays({ id })[0] ?? null;
  }
}
