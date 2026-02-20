'use server';

import type { DataProvider, StockQuote, MarketIndex } from './types';

async function fetchSinaHK(codes: string[]): Promise<string> {
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Referer: 'https://finance.sina.com.cn' },
  });
  if (!res.ok) throw new Error(`Sina HK fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('gbk').decode(buf);
}

function parseHKQuoteLine(line: string, symbol: string): StockQuote | null {
  const match = line.match(/var hq_str_rt_hk\w+=["']([^"']+)["']/);
  if (!match) return null;
  const parts = match[1].split(',');
  if (parts.length < 14) return null;
  const current = parseFloat(parts[6]);
  const previousClose = parseFloat(parts[3]);
  if (!current || !previousClose) return null;
  return {
    symbol,
    name: parts[1],
    market: 'HK',
    current,
    open: parseFloat(parts[2]),
    high: parseFloat(parts[4]),
    low: parseFloat(parts[5]),
    previousClose,
    change: parseFloat((current - previousClose).toFixed(3)),
    changePercent: parseFloat((((current - previousClose) / previousClose) * 100).toFixed(2)),
    volume: parseInt(parts[12], 10),
    amount: parseFloat(parts[11]),
  };
}

const HK_INDICES = [
  { symbol: 'HSI', code: 'rt_hkHSI', name: '恒生指数' },
  { symbol: 'HSTECH', code: 'rt_hkHSTECH', name: '恒生科技指数' },
];

const HK_WATCHLIST = [
  { symbol: '00700', name: '腾讯控股' },
  { symbol: '09988', name: '阿里巴巴' },
  { symbol: '03690', name: '美团' },
  { symbol: '09888', name: '百度集团' },
  { symbol: '01024', name: '快手' },
  { symbol: '09618', name: '京东集团' },
];

export class HKProvider implements DataProvider {
  name = 'Sina-HK';
  market = 'HK';

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const code = `rt_hk${symbol.padStart(5, '0')}`;
      const text = await fetchSinaHK([code]);
      return parseHKQuoteLine(text, symbol);
    } catch {
      return null;
    }
  }

  async getIndices(): Promise<MarketIndex[]> {
    try {
      const codes = HK_INDICES.map(i => i.code);
      const text = await fetchSinaHK(codes);
      const lines = text.split('\n').filter(Boolean);
      const results: MarketIndex[] = [];
      lines.forEach((line, idx) => {
        const meta = HK_INDICES[idx];
        if (!meta) return;
        const match = line.match(/var hq_str_\w+=["']([^"']+)["']/);
        if (!match) return;
        const parts = match[1].split(',');
        const current = parseFloat(parts[6] || parts[1]);
        const prev = parseFloat(parts[3] || parts[2]);
        if (!current) return;
        results.push({
          symbol: meta.symbol,
          name: meta.name,
          market: 'HK',
          current,
          change: parseFloat((current - prev).toFixed(2)),
          changePercent: parseFloat((((current - prev) / prev) * 100).toFixed(2)),
        });
      });
      return results;
    } catch {
      return [];
    }
  }

  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; market: string }>> {
    const matched = HK_WATCHLIST.filter(s =>
      s.symbol.includes(query) || s.name.includes(query)
    );
    return matched.map(s => ({ symbol: s.symbol, name: s.name, market: 'HK' }));
  }
}
