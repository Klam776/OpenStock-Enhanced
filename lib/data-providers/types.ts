export interface StockQuote {
  symbol: string;
  name: string;
  market: 'US' | 'CN' | 'HK';
  current: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
  amount?: number;
  timestamp?: number;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  market: 'US' | 'CN' | 'HK';
  current: number;
  change: number;
  changePercent: number;
  volume?: string;
  amount?: string;
}

export interface DataProvider {
  name: string;
  market: string;
  getQuote(symbol: string): Promise<StockQuote | null>;
  getIndices(): Promise<MarketIndex[]>;
  searchStocks(query: string): Promise<Array<{ symbol: string; name: string; market: string }>>;
}
