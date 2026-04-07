import { gql } from "@apollo/client";

export enum Exchange {
  Binance = "binance",
  OKX = "okx",
  BinanceTest = "binance_test",
  OKXTest = "okx_test",
}

export type Ticker = {
  exchange: Exchange;
  symbol: string;
  lastPrice: string;
  open24H: string;
  high24H: string;
  low24H: string;
  avg24H: string;
  volume24H: string;
  quoteVolume24H: string;
  ts: number;
};

export type MarkPrice = {
  exchange: Exchange;
  symbol: string;
  markPrice: string;
  ts: number;
};

export type FundingRate = {
  exchange: Exchange;
  symbol: string;
  fundingRate: string;
  interestRate: string;
  nextFundingTime: number;
  ts: number;
};

export type OpenInterest = {
  exchange: Exchange;
  symbol: string;
  openInterest: string; // base asset 数量
  ts: number;
};

export type Trade = {
  tradeId: string;
  exchange: Exchange;
  symbol: string;
  price: string;
  size: string;
  isBuy: boolean;
  ts: number;
};

export type DepthLevel = { price: string; size: string; ts?: number; seqId?: number };
export type Depth = {
  bids: DepthLevel[];
  asks: DepthLevel[];
  ts: number;
  seqId: number;
  prevSeqId: number;
};

export type MarketRules = {
  tickSize?: string;
  lotSize?: string;
};

export type MarketInfo = {
  exchange: string;
  symbol: string;
  status: string;
  baseAssetPrecision?: number;
  quoteAssetPrecision?: number;
  pricePrecision?: number;
  rules?: MarketRules;
};

export type Bracket = {
  bracket: number;
  maxLeverage: number;
  minNotional: string;
  maxNotional: string;
  mmr: string;
  cum: string;
};

export type LeverageBracket = {
  symbol: string;
  brackets: Bracket[];
};

export type IndexPrice = {
  exchange: string;
  symbol: string;
  indexPrice: string;
  ts: number;
};

export type IndexComponentItem = {
  exchange: string;
  symbol: string;
  price: string;
  weight: string;
};

export type IndexComponent = {
  exchange: string;
  symbol: string;
  price?: string;
  ts: number;
  components: IndexComponentItem[];
};

export type Kline = {
  interval: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  trades: number;
  openTs: number;
  closeTs: number;
};

export type StreamEvent = {
  type: "ticker" | "trade" | "depth" | "kline" | "mark_price" | "social";
  ticker?: Ticker;
  trade?: Trade;
  depth?: Depth;
  kline?: Kline;
  markPrice?: MarkPrice;
  social?: Document;
};

export const SUB_STREAM = gql`
  subscription Stream($input: StreamInput!) {
    Stream(input: $input) {
      type
      ticker {
        exchange
        symbol
        lastPrice
        open24H
        high24H
        low24H
        avg24H
        volume24H
        quoteVolume24H
        ts
      }
      trade {
        tradeId
        exchange
        symbol
        price
        size
        isBuy
        ts
      }
      depth {
        ts
        bids {
          price
          size
        }
        asks {
          price
          size
        }
        seqId
        prevSeqId
      }
      kline {
        interval
        open
        high
        low
        close
        volume
        quoteVolume
        trades
        openTs
        closeTs
      }
      markPrice {
        exchange
        symbol
        markPrice
        ts
      }
      social {
        id
        source
        provider
        catalog
        title
        content
        aiTitle
        aiSummary
        aiTags
        aiCoins
        aiInfluence
        aiInfluenceScore
        aiSentiment
        lang
        md5
        url
        authors
        format
        status
        errMsg
        dedupedBy
        publishedAt
        createdAt
        updatedAt
      }
    }
  }
`;

export const QUERY_KLINE = `
  query QueryKline($input: QueryKlineInput!) {
    Result: Kline(input: $input) {
      interval
      open
      high
      low
      close
      volume
      quoteVolume
      trades
      openTs
      closeTs
    }
  }
`;

/** 查询历史 K 线（startTime/endTime/limit 必填，单位：毫秒） */
export async function queryKline(input: {
  symbol: string;
  exchange: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<Kline[]> {
  console.log('[queryKline] input', input)
  const uri = import.meta.env.VITE_GRAPHQL_HTTP ?? '/query';
  const res = await fetch(uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_GRAPHQL_AUTH_TOKEN}`
     },
    body: JSON.stringify({
      query: QUERY_KLINE,
      variables: { input },
    }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { Result?: Kline[] };
    errors?: { message?: string }[];
  };
  const errMsg = json.errors?.map((e) => e.message).filter(Boolean).join('; ');
  if (errMsg) throw new Error(errMsg);
  return json.data?.Result ?? [];
}