'use server';

import type { DataProvider, StockQuote, MarketIndex } from './types';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

interface FinnhubQuote {
  c: number;
  o: number;
  h: number;
  l: number;
  pc: number;
  d: number;
  dp: number;
  t: number;
}

interface FinnhubProfile {
  name: string;
}

interface FinnhubSearchResult {
  symbol: string;
  description: string;
}

interface FinnhubSearchResponse {
  result: FinnhubSearchResult[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Finnhub fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}

const US_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI',  name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'NASDAQ' },
];

export class FinnhubProvider implements DataProvider {
  name = 'Finnhub';
  market = 'US';

  private get token(): string {
    return process.env.FINNHUB_API_KEY ?? '';
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const [quote, profile] = await Promise.all([
        fetchJSON<FinnhubQuote>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.token}`),
        fetchJSON<FinnhubProfile>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${this.token}`),
      ]);
      if (!quote.c) return null;
      return {
        symbol: symbol.toUpperCase(),
        name: profile.name || symbol,
        market: 'US',
        current: quote.c,
        open: quote.o,
        high: quote.h,
        low: quote.l,
        previousClose: quote.pc,
        change: quote.d,
        changePercent: quote.dp,
        timestamp: quote.t,
      };
    } catch {
      return null;
    }
  }

  async getIndices(): Promise<MarketIndex[]> {
    const results = await Promise.allSettled(
      US_INDICES.map(async ({ symbol, name }) => {
        const q = await fetchJSON<FinnhubQuote>(
          `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.token}`
        );
        const idx: MarketIndex = {
          symbol,
          name,
          market: 'US',
          current: q.c,
          change: q.d,
          changePercent: q.dp,
        };
        return idx;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<MarketIndex> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; market: string }>> {
    try {
      const data = await fetchJSON<FinnhubSearchResponse>(
        `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${this.token}`
      );
      return (data.result ?? []).slice(0, 10).map(r => ({
        symbol: r.symbol,
        name: r.description,
        market: 'US',
      }));
    } catch {
      return [];
    }
  }
}
