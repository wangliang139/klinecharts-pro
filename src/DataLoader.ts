import { DataLoaderGetBarsParams, DataLoaderSubscribeBarParams, DataLoaderUnsubscribeBarParams } from "klinecharts";
import { setLoadingVisible } from "./store/chartStore";
import { ChartDataLoaderType, Datafeed, Period, SymbolInfo } from "./types/types";

export default class ChartDataLoader implements ChartDataLoaderType {
  private _datafeed: Datafeed;
  private _loading: boolean;

  constructor(datafeed: Datafeed) {
    this._datafeed = datafeed;
    this._loading = false;
  }

  async getBars (params: DataLoaderGetBarsParams): Promise<void> {
    // console.info('ChartDataLoader getBars', params);
    const { type, timestamp: _t, symbol: s, period: _p, callback } = params;
    const p = _p as Period;
      if (type === 'backward' || type === 'update') {
        // console.info('getBars: type is backward or update (no forward support yet)');
        callback([], false);
        return;
      }
      this._loading = true
      setLoadingVisible(true)
      const timestamp = _t ?? new Date().getTime()
      const get = async () => {
        const [to] = this.adjustFromTo(p, timestamp!, 1)
        const [from] = this.adjustFromTo(p, to, 500)
        const kLineDataList = await this._datafeed.getHistoryKLineData(s, p, from, to)
        callback(kLineDataList, kLineDataList.length > 0)
        this._loading = false
        setLoadingVisible(false)
      }
      await get();
  }

  subscribeBar (params: DataLoaderSubscribeBarParams): void {
    // console.info('ChartDataLoader subscribeBar', params);
    const { symbol: s, period: _p, callback } = params;
    this._datafeed.subscribe(s, _p as Period, callback)
  }

  unsubscribeBar (params: DataLoaderUnsubscribeBarParams): void {
    // console.info('ChartDataLoader unsubscribeBar', params);
    const { symbol: s, period: _p } = params;
    this._datafeed.unsubscribe(s, _p as Period)
  }

  searchSymbols(search?: string): Promise<SymbolInfo[]> {
    return this._datafeed.searchSymbols(search)
  }

  get loading(): boolean {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;
  }

  adjustFromTo(period: Period, toTimestamp: number, count: number) {
    let to = toTimestamp
    let from = to

    switch (period.type) {
      case 'minute':
        to -= to % (60 * 1000)
        from = to - count * period.span * 60 * 1000
        break

      case 'hour':
        to -= to % (60 * 60 * 1000)
        from = to - count * period.span * 60 * 60 * 1000
        break

      case 'day':
        to -= to % (24 * 60 * 60 * 1000)
        from = to - count * period.span * 24 * 60 * 60 * 1000
        break

      case 'week': {
        const date = new Date(to)
        const day = date.getDay() || 7 // Sunday -> 7
        date.setHours(0, 0, 0, 0)
        to = date.getTime() - (day - 1) * 24 * 60 * 60 * 1000
        from = to - count * period.span * 7 * 24 * 60 * 60 * 1000
        break
      }

      case 'month': {
        const date = new Date(to)
        to = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
        const _from = new Date(to - count * period.span * 30 * 24 * 60 * 60 * 1000)
        from = new Date(_from.getFullYear(), _from.getMonth(), 1).getTime()
        break
      }

      case 'year': {
        const date = new Date(to)
        to = new Date(date.getFullYear(), 0, 1).getTime()
        const _from = new Date(to - count * period.span * 365 * 24 * 60 * 60 * 1000)
        from = new Date(_from.getFullYear(), 0, 1).getTime()
        break
      }
    }

    return [from, to]
  }
}
