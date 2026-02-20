'use server';

import type { DataProvider, StockQuote, MarketIndex } from './types';

function getSinaPrefix(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.startsWith('6') || s.startsWith('000') || s.startsWith('880')) return `sh${s}`;
  if (s.startsWith('0') || s.startsWith('3') || s.startsWith('399')) return `sz${s}`;
  return `sh${s}`;
}

async function fetchSina(codes: string[]): Promise<string> {
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Referer: 'https://finance.sina.com.cn' },
  });
  if (!res.ok) throw new Error(`Sina fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('gbk').decode(buf);
}

function parseQuoteLine(line: string, symbol: string): StockQuote | null {
  const match = line.match(/var hq_str_\w+=["']([^"']+)["']/);
  if (!match) return null;
  const parts = match[1].split(',');
  if (parts.length < 32) return null;
  const current = parseFloat(parts[3]);
  const previousClose = parseFloat(parts[2]);
  if (!current) return null;
  return {
    symbol: symbol.toUpperCase(),
    name: parts[0],
    market: 'CN',
    current,
    open: parseFloat(parts[1]),
    high: parseFloat(parts[4]),
    low: parseFloat(parts[5]),
    previousClose,
    change: parseFloat((current - previousClose).toFixed(3)),
    changePercent: parseFloat((((current - previousClose) / previousClose) * 100).toFixed(2)),
    volume: parseInt(parts[8], 10),
    amount: parseFloat(parts[9]),
  };
}

function parseIndexLine(line: string, symbol: string, name: string): MarketIndex | null {
  const match = line.match(/var hq_str_s_\w+=["']([^"']+)["']/);
  if (!match) return null;
  const parts = match[1].split(',');
  if (parts.length < 6) return null;
  const current = parseFloat(parts[1]);
  if (!current) return null;
  return {
    symbol,
    name: parts[0] || name,
    market: 'CN',
    current,
    change: parseFloat(parts[2]),
    changePercent: parseFloat(parts[3]),
    volume: parts[4],
    amount: parts[5],
  };
}

const CN_INDICES = [
  { symbol: '000001', name: '上证指数', prefix: 'sh' },
  { symbol: '399001', name: '深证成指', prefix: 'sz' },
  { symbol: '399006', name: '创业板指', prefix: 'sz' },
  { symbol: '000688', name: '科创50',   prefix: 'sh' },
];

export class SinaProvider implements DataProvider {
  name = 'Sina';
  market = 'CN';

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const code = getSinaPrefix(symbol);
      const text = await fetchSina([code]);
      return parseQuoteLine(text, symbol);
    } catch {
      return null;
    }
  }

  async getIndices(): Promise<MarketIndex[]> {
    try {
      const codes = CN_INDICES.map(i => `s_${i.prefix}${i.symbol}`);
      const text = await fetchSina(codes);
      const lines = text.split('\n').filter(Boolean);
      const results: MarketIndex[] = [];
      lines.forEach((line, idx) => {
        const meta = CN_INDICES[idx];
        if (!meta) return;
        const parsed = parseIndexLine(line, meta.symbol, meta.name);
        if (parsed) results.push(parsed);
      });
      return results;
    } catch {
      return [];
    }
  }

  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; market: string }>> {
    try {
      const code = getSinaPrefix(query);
      const text = await fetchSina([code]);
      const parsed = parseQuoteLine(text, query);
      if (!parsed) return [];
      return [{ symbol: parsed.symbol, name: parsed.name, market: 'CN' }];
    } catch {
      return [];
    }
  }
}
