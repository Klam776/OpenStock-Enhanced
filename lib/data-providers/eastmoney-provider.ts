'use server';

import type { DataProvider, StockQuote, MarketIndex } from './types';

const EM_QUOTE_URL = 'https://push2delay.eastmoney.com/api/qt/stock/get';
const EM_INDEX_URL = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get';

interface EMQuoteData {
  f43: number; // current
  f44: number; // high
  f45: number; // low
  f46: number; // open
  f47: number; // volume
  f48: number; // amount
  f57: string; // code
  f58: string; // name
  f60: number; // previousClose
  f169: number; // change
  f170: number; // changePercent
}

interface EMIndexItem {
  f2: number;  // current
  f3: number;  // changePercent
  f4: number;  // change
  f12: string; // code
  f14: string; // name
}

function getSecId(symbol: string): string {
  if (symbol.startsWith('6') || symbol.startsWith('000001')) return `1.${symbol}`;
  return `0.${symbol}`;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Referer: 'https://www.eastmoney.com' },
  });
  if (!res.ok) throw new Error(`EastMoney fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export class EastMoneyProvider implements DataProvider {
  name = 'EastMoney';
  market = 'CN';

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const secid = getSecId(symbol);
      const url = `${EM_QUOTE_URL}?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170`;
      const resp = await fetchJSON<{ data: EMQuoteData }>(url);
      const d = resp.data;
      if (!d || !d.f43) return null;
      const div = symbol.startsWith('8') || symbol.startsWith('4') ? 100 : 100;
      return {
        symbol,
        name: d.f58,
        market: 'CN',
        current: d.f43 / div,
        open: d.f46 / div,
        high: d.f44 / div,
        low: d.f45 / div,
        previousClose: d.f60 / div,
        change: d.f169 / div,
        changePercent: d.f170 / 100,
        volume: d.f47,
        amount: d.f48,
      };
    } catch {
      return null;
    }
  }

  async getIndices(): Promise<MarketIndex[]> {
    try {
      const url = `${EM_INDEX_URL}?fltt=2&fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006,1.000688`;
      const resp = await fetchJSON<{ data: { diff: EMIndexItem[] } }>(url);
      return (resp.data?.diff ?? []).map(d => ({
        symbol: d.f12,
        name: d.f14,
        market: 'CN' as const,
        current: d.f2,
        change: d.f4,
        changePercent: d.f3,
      }));
    } catch {
      return [];
    }
  }

  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; market: string }>> {
    try {
      const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14&count=5`;
      const resp = await fetchJSON<{ QuotationCodeTable: { Data: Array<{ Code: string; Name: string }> } }>(url);
      return (resp.QuotationCodeTable?.Data ?? []).map(d => ({
        symbol: d.Code,
        name: d.Name,
        market: 'CN',
      }));
    } catch {
      return [];
    }
  }
}
